const UPSTREAM_API_URL =
  process.env.API_URL ??
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
    request.headers.get(
      "cookie",
    );

  if (!cookieHeader) {
    return null;
  }

  for (
    const part
    of cookieHeader.split(";")
  ) {
    const separatorIndex =
      part.indexOf("=");

    if (
      separatorIndex <= 0
    ) {
      continue;
    }

    const cookieName =
      part
        .slice(
          0,
          separatorIndex,
        )
        .trim();

    if (
      cookieName !== name
    ) {
      continue;
    }

    const value =
      part
        .slice(
          separatorIndex + 1,
        )
        .trim();

    try {
      return decodeURIComponent(
        value,
      );
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


function jsonError(
  request: Request,
  detail: string,
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
    JSON.stringify({
      detail,
    }),
    {
      status,
      headers,
    },
  );
}


function isMutationMethod(
  method: string,
): boolean {
  return ![
    "GET",
    "HEAD",
    "OPTIONS",
  ].includes(
    method.toUpperCase(),
  );
}


function isSameOriginMutation(
  request: Request,
): boolean {
  if (
    !isMutationMethod(
      request.method,
    )
  ) {
    return true;
  }

  const requestOrigin =
    new URL(
      request.url,
    ).origin;

  /*
   * Browsers modernos enviam Origin
   * em pedidos mutáveis. Se existir,
   * tem obrigatoriamente de coincidir
   * com a origem da própria aplicação.
   */
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
  }

  /*
   * Sec-Fetch-Site oferece uma segunda
   * camada de proteção CSRF no browser.
   *
   * "none" é aceite para navegação direta
   * iniciada pelo próprio utilizador.
   * Os pedidos normais do frontend serão
   * "same-origin".
   */
  const fetchSite =
    request.headers.get(
      "sec-fetch-site",
    );

  if (
    fetchSite &&
    fetchSite !==
      "same-origin" &&
    fetchSite !==
      "none"
  ) {
    return false;
  }

  return true;
}


async function proxyRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  /*
   * Com autenticação por cookie, pedidos
   * POST/PUT/PATCH/DELETE precisam de uma
   * defesa explícita contra CSRF.
   */
  if (
    !isSameOriginMutation(
      request,
    )
  ) {
    return jsonError(
      request,
      "Pedido bloqueado por segurança.",
      403,
    );
  }

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
      true,
    );
  }

  const { path } =
    await context.params;

  if (
    !Array.isArray(path) ||
    path.length === 0
  ) {
    return jsonError(
      request,
      "Caminho de API inválido.",
      400,
    );
  }

  const pathname =
    path
      .map(
        (segment) =>
          encodeURIComponent(
            segment,
          ),
      )
      .join("/");

  const incomingUrl =
    new URL(
      request.url,
    );

  let upstreamUrl:
    URL;

  try {
    upstreamUrl =
      new URL(
        `${UPSTREAM_API_URL.replace(
          /\/$/,
          "",
        )}/${pathname}`,
      );
  } catch {
    return jsonError(
      request,
      "Configuração do servidor inválida.",
      500,
    );
  }

  upstreamUrl.search =
    incomingUrl.search;

  const headers =
    new Headers();

  /*
   * O JWT só existe no servidor/Worker:
   * é lido do cookie HttpOnly e convertido
   * em Bearer apenas para a chamada ao
   * backend Render.
   */
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
    request.headers.get(
      "accept",
    );

  if (accept) {
    headers.set(
      "Accept",
      accept,
    );
  }

  const acceptLanguage =
    request.headers.get(
      "accept-language",
    );

  if (acceptLanguage) {
    headers.set(
      "Accept-Language",
      acceptLanguage,
    );
  }

  const init:
    RequestInit = {
      method:
        request.method,
      headers,
      cache:
        "no-store",
      redirect:
        "manual",
      signal:
        request.signal,
    };

  /*
   * Usamos bytes em vez de encaminhar
   * diretamente o ReadableStream. Isto
   * evita depender de "duplex: half" e
   * mantém compatibilidade entre o dev
   * local e o runtime Cloudflare.
   */
  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    init.body =
      await request.arrayBuffer();
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
    return jsonError(
      request,
      "Não foi possível comunicar com o servidor.",
      502,
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
