"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  FolderOpen,
  Info,
  Lightbulb,
  PencilLine,
  RefreshCw,
  Search,
} from "lucide-react";

import { CloudflareMetrics, getCloudflareMetrics } from "@/services/system";

import "./settings-windows11.css";
import "./cloudflare-dashboard.css";


const R2_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
const D1_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const D1_ROWS_READ_DAILY_LIMIT = 5_000_000;
const D1_ROWS_WRITTEN_DAILY_LIMIT = 100_000;


function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toLocaleString("pt-PT", {
    maximumFractionDigits: 2,
  })} ${units[index]}`;
}


function formatNumber(value: number): string {
  return value.toLocaleString("pt-PT");
}


function formatApproxNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "Sem estimativa";
  }

  if (value >= 1_000_000) {
    return `≈ ${(value / 1_000_000).toLocaleString("pt-PT", {
      maximumFractionDigits: 1,
    })} milhões`;
  }

  if (value >= 1_000) {
    return `≈ ${Math.floor(value / 1000).toLocaleString("pt-PT")} mil`;
  }

  return `≈ ${Math.floor(value).toLocaleString("pt-PT")}`;
}


function getPercent(value: number, limit: number): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / limit) * 100));
}


function formatPercent(value: number): string {
  if (value < 0.01 && value > 0) return "< 0,01%";

  return `${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}


function formatDateTime(value: string | null): string {
  if (!value) return "Sem informação";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}


type DashboardCardProps = {
  variant: "r2" | "objects" | "d1" | "reads" | "writes";
  title: string;
  value: string;
  limit?: string;
  percentage?: number;
  practical: string;
  footer?: string;
};


function CardIcon({
  variant,
}: {
  variant: DashboardCardProps["variant"];
}) {
  if (variant === "r2") {
    return (
      <div className="cf-illustration cf-illustration-r2">
        <div className="cf-folder-stack">
          <span className="cf-paper cf-paper-one">
            <FileText size={24} />
          </span>

          <span className="cf-paper cf-paper-two">
            <FileText size={22} />
          </span>

          <span className="cf-folder">
            <FolderOpen size={42} />
          </span>
        </div>
      </div>
    );
  }

  if (variant === "objects") {
    return (
      <div className="cf-illustration cf-illustration-objects">
        <div className="cf-object-stack">
          <span className="cf-paper cf-paper-three">
            <FileText size={26} />
          </span>

          <span className="cf-paper cf-paper-four">
            <FileText size={24} />
          </span>

          <span className="cf-folder cf-folder-purple">
            <FolderOpen size={46} />
          </span>
        </div>
      </div>
    );
  }

  if (variant === "d1") {
    return (
      <div className="cf-illustration cf-illustration-d1">
        <div className="cf-db-stack">
          <Database size={66} />

          <span className="cf-db-mini">
            <Database size={26} />
          </span>
        </div>
      </div>
    );
  }

  if (variant === "reads") {
    return (
      <div className="cf-illustration cf-illustration-reads">
        <div className="cf-doc-action">
          <FileText size={62} />

          <span className="cf-action-circle">
            <Search size={28} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="cf-illustration cf-illustration-writes">
      <div className="cf-doc-action">
        <FileText size={62} />

        <span className="cf-action-circle">
          <PencilLine size={27} />
        </span>
      </div>
    </div>
  );
}


function DashboardCard({
  variant,
  title,
  value,
  limit,
  percentage,
  practical,
  footer,
}: DashboardCardProps) {
  const safePercentage =
    typeof percentage === "number"
      ? Math.min(100, Math.max(0, percentage))
      : null;

  return (
    <article className={`cf-card cf-card-${variant}`}>
      <div className="cf-card-main">
        <div className="cf-card-copy">
          <div className="cf-card-title-row">
            <span className="cf-card-title">
              {title}
            </span>

            <span
              className="cf-info-dot"
              title={practical}
              aria-label={`Informação sobre ${title}`}
            >
              <Info size={14} />
            </span>

            {safePercentage !== null && (
              <strong className="cf-card-percent">
                {formatPercent(safePercentage)}
              </strong>
            )}
          </div>

          <div className="cf-card-value">
            {value}
          </div>

          {limit && (
            <div className="cf-card-limit">
              {limit}
            </div>
          )}

          {safePercentage !== null && (
            <div
              className="cf-progress"
              aria-label={`${title}: ${formatPercent(
                safePercentage,
              )}`}
            >
              <div
                className="cf-progress-fill"
                style={{
                  width: `${Math.max(
                    safePercentage,
                    safePercentage > 0 ? 0.7 : 0,
                  )}%`,
                }}
              />
            </div>
          )}
        </div>

        <CardIcon variant={variant} />
      </div>

      <div className="cf-practical">
        <strong>O que significa na prática?</strong>
        <p>{practical}</p>
      </div>

      {footer && (
        <div className="cf-card-footer">
          {footer}
        </div>
      )}
    </article>
  );
}


export default function CloudflareSystem() {
  const [metrics, setMetrics] =
    useState<CloudflareMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const loadMetrics = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const data = await getCloudflareMetrics();
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
    const initialLoad = window.setTimeout(() => {
      void loadMetrics();
    }, 0);

    const interval = window.setInterval(() => {
      void loadMetrics();
    }, 60_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadMetrics]);


  const calculated = useMemo(() => {
    if (!metrics) return null;

    const r2Storage =
      metrics.r2.payload_size_bytes +
      metrics.r2.metadata_size_bytes;

    const r2Remaining = Math.max(
      0,
      R2_STORAGE_LIMIT_BYTES - r2Storage,
    );

    const averageFileSize =
      metrics.r2.object_count > 0
        ? r2Storage / metrics.r2.object_count
        : 0;

    const estimatedRemainingFiles =
      averageFileSize > 0
        ? Math.floor(r2Remaining / averageFileSize)
        : 0;

    return {
      r2Storage,
      r2Remaining,
      averageFileSize,
      estimatedRemainingFiles,

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

      rowsWrittenPercent: getPercent(
        metrics.d1.rows_written,
        D1_ROWS_WRITTEN_DAILY_LIMIT,
      ),
    };
  }, [metrics]);


  if (loading) {
    return (
      <section className="cloudflare-system cf-dashboard">
        <div className="cf-loading-state">
          <Cloud size={34} />

          <div>
            <strong>A ligar à Cloudflare</strong>
            <span>A carregar utilização de R2 e D1...</span>
          </div>
        </div>
      </section>
    );
  }


  return (
    <section className="cloudflare-system cf-dashboard">
      <div className="cf-dashboard-top">
        <div className="cf-dashboard-heading">
          <span className="cloudflare-eyebrow">
            SISTEMA
          </span>

          <h2>Cloudflare</h2>

          <p>
            Estado e utilização dos serviços R2 e D1 do
            EPIC Payments.
          </p>
        </div>

        <div
          className="cf-cloud-hero"
          aria-hidden="true"
        >
          <span className="cf-cloud-mini cf-cloud-mini-left">
            <FileText size={18} />
          </span>

          <div className="cf-cloud-shape">
            <Image
              src="/branding/logo-cloudflare.png"
              alt="Cloudflare"
              width={180}
              height={90}
              className="cf-cloud-logo"
              priority
            />
          </div>

          <span className="cf-cloud-mini cf-cloud-mini-right">
            <Database size={18} />
          </span>
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
            onClick={() => void loadMetrics(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={
                refreshing ? "cf-refresh-spin" : ""
              }
            />

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
          <div className="cf-r2-grid">
            <DashboardCard
              variant="r2"
              title="Armazenamento R2"
              value={`${formatBytes(
                calculated.r2Storage,
              )} usados`}
              limit={`Capacidade gratuita: ~10 GB • Disponível: ${formatBytes(
                calculated.r2Remaining,
              )}`}
              percentage={
                calculated.r2StoragePercent
              }
              practical={`Estes são os PDFs, XML, relatórios e outros documentos guardados pelo EPIC Payments. Neste momento estão ocupados ${formatBytes(
                calculated.r2Storage,
              )} e ainda tens aproximadamente ${formatBytes(
                calculated.r2Remaining,
              )} disponíveis dentro da capacidade gratuita de referência.`}
              footer={`Bucket: ${metrics.r2.bucket_name}`}
            />

            <DashboardCard
              variant="objects"
              title="Ficheiros armazenados"
              value={formatNumber(
                metrics.r2.object_count,
              )}
              practical={
                metrics.r2.object_count > 0
                  ? `Atualmente existem ${formatNumber(
                      metrics.r2.object_count,
                    )} ficheiros no R2. O tamanho médio é de aproximadamente ${formatBytes(
                      calculated.averageFileSize,
                    )} por ficheiro. Mantendo este tamanho médio, ainda poderias armazenar ${formatApproxNumber(
                      calculated.estimatedRemainingFiles,
                    )} ficheiros semelhantes dentro de aproximadamente 10 GB.`
                  : "Ainda não existem ficheiros suficientes para calcular o tamanho médio e estimar a capacidade restante."
              }
              footer={`Tamanho médio: ${formatBytes(
                calculated.averageFileSize,
              )} • Capacidade estimada restante: ${formatApproxNumber(
                calculated.estimatedRemainingFiles,
              )} ficheiros`}
            />
          </div>


          <div className="cf-d1-grid">
            <DashboardCard
              variant="d1"
              title="Armazenamento D1"
              value={formatBytes(
                metrics.d1.database_size_bytes,
              )}
              limit="Limite incluído: 5 GB"
              percentage={
                calculated.d1StoragePercent
              }
              practical="Espaço ocupado pela informação da base de dados, como registos, históricos e dados utilizados pelo EPIC Payments. Aumenta à medida que o sistema guarda mais informação."
              footer="Base de dados do EPIC Payments"
            />

            <DashboardCard
              variant="reads"
              title="Linhas lidas hoje"
              value={formatNumber(
                metrics.d1.rows_read,
              )}
              limit="Limite incluído: 5.000.000 / dia"
              percentage={
                calculated.rowsReadPercent
              }
              practical="Quantidade de dados que o sistema consultou hoje. Sempre que abrimos páginas, pesquisamos informação ou o sistema consulta dados, são efetuadas leituras."
              footer={`${formatNumber(
                metrics.d1.read_queries,
              )} consultas de leitura registadas.`}
            />

            <DashboardCard
              variant="writes"
              title="Linhas escritas hoje"
              value={formatNumber(
                metrics.d1.rows_written,
              )}
              limit="Limite incluído: 100.000 / dia"
              percentage={
                calculated.rowsWrittenPercent
              }
              practical="Quantidade de dados novos ou alterados hoje. Aumenta quando o sistema grava, atualiza ou adiciona informação na base de dados."
              footer={`${formatNumber(
                metrics.d1.write_queries,
              )} consultas de escrita registadas.`}
            />
          </div>


          <div className="cf-summary-card">
            <div className="cf-summary-explain">
              <span className="cf-summary-icon cf-summary-icon-light">
                <Lightbulb size={27} />
              </span>

              <div>
                <strong className="cf-summary-label">
                  Em resumo
                </strong>

                <h3>
                  R2 = ficheiros <span>•</span> D1 =
                  informação da base de dados
                </h3>

                <p>
                  No R2 tens atualmente{" "}
                  <strong>
                    {formatNumber(
                      metrics.r2.object_count,
                    )}{" "}
                    ficheiros
                  </strong>{" "}
                  a ocupar{" "}
                  <strong>
                    {formatBytes(
                      calculated.r2Storage,
                    )}
                  </strong>
                  . Mantendo o tamanho médio atual,
                  estimamos capacidade para mais{" "}
                  <strong>
                    {formatApproxNumber(
                      calculated.estimatedRemainingFiles,
                    )}{" "}
                    ficheiros semelhantes
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="cf-summary-health">
              <span className="cf-summary-icon cf-summary-icon-good">
                <CheckCircle2 size={30} />
              </span>

              <div>
                <strong>Boa notícia!</strong>

                <p>
                  Tens aproximadamente{" "}
                  <strong>
                    {formatBytes(
                      calculated.r2Remaining,
                    )}
                  </strong>{" "}
                  disponíveis no R2. A estimativa de
                  ficheiros ajusta-se automaticamente
                  conforme o tamanho médio dos documentos
                  armazenados.
                </p>
              </div>
            </div>
          </div>


          <div className="cf-dashboard-footer">
            <span>
              Atualização automática a cada 60 segundos.
            </span>

            <span>
              Medição R2:{" "}
              <strong>
                {formatDateTime(
                  metrics.r2.measured_at,
                )}
              </strong>
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