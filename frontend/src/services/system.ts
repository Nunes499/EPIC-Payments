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


export type InfrastructureServiceHealth = {
  status: "online" | "offline";
  latency_ms: number;
  error_type?: string;
};


export type InfrastructureHealth = {
  status: "healthy" | "degraded";
  checked_at: string;
  services: {
    backend: InfrastructureServiceHealth;
    neon: InfrastructureServiceHealth;
    cloudflare_d1: InfrastructureServiceHealth;
    cloudflare_r2: InfrastructureServiceHealth;
  };
};


export type NeonTableStorage = {
  schema_name: string;
  table_name: string;
  table_size_bytes: number;
  indexes_size_bytes: number;
  total_size_bytes: number;
};


export type NeonStorageUsage = {
  status: string;
  measured_at: string;
  database_name: string;
  database_size_bytes: number;
  storage_limit_bytes: number;
  storage_remaining_bytes: number;
  storage_used_percent: number;
  tables_size_bytes: number;
  indexes_size_bytes: number;
  user_data_size_bytes: number;
  largest_tables: NeonTableStorage[];
};


export type CloudIntegrityIssue = {
  category: string;
  severity: "error" | "warning";
  message: string;
  record_id: number | null;
  object_key: string | null;
};


export type CloudIntegritySummary = {
  errors: number;
  warnings: number;
  issues: number;
  checked_r2_objects: number;
  missing_r2_objects: number;
  calendar_files_neon: number;
  cedis_files: number;
  daily_reports: number;
  communication_rows: number;
  communication_source_files: number;
  d1_indexed_files: number;
  d1_indexed_movements: number;
  d1_index_errors: number;
};


export type CloudIntegrity = {
  status:
    | "healthy"
    | "warning"
    | "error";
  checked_at: string;
  summary: CloudIntegritySummary;
  issues: CloudIntegrityIssue[];
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


export async function getInfrastructureHealth():
Promise<InfrastructureHealth> {
  const response =
    await fetch(
      "/api/backend/system/infrastructure-health",
      {
        method: "GET",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível verificar o estado da infraestrutura.",
      ),
    );
  }

  return response.json();
}


export async function getNeonStorageUsage():
Promise<NeonStorageUsage> {
  const response =
    await fetch(
      "/api/backend/system/neon-storage-usage",
      {
        method: "GET",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível obter a utilização de armazenamento do Neon.",
      ),
    );
  }

  return response.json();
}


export async function getCloudIntegrity():
Promise<CloudIntegrity> {
  const response =
    await fetch(
      "/api/backend/system/cloud-integrity",
      {
        method: "GET",
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível verificar a integridade cloud.",
      ),
    );
  }

  return response.json();
}