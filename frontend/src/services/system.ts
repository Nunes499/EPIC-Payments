export type R2Metrics = {
  bucket_name: string;
  object_count: number;
  payload_size_bytes: number;
  metadata_size_bytes: number;
  upload_count: number;
  measured_at: string | null;
};


export type D1Metrics = {
  database_id: string;
  date: string;
  rows_read: number;
  rows_written: number;
  read_queries: number;
  write_queries: number;
  database_size_bytes: number;
  measured_date: string | null;
};


export type CloudflareMetrics = {
  status: string;
  updated_at: string;
  r2: R2Metrics;
  d1: D1Metrics;
};


async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data =
      await response.json();

    if (
      data &&
      typeof data.detail ===
        "string"
    ) {
      return data.detail;
    }
  } catch {
    // Ignorar erro de leitura da resposta.
  }

  return fallback;
}


export async function getCloudflareMetrics():
Promise<CloudflareMetrics> {
  const response =
    await fetch(
      "/api/backend/system/cloudflare-metrics",
      {
        method: "GET",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível obter as métricas da Cloudflare.",
      ),
    );
  }

  return response.json();
}
