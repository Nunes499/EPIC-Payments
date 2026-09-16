const UPSTREAM_API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

const SESSION_COOKIE =
  "epic_payments_session";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function readCookie(
  request: Request,
  name: string,
): string | null {
  const cookieHeader =
    request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex =
      part.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const cookieName =
      part
        .slice(0, separatorIndex)
        .trim();

    if (cookieName !== name) {
      continue;
    }

    const value =
      part
        .slice(separatorIndex + 1)
        .trim();

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function expiredSessionCookie(
  request: Request,
): string {
  const secure =
    new URL(request.url).protocol === "https:";

  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function jsonError(
  request: Request,
  detail: string,
  status: number,
): Response {
  return new Response(
    JSON.stringify({ detail }),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        "Cache-Control":
          "no-store",
        "Set-Cookie":
          expiredSessionCookie(request),
      },
    },
  );
}

async function proxyRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const token =
    readCookie(
      request,
      SESSION_COOKIE,
    );

  if (!token) {
    return jsonError(
      request,
      "Sessão não encontrada.",
      401,
    );
  }

  const { path } =
    await context.params;

  const pathname =
    path
      .map(
        (segment) =>
          encodeURIComponent(segment),
      )
      .join("/");

  const incomingUrl =
    new URL(request.url);

  const upstreamUrl =
    new URL(
      `${UPSTREAM_API_URL.replace(/\/$/, "")}/${pathname}`,
    );

  upstreamUrl.search =
    incomingUrl.search;

  const headers =
    new Headers();

  headers.set(
    "Authorization",
    `Bearer ${token}`,
  );

  const contentType =
    request.headers.get(
      "content-type",
    );

  if (contentType) {
    headers.set(
      "Content-Type",
      contentType,
    );
  }

  const accept =
    request.headers.get("accept");

  if (accept) {
    headers.set(
      "Accept",
      accept,
    );
  }

  const init:
    RequestInit & {
      duplex?: "half";
    } = {
      method:
        request.method,
      headers,
      cache:
        "no-store",
      redirect:
        "manual",
    };

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    init.body =
      request.body;
    init.duplex = "half";
  }

  let upstreamResponse:
    Response;

  try {
    upstreamResponse =
      await fetch(
        upstreamUrl,
        init,
      );
  } catch {
    return new Response(
      JSON.stringify({
        detail:
          "Não foi possível comunicar com o servidor.",
      }),
      {
        status: 502,
        headers: {
          "Content-Type":
            "application/json",
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const responseHeaders =
    new Headers();

  const responseContentType =
    upstreamResponse.headers.get(
      "content-type",
    );

  if (responseContentType) {
    responseHeaders.set(
      "Content-Type",
      responseContentType,
    );
  }

  const contentDisposition =
    upstreamResponse.headers.get(
      "content-disposition",
    );

  if (contentDisposition) {
    responseHeaders.set(
      "Content-Disposition",
      contentDisposition,
    );
  }

  responseHeaders.set(
    "Cache-Control",
    "no-store",
  );

  if (
    upstreamResponse.status ===
    401
  ) {
    responseHeaders.append(
      "Set-Cookie",
      expiredSessionCookie(
        request,
      ),
    );
  }

  return new Response(
    upstreamResponse.body,
    {
      status:
        upstreamResponse.status,
      statusText:
        upstreamResponse.statusText,
      headers:
        responseHeaders,
    },
  );
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(
    request,
    context,
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(
    request,
    context,
  );
}

export async function PUT(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(
    request,
    context,
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(
    request,
    context,
  );
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  return proxyRequest(
    request,
    context,
  );
}
