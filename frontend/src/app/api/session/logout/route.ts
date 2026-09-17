const SESSION_COOKIE =
  "epic_payments_session";


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


export async function POST(
  request: Request,
): Promise<Response> {
  /*
   * Evita logout CSRF: sites externos não
   * podem forçar o browser a apagar a sessão.
   */
  if (
    !requestIsSameOrigin(
      request,
    )
  ) {
    return new Response(
      JSON.stringify({
        detail:
          "Pedido bloqueado por segurança.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type":
            "application/json",
          "Cache-Control":
            "no-store",
        },
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
    expiredSessionCookie(
      request,
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
