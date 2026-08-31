import { getToken } from "@/services/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


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
    const data = await response.json();

    if (
      data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    // Ignorar erro de leitura da resposta.
  }

  return fallback;
}


export async function getCloudflareMetrics(): Promise<CloudflareMetrics> {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Sessão não encontrada. Inicie sessão novamente.",
    );
  }

  const response = await fetch(
    `${API_URL}/system/cloudflare-metrics`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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