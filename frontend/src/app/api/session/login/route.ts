const UPSTREAM_API_URL =
  process.env.API_URL ??
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
      /*
       * Login é exclusivamente chamado
       * pelo frontend da própria aplicação.
       * Sem Origin nem Referer, exigimos
       * Sec-Fetch-Site same-origin.
       */
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

    /*
     * Margem de 5 segundos para o cookie
     * nunca sobreviver à validade do JWT.
     */
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
  /*
   * Impede login CSRF: este endpoint só
   * aceita pedidos originados pela própria
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
    LoginPayload;

  try {
    payload =
      await request.json();
  } catch {
    return jsonResponse(
      request,
      {
        detail:
          "Pedido de login inválido.",
      },
      400,
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
    return jsonResponse(
      request,
      {
        detail:
          "Indique o username e a password.",
      },
      400,
    );
  }

  /*
   * Limites simples para evitar pedidos
   * absurdamente grandes neste endpoint.
   */
  if (
    username.length > 254 ||
    password.length > 1024
  ) {
    return jsonResponse(
      request,
      {
        detail:
          "Dados de autenticação inválidos.",
      },
      400,
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

  let upstreamUrl:
    URL;

  try {
    upstreamUrl =
      new URL(
        `${UPSTREAM_API_URL.replace(
          /\/$/,
          "",
        )}/auth/login`,
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
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            "Accept":
              "application/json",
          },
          body:
            formData.toString(),
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
      true,
    );
  }

  if (
    !upstreamResponse.ok
  ) {
    return jsonResponse(
      request,
      {
        detail:
          await errorDetail(
            upstreamResponse,
          ),
      },
      upstreamResponse.status,
      true,
    );
  }

  let data:
    BackendLoginResponse;

  try {
    data =
      await upstreamResponse.json();
  } catch {
    return jsonResponse(
      request,
      {
        detail:
          "Resposta de autenticação inválida.",
      },
      502,
      true,
    );
  }

  if (
    typeof data.access_token !==
      "string" ||
    !data.access_token
  ) {
    return jsonResponse(
      request,
      {
        detail:
          "O servidor não devolveu uma sessão válida.",
      },
      502,
      true,
    );
  }

  const maxAge =
    tokenMaxAge(
      data.access_token,
    );

  if (!maxAge) {
    return jsonResponse(
      request,
      {
        detail:
          "O servidor devolveu uma sessão inválida ou expirada.",
      },
      502,
      true,
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
      maxAge,
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
