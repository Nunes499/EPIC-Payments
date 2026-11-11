import base64
import hashlib
import hmac
import json
import time

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pg8000.native import Connection
from pydantic import BaseModel, Field
from workers import asgi


app = FastAPI(title="EPIC Payments - Cloudflare Backend")

password_hasher = PasswordHasher()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

TOKEN_EXPIRE_SECONDS = 3600

USER_COLUMNS = """
    id, name, username, email, password_hash,
    role, is_active, photo_object_key, created_at, updated_at
"""


def get_environment(request: Request):
    env = request.scope.get("env")

    if env is None:
        raise HTTPException(
            status_code=503,
            detail="Ambiente Cloudflare indisponivel.",
        )

    return env


def get_jwt_secret(request: Request) -> str:
    secret = getattr(get_environment(request), "JWT_SECRET_KEY", None)

    if not isinstance(secret, str) or len(secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="Configuracao de autenticacao indisponivel.",
        )

    return secret


def open_database(request: Request) -> Connection:
    hyperdrive = getattr(
        get_environment(request),
        "HYPERDRIVE",
        None,
    )

    if hyperdrive is None:
        raise HTTPException(
            status_code=503,
            detail="Ligacao a base de dados indisponivel.",
        )

    return Connection(
        user=hyperdrive.user,
        password=hyperdrive.password,
        host=hyperdrive.host,
        port=int(hyperdrive.port),
        database=hyperdrive.database,
        ssl_context=None,
    )


def fetch_user(request: Request, sql: str, **params):
    connection = open_database(request)

    try:
        rows = connection.run(sql, **params)
        return rows[0] if rows else None
    finally:
        connection.close()


def verify_user_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def encode_base64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def decode_base64(value: str) -> bytes:
    return base64.urlsafe_b64decode(
        (value + "=" * (-len(value) % 4)).encode("ascii")
    )


def create_access_token(user_id: int, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}

    payload = {
        "sub": str(user_id),
        "exp": int(time.time()) + TOKEN_EXPIRE_SECONDS,
    }

    encoded_header = encode_base64(
        json.dumps(header, separators=(",", ":")).encode()
    )

    encoded_payload = encode_base64(
        json.dumps(payload, separators=(",", ":")).encode()
    )

    message = f"{encoded_header}.{encoded_payload}"

    signature = hmac.new(
        secret.encode(),
        message.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{message}.{encode_base64(signature)}"


def decode_access_token(token: str, secret: str):
    try:
        parts = token.split(".")

        if len(parts) != 3:
            return None

        header = json.loads(decode_base64(parts[0]))

        if header.get("alg") != "HS256":
            return None

        message = f"{parts[0]}.{parts[1]}"

        expected_signature = hmac.new(
            secret.encode(),
            message.encode("ascii"),
            hashlib.sha256,
        ).digest()

        received_signature = decode_base64(parts[2])

        if not hmac.compare_digest(
            expected_signature,
            received_signature,
        ):
            return None

        payload = json.loads(decode_base64(parts[1]))

        if type(payload.get("exp")) is not int:
            return None

        if payload["exp"] <= int(time.time()):
            return None

        subject = payload.get("sub")

        if not isinstance(subject, str) or not subject.isdigit():
            return None

        return payload

    except (ValueError, TypeError, KeyError, UnicodeError):
        return None


def user_response(user):
    return {
        "id": user[0],
        "name": user[1],
        "username": user[2],
        "email": user[3],
        "role": user[5],
        "is_active": user[6],
        "has_photo": bool(user[7]),
        "created_at": user[8],
        "updated_at": user[9],
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "epic-payments-cloudflare-backend",
        "environment": "test",
    }


@app.post("/auth/login")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    if len(form_data.username) > 60 or len(form_data.password) > 1024:
        raise HTTPException(
            status_code=401,
            detail="Username ou password incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = fetch_user(
            request,
            f"SELECT {USER_COLUMNS} FROM public.users "
            "WHERE username = :username LIMIT 1",
            username=form_data.username,
        )

    except HTTPException:
        raise

    except Exception as exc:
        print(f"AUTH_DATABASE_ERROR: {type(exc).__name__}")

        raise HTTPException(
            status_code=503,
            detail="Servico de autenticacao temporariamente indisponivel.",
        ) from None

    if user is None or not user[6]:
        raise HTTPException(
            status_code=401,
            detail="Username ou password incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_user_password(form_data.password, user[4]):
        raise HTTPException(
            status_code=401,
            detail="Username ou password incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    secret = get_jwt_secret(request)

    return {
        "access_token": create_access_token(user[0], secret),
        "token_type": "bearer",
    }


@app.get("/auth/me")
async def me(
    request: Request,
    token: str = Depends(oauth2_scheme),
):
    secret = get_jwt_secret(request)
    payload = decode_access_token(token, secret)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Sessao invalida ou expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = fetch_user(
            request,
            f"SELECT {USER_COLUMNS} FROM public.users "
            "WHERE id = :user_id LIMIT 1",
            user_id=int(payload["sub"]),
        )

    except HTTPException:
        raise

    except Exception as exc:
        print(f"AUTH_DATABASE_ERROR: {type(exc).__name__}")

        raise HTTPException(
            status_code=503,
            detail="Nao foi possivel validar a sessao.",
        ) from None

    if user is None or not user[6]:
        raise HTTPException(
            status_code=401,
            detail="Sessao invalida ou expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_response(user)



class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@app.put("/auth/me/password")
async def change_my_password(
    request: Request,
    data: PasswordChangeRequest,
    token: str = Depends(oauth2_scheme),
):
    secret = get_jwt_secret(request)
    payload = decode_access_token(token, secret)

    if payload is None:
        raise HTTPException(status_code=401, detail="Sessao invalida ou expirada.")

    try:
        user = fetch_user(
            request,
            f"SELECT {USER_COLUMNS} FROM public.users WHERE id = :user_id LIMIT 1",
            user_id=int(payload["sub"]),
        )

        if user is None or not user[6]:
            raise HTTPException(status_code=401, detail="Sessao invalida ou expirada.")

        if not verify_user_password(data.current_password, user[4]):
            raise HTTPException(status_code=400, detail="A password atual esta incorreta.")

        if verify_user_password(data.new_password, user[4]):
            raise HTTPException(status_code=400, detail="A nova password tem de ser diferente da atual.")

        connection = open_database(request)

        try:
            connection.run("START TRANSACTION")
            connection.run(
                "UPDATE public.users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :user_id",
                password_hash=password_hasher.hash(data.new_password),
                user_id=user[0],
            )
            connection.run("COMMIT")
        except Exception:
            try:
                connection.run("ROLLBACK")
            except Exception:
                pass
            raise
        finally:
            connection.close()

        return {"message": "Password alterada com sucesso."}

    except HTTPException:
        raise
    except Exception as exc:
        print(f"PASSWORD_CHANGE_ERROR: {type(exc).__name__}")
        raise HTTPException(status_code=503, detail="Nao foi possivel alterar a password.") from None


Default = asgi.entrypoint(app)