import { env } from "cloudflare:workers";

export function fetchBackend(
  url: URL,
  init: RequestInit,
): Promise<Response> {
  const bindings = env as unknown as {
    EPIC_BACKEND_SERVICE?: {
      fetch(request: Request): Promise<Response>;
    };
  };

  if (
    url.hostname ===
    "epic-payments-container-test.epicfitness.workers.dev"
  ) {
    const service = bindings.EPIC_BACKEND_SERVICE;

    if (!service) {
      throw new Error("Service Binding indisponivel");
    }

    return service.fetch(
      new Request(url.toString(), init),
    );
  }

  return fetch(url, init);
}