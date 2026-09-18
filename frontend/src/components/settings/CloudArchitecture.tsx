"use client";

import {
  CheckCircle2,
  Cloud,
  Database,
  FileArchive,
  GitBranch,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getCloudArchitecture,
  type CloudArchitecture as CloudArchitectureData,
  type CloudArchitectureRule,
  type CloudArchitectureService,
} from "@/services/system";


function formatDateTime(value: string | null): string {
  if (!value) return "Sem informação";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}


const SERVICE_ICONS: Record<string, React.ReactNode> = {
  cloudflare_workers: <Cloud size={20} />,
  render: <Server size={20} />,
  neon: <Database size={20} />,
  r2: <FileArchive size={20} />,
  d1: <Database size={20} />,
  easypay: <WalletCards size={20} />,
  github_actions: <GitBranch size={20} />,
};


type ServiceCardProps = {
  serviceKey: string;
  service: CloudArchitectureService;
};


function ServiceCard({
  serviceKey,
  service,
}: ServiceCardProps) {
  return (
    <article
      style={{
        minHeight: "154px",
        padding: "15px",
        borderRadius: "14px",
        border: service.source_of_truth
          ? "1px solid rgba(21,148,103,0.20)"
          : "1px solid rgba(75,107,132,0.13)",
        background: service.source_of_truth
          ? "linear-gradient(155deg, rgba(232,247,240,0.70), rgba(250,255,253,0.94))"
          : "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(247,252,255,0.90))",
        boxShadow: "0 7px 20px rgba(18,48,71,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            flex: "0 0 40px",
            display: "grid",
            placeItems: "center",
            borderRadius: "11px",
            background: service.source_of_truth
              ? "#e3f6ed"
              : "#eaf4fe",
            color: service.source_of_truth
              ? "#137c59"
              : "#1977c5",
          }}
        >
          {SERVICE_ICONS[serviceKey] ?? <Zap size={20} />}
        </div>

        <div style={{ minWidth: 0 }}>
          <strong
            style={{
              display: "block",
              color: "#10233d",
              fontSize: "12px",
              fontWeight: 850,
            }}
          >
            {service.name}
          </strong>

          <span
            style={{
              display: "block",
              marginTop: "2px",
              color: "#718595",
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            {service.role}
          </span>
        </div>
      </div>

      {service.source_of_truth && (
        <span
          style={{
            display: "inline-flex",
            marginTop: "10px",
            padding: "4px 7px",
            borderRadius: "999px",
            background: "#dff5ea",
            color: "#137c59",
            fontSize: "8px",
            fontWeight: 850,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Fonte de verdade
        </span>
      )}

      <p
        style={{
          margin: "10px 0 0",
          color: "#657b8b",
          fontSize: "9px",
          lineHeight: 1.55,
        }}
      >
        {service.responsibility}
      </p>
    </article>
  );
}


function RuleCard({
  rule,
}: {
  rule: CloudArchitectureRule;
}) {
  const ok = rule.status === "ok";
  const warning = rule.status === "warning";

  const color = ok
    ? "#137c59"
    : warning
      ? "#9a6700"
      : "#b42318";

  const Icon = ok
    ? CheckCircle2
    : warning
      ? TriangleAlert
      : XCircle;

  return (
    <div
      style={{
        padding: "12px 13px",
        borderRadius: "12px",
        border: ok
          ? "1px solid rgba(21,148,103,0.13)"
          : warning
            ? "1px solid rgba(202,138,4,0.16)"
            : "1px solid rgba(239,68,68,0.16)",
        background: ok
          ? "rgba(232,247,240,0.48)"
          : warning
            ? "rgba(255,247,223,0.60)"
            : "rgba(255,240,239,0.65)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          color,
        }}
      >
        <Icon size={14} />

        <strong
          style={{
            fontSize: "10px",
            fontWeight: 800,
          }}
        >
          {rule.label}
        </strong>
      </div>

      <p
        style={{
          margin: "6px 0 0 21px",
          color: "#657b8b",
          fontSize: "9px",
          lineHeight: 1.5,
        }}
      >
        {rule.detail}
      </p>
    </div>
  );
}


export default function CloudArchitecture() {
  const [data, setData] =
    useState<CloudArchitectureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);
        setData(await getCloudArchitecture());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível verificar a arquitetura cloud.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadData();

    const interval = window.setInterval(
      () => void loadData(),
      60_000,
    );

    return () => window.clearInterval(interval);
  }, [loadData]);

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
        A verificar arquitetura cloud...
      </section>
    );
  }

  const compliant = data?.architecture_ok ?? false;
  const statusColor = compliant ? "#137c59" : "#b42318";
  const statusBackground = compliant ? "#e8f7f0" : "#fff0ef";
  const statusBorder = compliant
    ? "rgba(21,148,103,0.22)"
    : "rgba(239,68,68,0.18)";
  const StatusIcon = compliant ? ShieldCheck : TriangleAlert;

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
            ARQUITETURA CLOUD
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
            Arquitetura da Plataforma
          </h2>

          <p
            style={{
              margin: 0,
              color: "#6a7e90",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Responsabilidades, fontes de verdade e fluxos
            definidos para evitar duplicações e dependências
            desnecessárias.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
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

      {data && (
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
                {data.status_label}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#657b8b",
                  fontSize: "10px",
                }}
              >
                {data.summary.services} serviços ·{" "}
                {data.summary.flows} fluxos ·{" "}
                {data.summary.rules} regras ·{" "}
                {data.summary.issues} problemas
              </span>
            </div>
          </div>

          <div
            style={{
              marginBottom: "14px",
              padding: "15px",
              borderRadius: "14px",
              border: "1px solid rgba(25,119,197,0.13)",
              background: "rgba(234,244,254,0.46)",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: "10px",
                color: "#748797",
                fontSize: "8px",
                fontWeight: 850,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Fluxo principal
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                flexWrap: "wrap",
                color: "#24445d",
                fontSize: "10px",
                fontWeight: 750,
              }}
            >
              <span>Cloudflare Workers</span>
              <span>→</span>
              <span>Render / FastAPI</span>
              <span>→</span>
              <span>Neon</span>
              <span>·</span>
              <span>R2</span>
              <span>·</span>
              <span>D1</span>
              <span>·</span>
              <span>Easypay</span>
            </div>

            <div
              style={{
                marginTop: "8px",
                textAlign: "center",
                color: "#657b8b",
                fontSize: "9px",
              }}
            >
              GitHub Actions → backup Neon validado → R2
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "10px",
            }}
          >
            {Object.entries(data.services).map(
              ([key, service]) => (
                <ServiceCard
                  key={key}
                  serviceKey={key}
                  service={service}
                />
              ),
            )}
          </div>

          <div
            style={{
              marginTop: "14px",
              padding: "15px",
              borderRadius: "14px",
              border: "1px solid rgba(75,107,132,0.11)",
              background: "rgba(248,252,254,0.70)",
            }}
          >
            <span
              style={{
                display: "block",
                marginBottom: "10px",
                color: "#748797",
                fontSize: "8px",
                fontWeight: 850,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Regras arquiteturais
            </span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "8px",
              }}
            >
              {data.rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                />
              ))}
            </div>
          </div>

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
              Fontes de verdade:{" "}
              <strong>
                {data.summary.sources_of_truth
                  .map((key) => data.services[key]?.name ?? key)
                  .join(" + ")}
              </strong>
            </span>

            <span>
              Diagnóstico: <strong>somente leitura</strong>
            </span>

            <span>
              Verificação:{" "}
              <strong>{formatDateTime(data.checked_at)}</strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
