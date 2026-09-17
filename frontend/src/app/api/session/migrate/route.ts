const UPSTREAM_API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


const SESSION_COOKIE =
  "epic_payments_session";


type MigrationPayload = {
  token?: unknown;
};


function requestIsSameOrigin(
  request: Request,
): boolean {
  const requestOrigin =
    new URL(
      request.url,
    ).origin;

  const origin =
    request.headers.get(
      "origin",
    );

  if (origin) {
    try {
      if (
        new URL(
          origin,
        ).origin !==
        requestOrigin
      ) {
        return false;
      }
    } catch {
      return false;
    }
  } else {
    const referer =
      request.headers.get(
        "referer",
      );

    if (referer) {
      try {
        if (
          new URL(
            referer,
          ).origin !==
          requestOrigin
        ) {
          return false;
        }
      } catch {
        return false;
      }
    } else {
      const fetchSite =
        request.headers.get(
          "sec-fetch-site",
        );

      if (
        fetchSite !==
        "same-origin"
      ) {
        return false;
      }
    }
  }

  const fetchSite =
    request.headers.get(
      "sec-fetch-site",
    );

  if (
    fetchSite &&
    fetchSite !==
      "same-origin"
  ) {
    return false;
  }

  return true;
}


function sessionCookie(
  request: Request,
  token: string,
  maxAge: number,
): string {
  const secure =
    new URL(
      request.url,
    ).protocol ===
    "https:";

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(
      token,
    )}`,
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
    ).protocol ===
    "https:";

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


function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  expireSession = false,
): Response {
  const headers =
    new Headers({
      "Content-Type":
        "application/json",
      "Cache-Control":
        "no-store",
    });

  if (expireSession) {
    headers.append(
      "Set-Cookie",
      expiredSessionCookie(
        request,
      ),
    );
  }

  return new Response(
    JSON.stringify(
      body,
    ),
    {
      status,
      headers,
    },
  );
}


function tokenMaxAge(
  token: string,
): number | null {
  try {
    const parts =
      token.split(".");

    if (
      parts.length !== 3
    ) {
      return null;
    }

    const base64 =
      parts[1]
        .replace(
          /-/g,
          "+",
        )
        .replace(
          /_/g,
          "/",
        );

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
      "number" ||
      !Number.isFinite(
        payload.exp,
      )
    ) {
      return null;
    }

    const now =
      Math.floor(
        Date.now() /
          1000,
      );

    const remaining =
      Math.floor(
        payload.exp -
          now -
          5,
      );

    if (
      remaining <= 0
    ) {
      return null;
    }

    return remaining;
  } catch {
    return null;
  }
}


async function upstreamErrorDetail(
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
    "Não foi possível validar a sessão antiga."
  );
}


export async function POST(
  request: Request,
): Promise<Response> {
  /*
   * A migração recebe um JWT legado que
   * ainda vive no JavaScript. Por isso este
   * endpoint só aceita pedidos da própria
   * aplicação.
   */
  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
    return jsonResponse(
      request,
      {
        detail:
          "Pedido bloqueado por segurança.",
      },
      403,
      true,
    );
  }

  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith(
        "application/json",
      )
  ) {
    return jsonResponse(
      request,
      {
        detail:
          "Formato de pedido inválido.",
      },
      415,
    );
  }

  let payload:
    MigrationPayload;

  try {
    payload =
      await request.json();
  } catch {
    return jsonResponse(
      request,
      {
        detail:
          "Pedido de migração inválido.",
      },
      400,
    );
  }

  const token =
    typeof payload.token ===
      "string"
      ? payload.token.trim()
      : "";

  if (!token) {
    return jsonResponse(
      request,
      {
        detail:
          "Token de sessão não encontrado.",
      },
      400,
      true,
    );
  }

  /*
   * JWTs normais ficam muito abaixo deste
   * limite. Evita enviar payloads absurdos
   * para o backend.
   */
  if (
    token.length > 8192
  ) {
    return jsonResponse(
      request,
      {
        detail:
          "Token de sessão inválido.",
      },
      400,
      true,
    );
  }

  const maxAge =
    tokenMaxAge(
      token,
    );

  if (!maxAge) {
    return jsonResponse(
      request,
      {
        detail:
          "Sessão expirada ou inválida.",
      },
      401,
      true,
    );
  }

  let upstreamUrl:
    URL;

  try {
    upstreamUrl =
      new URL(
        `${UPSTREAM_API_URL.replace(
          /\/$/,
          "",
        )}/auth/me`,
      );
  } catch {
    return jsonResponse(
      request,
      {
        detail:
          "Configuração do servidor inválida.",
      },
      500,
      true,
    );
  }

  let upstreamResponse:
    Response;

  try {
    upstreamResponse =
      await fetch(
        upstreamUrl,
        {
          method: "GET",
          headers: {
            "Authorization":
              `Bearer ${token}`,
            "Accept":
              "application/json",
          },
          cache:
            "no-store",
          redirect:
            "manual",
          signal:
            request.signal,
        },
      );
  } catch {
    return jsonResponse(
      request,
      {
        detail:
          "Não foi possível comunicar com o servidor.",
      },
      502,
    );
  }

  if (
    !upstreamResponse.ok
  ) {
    return jsonResponse(
      request,
      {
        detail:
          await upstreamErrorDetail(
            upstreamResponse,
          ),
      },
      upstreamResponse.status,
      true,
    );
  }

  /*
   * O backend confirmou o JWT legado.
   * Só agora o transformamos em cookie
   * HttpOnly e o browser poderá apagar o
   * valor antigo do localStorage.
   */
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
      token,
      maxAge,
    ),
  );

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
