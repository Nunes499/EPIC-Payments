const SESSION_COOKIE =
  "epic_payments_session";


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


export async function POST(
  request: Request,
): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
    }),
    {
      status: 200,
      headers: {
        "Content-Type":
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
