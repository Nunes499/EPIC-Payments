"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  HardDrive,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getCloudIntegrity,
  type CloudIntegrity as CloudIntegrityData,
} from "@/services/system";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-PT");
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

type IntegrityCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
};

function IntegrityCard({
  title,
  value,
  description,
  icon,
}: IntegrityCardProps) {
  return (
    <article
      style={{
        minHeight: "126px",
        padding: "17px",
        borderRadius: "15px",
        border: "1px solid rgba(75,107,132,0.13)",
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(247,252,255,0.90))",
        boxShadow: "0 7px 20px rgba(18,48,71,0.045)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            flex: "0 0 40px",
            display: "grid",
            placeItems: "center",
            borderRadius: "11px",
            border: "1px solid rgba(25,119,197,0.16)",
            background: "#eaf4fe",
            color: "#1977c5",
          }}
        >
          {icon}
        </div>

        <div>
          <span
            style={{
              display: "block",
              color: "#748797",
              fontSize: "9px",
              fontWeight: 800,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </span>
          <strong
            style={{
              display: "block",
              marginTop: "3px",
              color: "#10233d",
              fontSize: "20px",
              fontWeight: 850,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </strong>
        </div>
      </div>

      <p
        style={{
          margin: "13px 0 0",
          color: "#718595",
          fontSize: "10px",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </article>
  );
}

export default function CloudIntegrity() {
  const [integrity, setIntegrity] =
    useState<CloudIntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIntegrity = useCallback(async (manualRefresh = false) => {
    try {
      if (manualRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setIntegrity(await getCloudIntegrity());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível verificar a integridade cloud.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrity();
    const interval = window.setInterval(() => {
      void loadIntegrity();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadIntegrity]);

  if (loading) {
    return (
      <section
        style={{
          width: "min(100% - 48px, 1540px)",
          margin: "22px auto 0",
          padding: "22px",
          borderRadius: "17px",
          border: "1px solid rgba(75,107,132,0.14)",
          background:
            "linear-gradient(155deg, rgba(255,255,255,0.95), rgba(247,252,255,0.86))",
          color: "#203446",
          boxShadow: "0 10px 28px rgba(18,48,71,0.055)",
        }}
      >
        A verificar integridade cloud...
      </section>
    );
  }

  const status = integrity?.status ?? "error";
  const healthy = status === "healthy";
  const warning = status === "warning";
  const statusLabel = healthy
    ? "Sistema íntegro"
    : warning
      ? "Avisos encontrados"
      : "Problemas encontrados";
  const StatusIcon = healthy
    ? CheckCircle2
    : warning
      ? AlertTriangle
      : XCircle;
  const statusBackground = healthy
    ? "#e8f7f0"
    : warning
      ? "#fff7df"
      : "#fff0ef";
  const statusColor = healthy
    ? "#137c59"
    : warning
      ? "#9a6700"
      : "#b42318";
  const statusBorder = healthy
    ? "rgba(21,148,103,0.22)"
    : warning
      ? "rgba(202,138,4,0.22)"
      : "rgba(239,68,68,0.18)";

  return (
    <section
      style={{
        width: "min(100% - 48px, 1540px)",
        margin: "22px auto 0",
        padding: "22px",
        borderRadius: "17px",
        border: "1px solid rgba(75,107,132,0.14)",
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.96), rgba(247,252,255,0.88))",
        color: "#10233d",
        boxShadow: "0 10px 28px rgba(18,48,71,0.055)",
        backdropFilter: "blur(16px) saturate(135%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "22px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <span
            style={{
              color: "#0878bd",
              fontSize: "9px",
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            AUDITORIA CLOUD
          </span>
          <h2
            style={{
              margin: "5px 0 4px",
              color: "#10233d",
              fontSize: "24px",
              fontWeight: 750,
              letterSpacing: "-0.025em",
            }}
          >
            Integridade Cloud
          </h2>
          <p
            style={{
              margin: 0,
              color: "#6a7e90",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Verificação de consistência entre Neon, Cloudflare R2 e D1.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadIntegrity(true)}
          disabled={refreshing}
          style={{
            minHeight: "38px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            padding: "8px 13px",
            borderRadius: "10px",
            border: "1px solid rgba(75,107,132,0.17)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,248,253,0.96))",
            color: "#24445d",
            boxShadow: "0 3px 10px rgba(18,48,71,0.04)",
            cursor: refreshing ? "default" : "pointer",
            fontSize: "11px",
            fontWeight: 750,
          }}
        >
          <RefreshCw size={14} />
          {refreshing ? "A verificar..." : "Verificar agora"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "11px 13px",
            borderRadius: "10px",
            border: "1px solid rgba(239,68,68,0.16)",
            background: "#fff0ef",
            color: "#b42318",
            fontSize: "11px",
          }}
        >
          {error}
        </div>
      )}

      {integrity && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "14px",
              padding: "16px 17px",
              borderRadius: "15px",
              border: `1px solid ${statusBorder}`,
              background: statusBackground,
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                flex: "0 0 44px",
                display: "grid",
                placeItems: "center",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.68)",
                color: statusColor,
              }}
            >
              <StatusIcon size={24} />
            </div>
            <div>
              <strong
                style={{
                  display: "block",
                  color: statusColor,
                  fontSize: "17px",
                  fontWeight: 850,
                }}
              >
                {statusLabel}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#657b8b",
                  fontSize: "10px",
                }}
              >
                {integrity.summary.errors} erros ·{" "}
                {integrity.summary.warnings} avisos ·{" "}
                {integrity.summary.missing_r2_objects} ficheiros R2 em falta
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "10px",
            }}
          >
            <IntegrityCard
              title="Cloudflare R2"
              value={`${formatNumber(integrity.summary.checked_r2_objects)} verificados`}
              description={
                integrity.summary.missing_r2_objects === 0
                  ? "Todos os objetos cloud referenciados estão disponíveis."
                  : `${formatNumber(integrity.summary.missing_r2_objects)} objetos referenciados não foram encontrados.`
              }
              icon={<HardDrive size={21} />}
            />
            <IntegrityCard
              title="Comunicação"
              value={`${formatNumber(integrity.summary.communication_rows)} registos`}
              description={`${formatNumber(integrity.summary.communication_source_files)} ficheiros de origem únicos verificados no R2.`}
              icon={<MessageSquareText size={21} />}
            />
            <IntegrityCard
              title="Índice D1"
              value={`${formatNumber(integrity.summary.d1_indexed_files)} ficheiros`}
              description={`${formatNumber(integrity.summary.d1_indexed_movements)} movimentos bancários indexados · ${formatNumber(integrity.summary.d1_index_errors)} erros.`}
              icon={<Database size={21} />}
            />
            <IntegrityCard
              title="Base CEDIS"
              value={`${formatNumber(integrity.summary.cedis_files)} versões`}
              description="Versões CEDIS registadas e respetivos objetos cloud auditados."
              icon={<FileCheck2 size={21} />}
            />
          </div>

          {integrity.issues.length > 0 && (
            <div
              style={{
                marginTop: "14px",
                overflow: "hidden",
                borderRadius: "14px",
                border: "1px solid rgba(75,107,132,0.13)",
                background: "rgba(255,255,255,0.82)",
              }}
            >
              <div
                style={{
                  padding: "13px 15px",
                  borderBottom: "1px solid rgba(75,107,132,0.10)",
                  background: "rgba(248,252,254,0.84)",
                }}
              >
                <strong
                  style={{
                    color: "#203446",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  Ocorrências encontradas
                </strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "3px",
                    color: "#7b8e9d",
                    fontSize: "9px",
                  }}
                >
                  Esta auditoria é apenas de leitura. Nenhuma correção é
                  efetuada automaticamente.
                </span>
              </div>

              {integrity.issues.map((issue, index) => {
                const isError = issue.severity === "error";
                return (
                  <div
                    key={`${issue.category}-${issue.record_id}-${index}`}
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "11px 14px",
                      borderBottom: "1px solid rgba(75,107,132,0.08)",
                    }}
                  >
                    <div
                      style={{
                        paddingTop: "1px",
                        color: isError ? "#b42318" : "#9a6700",
                      }}
                    >
                      {isError
                        ? <XCircle size={15} />
                        : <AlertTriangle size={15} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          display: "block",
                          color: "#203446",
                          fontSize: "10px",
                        }}
                      >
                        {issue.category}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          marginTop: "2px",
                          color: "#657b8b",
                          fontSize: "10px",
                          lineHeight: 1.45,
                        }}
                      >
                        {issue.message}
                      </span>
                      {issue.record_id !== null && (
                        <span
                          style={{
                            display: "block",
                            marginTop: "3px",
                            color: "#8a9aa6",
                            fontSize: "8px",
                          }}
                        >
                          Registo: {issue.record_id}
                        </span>
                      )}
                      {issue.object_key && (
                        <span
                          style={{
                            display: "block",
                            marginTop: "3px",
                            color: "#8a9aa6",
                            fontSize: "8px",
                            wordBreak: "break-all",
                          }}
                        >
                          {issue.object_key}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {integrity.issues.length === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "14px",
                padding: "11px 13px",
                borderRadius: "11px",
                border: "1px solid rgba(21,148,103,0.13)",
                background: "rgba(232,247,240,0.52)",
                color: "#137c59",
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={16} />
              Nenhuma inconsistência encontrada entre os serviços cloud
              auditados.
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap",
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid rgba(75,107,132,0.10)",
              color: "#8495a3",
              fontSize: "9px",
            }}
          >
            <span>
              Auditoria: <strong>somente leitura</strong>
            </span>
            <span>
              Atualização automática a cada 60 segundos.
            </span>
            <span>
              Verificação:{" "}
              <strong>{formatDateTime(integrity.checked_at)}</strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
