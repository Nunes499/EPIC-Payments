"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CloudflareMetrics,
  getCloudflareMetrics,
} from "@/services/system";


const R2_STORAGE_LIMIT_BYTES =
  10 * 1024 * 1024 * 1024;

const D1_STORAGE_LIMIT_BYTES =
  5 * 1024 * 1024 * 1024;

const D1_ROWS_READ_DAILY_LIMIT =
  5_000_000;

const D1_ROWS_WRITTEN_DAILY_LIMIT =
  100_000;


function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) / Math.log(1024),
    ),
    units.length - 1,
  );

  const value =
    bytes / Math.pow(1024, index);

  return `${value.toLocaleString(
    "pt-PT",
    {
      maximumFractionDigits: 2,
    },
  )} ${units[index]}`;
}


function formatNumber(value: number): string {
  return value.toLocaleString("pt-PT");
}


function getPercent(
  value: number,
  limit: number,
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      (value / limit) * 100,
    ),
  );
}


function formatPercent(
  value: number,
): string {
  if (value < 0.01 && value > 0) {
    return "< 0,01%";
  }

  return `${value.toLocaleString(
    "pt-PT",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  )}%`;
}


function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Sem informação";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    "pt-PT",
    {
      dateStyle: "short",
      timeStyle: "medium",
    },
  );
}


type UsageCardProps = {
  title: string;
  value: string;
  limit?: string;
  percentage?: number;
  description: string;
};


function UsageCard({
  title,
  value,
  limit,
  percentage,
  description,
}: UsageCardProps) {
  const safePercentage =
    typeof percentage === "number"
      ? Math.min(
          100,
          Math.max(0, percentage),
        )
      : null;

  return (
    <article className="cloudflare-usage-card">
      <div className="cloudflare-usage-card-header">
        <span>{title}</span>

        {safePercentage !== null && (
          <strong>
            {formatPercent(
              safePercentage,
            )}
          </strong>
        )}
      </div>

      <div className="cloudflare-usage-value">
        {value}
      </div>

      {limit && (
        <div className="cloudflare-usage-limit">
          Limite incluído: {limit}
        </div>
      )}

      {safePercentage !== null && (
        <div
          className="cloudflare-progress"
          aria-label={`${title}: ${formatPercent(
            safePercentage,
          )}`}
        >
          <div
            className="cloudflare-progress-fill"
            style={{
              width: `${safePercentage}%`,
            }}
          />
        </div>
      )}

      <p>{description}</p>
    </article>
  );
}


export default function CloudflareSystem() {
  const [
    metrics,
    setMetrics,
  ] =
    useState<CloudflareMetrics | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );


  const loadMetrics = useCallback(
    async (
      manualRefresh = false,
    ) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const data =
          await getCloudflareMetrics();

        setMetrics(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar as métricas.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );


 useEffect(() => {
  const initialLoad =
    window.setTimeout(() => {
      void loadMetrics();
    }, 0);

  const interval =
    window.setInterval(
      () => {
        void loadMetrics();
      },
      60_000,
    );

  return () => {
    window.clearTimeout(initialLoad);
    window.clearInterval(interval);
  };
}, [loadMetrics]);


  const calculated = useMemo(
    () => {
      if (!metrics) {
        return null;
      }

      const r2Storage =
        metrics.r2.payload_size_bytes +
        metrics.r2.metadata_size_bytes;

      return {
        r2Storage,
        r2StoragePercent: getPercent(
          r2Storage,
          R2_STORAGE_LIMIT_BYTES,
        ),
        d1StoragePercent: getPercent(
          metrics.d1.database_size_bytes,
          D1_STORAGE_LIMIT_BYTES,
        ),
        rowsReadPercent: getPercent(
          metrics.d1.rows_read,
          D1_ROWS_READ_DAILY_LIMIT,
        ),
        rowsWrittenPercent:
          getPercent(
            metrics.d1.rows_written,
            D1_ROWS_WRITTEN_DAILY_LIMIT,
          ),
      };
    },
    [metrics],
  );


  if (loading) {
    return (
      <section className="cloudflare-system">
        <div className="cloudflare-loading">
          A carregar métricas da Cloudflare...
        </div>
      </section>
    );
  }


  return (
    <section className="cloudflare-system">
      <div className="cloudflare-system-header">
        <div>
          <span className="cloudflare-eyebrow">
            SISTEMA
          </span>

          <h2>
            Cloudflare
          </h2>

          <p>
            Estado e utilização dos serviços
            R2 e D1 do EPIC Payments.
          </p>
        </div>

        <div className="cloudflare-system-actions">
          <div
            className={`cloudflare-status ${
              metrics?.status === "online"
                ? "is-online"
                : ""
            }`}
          >
            <span />

            {metrics?.status === "online"
              ? "Online"
              : "Indisponível"}
          </div>

          <button
            type="button"
            onClick={() =>
              void loadMetrics(true)
            }
            disabled={refreshing}
          >
            {refreshing
              ? "A atualizar..."
              : "Atualizar"}
          </button>
        </div>
      </div>


      {error && (
        <div className="cloudflare-error">
          {error}
        </div>
      )}


      {metrics && calculated && (
        <>
          <div className="cloudflare-service-block">
            <div className="cloudflare-service-title">
              <div>
                <span className="cloudflare-service-badge">
                  R2
                </span>

                <div>
                  <h3>
                    Armazenamento de ficheiros
                  </h3>

                  <p>
                    Bucket:{" "}
                    <strong>
                      {metrics.r2.bucket_name}
                    </strong>
                  </p>
                </div>
              </div>

              <span className="cloudflare-measured">
                Medição:{" "}
                {formatDateTime(
                  metrics.r2.measured_at,
                )}
              </span>
            </div>

            <div className="cloudflare-grid">
              <UsageCard
                title="Armazenamento R2"
                value={formatBytes(
                  calculated.r2Storage,
                )}
                limit="10 GB"
                percentage={
                  calculated.r2StoragePercent
                }
                description="Espaço ocupado pelos ficheiros e respetivos metadados."
              />

              <UsageCard
                title="Objetos"
                value={formatNumber(
                  metrics.r2.object_count,
                )}
                description="Número atual de objetos guardados no bucket."
              />
            </div>
          </div>


          <div className="cloudflare-service-block">
            <div className="cloudflare-service-title">
              <div>
                <span className="cloudflare-service-badge">
                  D1
                </span>

                <div>
                  <h3>
                    Base de dados
                  </h3>

                  <p>
                    Utilização diária e
                    armazenamento.
                  </p>
                </div>
              </div>

              <span className="cloudflare-measured">
                Dia:{" "}
                {metrics.d1.measured_date ??
                  metrics.d1.date}
              </span>
            </div>

            <div className="cloudflare-grid cloudflare-grid-three">
              <UsageCard
                title="Armazenamento D1"
                value={formatBytes(
                  metrics.d1
                    .database_size_bytes,
                )}
                limit="5 GB"
                percentage={
                  calculated.d1StoragePercent
                }
                description="Tamanho atual da base de dados."
              />

              <UsageCard
                title="Linhas lidas hoje"
                value={formatNumber(
                  metrics.d1.rows_read,
                )}
                limit="5.000.000 / dia"
                percentage={
                  calculated.rowsReadPercent
                }
                description={`${formatNumber(
                  metrics.d1.read_queries,
                )} consultas de leitura registadas.`}
              />

              <UsageCard
                title="Linhas escritas hoje"
                value={formatNumber(
                  metrics.d1.rows_written,
                )}
                limit="100.000 / dia"
                percentage={
                  calculated.rowsWrittenPercent
                }
                description={`${formatNumber(
                  metrics.d1.write_queries,
                )} consultas de escrita registadas.`}
              />
            </div>
          </div>


          <div className="cloudflare-system-footer">
            <span>
              Atualização automática a cada
              60 segundos.
            </span>

            <span>
              Última consulta:{" "}
              <strong>
                {formatDateTime(
                  metrics.updated_at,
                )}
              </strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}