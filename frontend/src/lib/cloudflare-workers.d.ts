declare module "cloudflare:workers" {
  export const env: {
    EPIC_BACKEND_SERVICE: {
      fetch(request: Request): Promise<Response>;
    };
  };
}
