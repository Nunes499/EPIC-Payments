import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class EpicBackend extends Container {
  defaultPort = 8000;
  sleepAfter = "10m";

  envVars = {
    DATABASE_URL: env.DATABASE_URL,
    SECRET_KEY: env.SECRET_KEY,
    R2_BUCKET_NAME: env.R2_BUCKET_NAME,
    R2_ENDPOINT_URL: env.R2_ENDPOINT_URL,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_D1_DATABASE_ID: env.CLOUDFLARE_D1_DATABASE_ID,
    CLOUDFLARE_D1_API_TOKEN: env.CLOUDFLARE_D1_API_TOKEN,
  };
}

export default {
  async fetch(request, env) {
    const key = env.MIGRATION_GATE_KEY;
    const provided = request.headers.get("X-Migration-Key");

    if (!key || !provided || provided !== key) {
      return new Response("Not Found", { status: 404 });
    }

    const container = env.EPIC_BACKEND.getByName("epic-backend");
    return container.fetch(request);
  },
};
