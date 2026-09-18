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
  status: "healthy" | "warning" | "error";
  checked_at: string;
  summary: CloudIntegritySummary;
  issues: CloudIntegrityIssue[];
};

export type BackupRecoveryLatest = {
  object_key: string;
  filename: string;
  size_bytes: number;
  last_modified: string;
  age_hours: number;
  etag: string;
};

export type BackupRecoveryBackup = {
  enabled: boolean;
  provider: string;
  schedule_utc: string;
  prefix: string;
  retention_days: number;
  validation: string;
  format: string;
  backup_count: number;
  latest: BackupRecoveryLatest | null;
};

export type BackupRecoveryNeon = {
  instant_restore: boolean;
  history_hours: number;
};

export type BackupRecoveryThresholds = {
  protected_max_age_hours: number;
  warning_max_age_hours: number;
};

export type BackupRecovery = {
  status: "protected" | "warning" | "overdue" | "missing" | "error";
  status_label: string;
  checked_at: string;
  error?: string;
  backup: BackupRecoveryBackup;
  neon: BackupRecoveryNeon;
  thresholds: BackupRecoveryThresholds;
};

export type EnvironmentSeparationCheck = {
  status: "ok" | "info" | "error";
  label: string;
  detail: string;
};

export type EnvironmentSeparationSummary = {
  active_local_dependencies: number;
  legacy_local_records: number;
  calendar_files_total: number;
  calendar_files_r2: number;
  calendar_files_local: number;
  cedis_total: number;
  cedis_active: number;
  cedis_active_r2: number;
  cedis_active_local: number;
  cedis_historical_r2: number;
  cedis_historical_local: number;
};

export type EnvironmentSeparationLocalRecord = {
  id: number;
  original_filename: string;
  file_path: string;
};

export type EnvironmentSeparationCalendar = {
  status: "cloud" | "local_dependency";
  total: number;
  r2: number;
  local: number;
  local_records: EnvironmentSeparationLocalRecord[];
};

export type EnvironmentSeparationCedis = {
  status: "cloud" | "local_dependency";
  total: number;
  active: number;
  active_r2: number;
  active_local: number;
  historical_r2: number;
  historical_local: number;
  active_local_records: EnvironmentSeparationLocalRecord[];
  historical_local_records: EnvironmentSeparationLocalRecord[];
};

export type EnvironmentSeparation = {
  status: "independent" | "local_dependency" | "error";
  status_label: string;
  checked_at: string;
  production_independent: boolean;
  error?: string;
  summary: EnvironmentSeparationSummary;
  checks: {
    production_independent: EnvironmentSeparationCheck;
    calendar_files: EnvironmentSeparationCheck;
    cedis_active: EnvironmentSeparationCheck;
    legacy_records: EnvironmentSeparationCheck;
    neon: EnvironmentSeparationCheck;
    r2: EnvironmentSeparationCheck;
    d1: EnvironmentSeparationCheck;
    backup: EnvironmentSeparationCheck;
  };
  details: {
    calendar: EnvironmentSeparationCalendar;
    cedis: EnvironmentSeparationCedis;
  };
};

export type CloudArchitectureService = {
  name: string;
  role: string;
  responsibility: string;
  source_of_truth: boolean;
  stores: string[];
  must_not_store: string[];
};

export type CloudArchitectureFlow = {
  name: string;
  from: string;
  to: string;
  purpose: string;
  status: "ok" | "warning" | "error";
};

export type CloudArchitectureRule = {
  id: string;
  status: "ok" | "warning" | "error";
  label: string;
  detail: string;
};

export type CloudArchitectureSummary = {
  services: number;
  flows: number;
  rules: number;
  issues: number;
  sources_of_truth: string[];
};

export type CloudArchitecture = {
  status: "compliant" | "warning" | "error";
  status_label: string;
  checked_at: string;
  architecture_ok: boolean;
  error?: string;
  summary: CloudArchitectureSummary;
  services: Record<string, CloudArchitectureService>;
  flows: CloudArchitectureFlow[];
  rules: CloudArchitectureRule[];
  issues: CloudArchitectureRule[];
};

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.detail === "string") {
      return data.detail;
    }
  } catch {
    // Ignorar erro de leitura da resposta.
  }
  return fallback;
}

export async function getCloudflareMetrics():
Promise<CloudflareMetrics> {
  const response = await fetch(
    "/api/backend/system/cloudflare-metrics",
    { method: "GET", cache: "no-store" },
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
  const response = await fetch(
    "/api/backend/system/infrastructure-health",
    { method: "GET", cache: "no-store" },
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
  const response = await fetch(
    "/api/backend/system/neon-storage-usage",
    { method: "GET", cache: "no-store" },
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
  const response = await fetch(
    "/api/backend/system/cloud-integrity",
    { method: "GET", cache: "no-store" },
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

export async function getBackupRecovery():
Promise<BackupRecovery> {
  const response = await fetch(
    "/api/backend/system/backup-recovery",
    { method: "GET", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível verificar o estado dos backups.",
      ),
    );
  }
  return response.json();
}

export async function getEnvironmentSeparation():
Promise<EnvironmentSeparation> {
  const response = await fetch(
    "/api/backend/system/environment-separation",
    { method: "GET", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível verificar a separação entre PCs e produção.",
      ),
    );
  }
  return response.json();
}

export async function getCloudArchitecture():
Promise<CloudArchitecture> {
  const response = await fetch(
    "/api/backend/system/cloud-architecture",
    { method: "GET", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "Não foi possível verificar a arquitetura cloud.",
      ),
    );
  }
  return response.json();
}
