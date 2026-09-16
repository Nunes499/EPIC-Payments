const UPSTREAM_API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

const SESSION_COOKIE =
  "epic_payments_session";


type LoginPayload = {
  username?: unknown;
  password?: unknown;
};


type BackendLoginResponse = {
  access_token?: unknown;
  token_type?: unknown;
};


function sessionCookie(
  request: Request,
  token: string,
  maxAge: number,
): string {
  const secure =
    new URL(
      request.url,
    ).protocol === "https:";

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure
      ? ["Secure"]
      : []),
  ].join("; ");
}


function tokenMaxAge(
  token: string,
): number {
  try {
    const parts =
      token.split(".");

    if (
      parts.length !== 3
    ) {
      return 60 * 60;
    }

    const base64 =
      parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const padding =
      base64.length % 4;

    const padded =
      padding === 0
        ? base64
        : base64.padEnd(
            base64.length +
              (4 - padding),
            "=",
          );

    const payload =
      JSON.parse(
        atob(
          padded,
        ),
      ) as {
        exp?: unknown;
      };

    if (
      typeof payload.exp !==
      "number"
    ) {
      return 60 * 60;
    }

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    /*
     * Mantemos uma pequena margem para
     * nunca conservar o cookie para além
     * da validade do JWT emitido pelo backend.
     */
    return Math.max(
      1,
      payload.exp - now - 5,
    );
  } catch {
    return 60 * 60;
  }
}


async function errorDetail(
  response: Response,
): Promise<string> {
  try {
    const data =
      await response.json() as {
        detail?: unknown;
      };

    if (
      typeof data.detail ===
      "string"
    ) {
      return data.detail;
    }
  } catch {
    // Usamos a mensagem genérica abaixo.
  }

  return (
    "Não foi possível iniciar sessão."
  );
}


export async function POST(
  request: Request,
): Promise<Response> {
  let payload:
    LoginPayload;

  try {
    payload =
      await request.json();
  } catch {
    return Response.json(
      {
        detail:
          "Pedido de login inválido.",
      },
      {
        status: 400,
      },
    );
  }

  const username =
    typeof payload.username ===
      "string"
      ? payload.username.trim()
      : "";

  const password =
    typeof payload.password ===
      "string"
      ? payload.password
      : "";

  if (
    !username ||
    !password
  ) {
    return Response.json(
      {
        detail:
          "Indique o username e a password.",
      },
      {
        status: 400,
      },
    );
  }

  const formData =
    new URLSearchParams();

  formData.set(
    "username",
    username,
  );

  formData.set(
    "password",
    password,
  );

  let upstreamResponse:
    Response;

  try {
    upstreamResponse =
      await fetch(
        `${UPSTREAM_API_URL.replace(
          /\/$/,
          "",
        )}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            formData.toString(),
          cache:
            "no-store",
        },
      );
  } catch {
    return Response.json(
      {
        detail:
          "Não foi possível comunicar com o servidor.",
      },
      {
        status: 502,
      },
    );
  }

  if (
    !upstreamResponse.ok
  ) {
    return Response.json(
      {
        detail:
          await errorDetail(
            upstreamResponse,
          ),
      },
      {
        status:
          upstreamResponse.status,
      },
    );
  }

  let data:
    BackendLoginResponse;

  try {
    data =
      await upstreamResponse.json();
  } catch {
    return Response.json(
      {
        detail:
          "Resposta de autenticação inválida.",
      },
      {
        status: 502,
      },
    );
  }

  if (
    typeof data.access_token !==
      "string" ||
    !data.access_token
  ) {
    return Response.json(
      {
        detail:
          "O servidor não devolveu uma sessão válida.",
      },
      {
        status: 502,
      },
    );
  }

  const headers =
    new Headers({
      "Content-Type":
        "application/json",
      "Cache-Control":
        "no-store",
    });

  headers.append(
    "Set-Cookie",
    sessionCookie(
      request,
      data.access_token,
      tokenMaxAge(
        data.access_token,
      ),
    ),
  );

  /*
   * O JWT nunca é devolvido ao JavaScript.
   * O browser recebe apenas o cookie HttpOnly.
   */
  return new Response(
    JSON.stringify({
      ok: true,
    }),
    {
      status: 200,
      headers,
    },
  );
}
