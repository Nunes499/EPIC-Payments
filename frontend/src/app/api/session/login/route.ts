import { fetchBackend } from "@/lib/backendFetch";
const UPSTREAM_API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";

const SESSION_COOKIE = "epic_payments_session";

type LoginPayload = {
  username?: unknown;
  password?: unknown;
};

type BackendLoginResponse = {
  access_token?: unknown;
  token_type?: unknown;
};

function requestIsSameOrigin(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");
  const source = origin || referer;

  if (source) {
    try {
      if (new URL(source).origin !== requestOrigin) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (fetchSite !== "same-origin") {
    // Sem Origin nem Referer, exigimos Sec-Fetch-Site same-origin.
    return false;
  }

  return !fetchSite || fetchSite === "same-origin";
}

function sessionCookie(
  request: Request,
  token: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === "https:";

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  expireSession = false,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  if (expireSession) {
    headers.append("Set-Cookie", sessionCookie(request, "", 0));
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function tokenMaxAge(token: string): number | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }

    // O cookie expira 5 segundos antes do JWT.
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.floor(payload.exp - now - 5);

    return remaining > 0 ? remaining : null;
  } catch {
    return null;
  }
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown } | null;

    if (typeof data?.detail === "string") {
      return data.detail;
    }
  } catch {
    // A resposta do backend pode não conter JSON válido.
  }

  return "Não foi possível iniciar sessão.";
}

export async function POST(request: Request): Promise<Response> {
  if (!requestIsSameOrigin(request)) {
    return jsonResponse(
      request,
      { detail: "Pedido bloqueado por segurança." },
      403,
      true,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonResponse(
      request,
      { detail: "Formato de pedido inválido." },
      415,
    );
  }

  let payload: LoginPayload | null;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      request,
      { detail: "Pedido de login inválido." },
      400,
    );
  }

  const username =
    typeof payload?.username === "string" ? payload.username.trim() : "";
  const password =
    typeof payload?.password === "string" ? payload.password : "";

  if (!username || !password) {
    return jsonResponse(
      request,
      { detail: "Indique o username e a password." },
      400,
    );
  }

  if (username.length > 254 || password.length > 1024) {
    return jsonResponse(
      request,
      { detail: "Dados de autenticação inválidos." },
      400,
    );
  }

  const formData = new URLSearchParams({ username, password });

  let upstreamUrl: URL;

  try {
    upstreamUrl = new URL(`${UPSTREAM_API_URL.replace(/\/$/, "")}/auth/login`);
  } catch {
    return jsonResponse(
      request,
      { detail: "Configuração do servidor inválida." },
      500,
    );
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchBackend(upstreamUrl, {
      method: "POST",
      headers: {
        ...(process.env.MIGRATION_GATE_KEY && upstreamUrl.hostname === "epic-payments-container-test.epicfitness.workers.dev" ? { "X-Migration-Key": process.env.MIGRATION_GATE_KEY } : {}),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: formData.toString(),
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return jsonResponse(
      request,
      { detail: "Não foi possível comunicar com o servidor." },
      502,
    );
  }

  const upstreamChallenge =
    upstreamResponse.headers.get("cf-mitigated") === "challenge";

  if (upstreamChallenge || upstreamResponse.status === 429) {
    console.warn("Login temporariamente bloqueado pelo backend", {
      status: upstreamResponse.status,
      challenge: upstreamChallenge,
      rayId: upstreamResponse.headers.get("cf-ray"),
    });

    return jsonResponse(
      request,
      {
        detail:
          "O serviço de autenticação está temporariamente indisponível. Tenta novamente dentro de alguns minutos.",
      },
      upstreamChallenge ? 503 : 429,
    );
  }

  if (upstreamResponse.status === 403) {
    const upstreamContentType =
      upstreamResponse.headers.get("content-type") ?? "";

    let upstreamTitle: string | null = null;
    let upstreamErrorCode: string | null = null;

    try {
      const responseText = (
        await upstreamResponse.clone().text()
      ).slice(0, 65536);

      const titleMatch = responseText.match(
        /<title\b[^>]*>([\s\S]*?)<\/title>/i,
      );

      upstreamTitle =
        titleMatch?.[1].replace(/\s+/g, " ").trim().slice(0, 160) || null;

      const plainText = responseText
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ");

      const errorMatch = plainText.match(
        /\berror(?:\s+code)?\s*:?\s*(1\d{3})\b/i,
      );

      upstreamErrorCode = errorMatch?.[1] ?? null;
    } catch {
      // O diagnóstico pode falhar sem interromper a resposta do login.
    }

    console.warn("Backend devolveu 403 no login", {
      status: upstreamResponse.status,
      workerRayId: request.headers.get("cf-ray"),
      upstreamRayId: upstreamResponse.headers.get("cf-ray"),
      upstreamMitigated: upstreamResponse.headers.get("cf-mitigated"),
      renderRequestId: upstreamResponse.headers.get("rndr-id"),
      upstreamContentType,
      upstreamTitle,
      upstreamErrorCode,
    });
  }

  if (!upstreamResponse.ok) {
    return jsonResponse(
      request,
      { detail: await errorDetail(upstreamResponse) },
      upstreamResponse.status,
      upstreamResponse.status < 500,
    );
  }

  let data: BackendLoginResponse | null;

  try {
    data = await upstreamResponse.json();
  } catch {
    return jsonResponse(
      request,
      { detail: "Resposta de autenticação inválida." },
      502,
    );
  }

  if (typeof data?.access_token !== "string" || !data.access_token) {
    return jsonResponse(
      request,
      { detail: "O servidor não devolveu uma sessão válida." },
      502,
    );
  }

  const maxAge = tokenMaxAge(data.access_token);

  if (!maxAge) {
    return jsonResponse(
      request,
      { detail: "O servidor devolveu uma sessão inválida ou expirada." },
      502,
    );
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  // O navegador recebe o JWT apenas no cookie HttpOnly.
  headers.append("Set-Cookie", sessionCookie(request, data.access_token, maxAge));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  });
}