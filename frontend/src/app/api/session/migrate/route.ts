const UPSTREAM_API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

const SESSION_COOKIE =
  "epic_payments_session";


type MigrationPayload = {
  token?: unknown;
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


function expiredSessionCookie(
  request: Request,
): string {
  const secure =
    new URL(
      request.url,
    ).protocol === "https:";

  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
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
      return 1;
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
      return 1;
    }

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    return Math.max(
      1,
      payload.exp - now - 5,
    );
  } catch {
    return 1;
  }
}


export async function POST(
  request: Request,
): Promise<Response> {
  let payload:
    MigrationPayload;

  try {
    payload =
      await request.json();
  } catch {
    return Response.json(
      {
        detail:
          "Pedido de migração inválido.",
      },
      {
        status: 400,
      },
    );
  }

  const token =
    typeof payload.token ===
      "string"
      ? payload.token.trim()
      : "";

  if (!token) {
    return Response.json(
      {
        detail:
          "Token de sessão não encontrado.",
      },
      {
        status: 400,
      },
    );
  }

  let upstreamResponse:
    Response;

  try {
    upstreamResponse =
      await fetch(
        `${UPSTREAM_API_URL.replace(
          /\/$/,
          "",
        )}/auth/me`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
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
    return new Response(
      await upstreamResponse.text(),
      {
        status:
          upstreamResponse.status,
        headers: {
          "Content-Type":
            upstreamResponse.headers.get(
              "content-type",
            ) ??
            "application/json",
          "Cache-Control":
            "no-store",
          "Set-Cookie":
            expiredSessionCookie(
              request,
            ),
        },
      },
    );
  }

  const maxAge =
    tokenMaxAge(
      token,
    );

  if (
    maxAge <= 1
  ) {
    return Response.json(
      {
        detail:
          "Sessão expirada.",
      },
      {
        status: 401,
        headers: {
          "Set-Cookie":
            expiredSessionCookie(
              request,
            ),
        },
      },
    );
  }

  const headers =
    new Headers({
      "Content-Type":
        upstreamResponse.headers.get(
          "content-type",
        ) ??
        "application/json",
      "Cache-Control":
        "no-store",
    });

  headers.append(
    "Set-Cookie",
    sessionCookie(
      request,
      token,
      maxAge,
    ),
  );

  return new Response(
    upstreamResponse.body,
    {
      status: 200,
      headers,
    },
  );
}
