"use client";

import {
  Cloud,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getInfrastructureHealth,
  type InfrastructureHealth as InfrastructureHealthData,
  type InfrastructureServiceHealth,
} from "@/services/system";


type ServiceCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  health: InfrastructureServiceHealth;
};


function formatLatency(
  latency: number,
): string {
  if (!Number.isFinite(latency)) {
    return "—";
  }

  if (latency < 1) {
    return "< 1 ms";
  }

  return `${Math.round(latency)} ms`;
}


function ServiceCard({
  title,
  description,
  icon,
  health,
}: ServiceCardProps) {
  const online =
    health.status === "online";

  return (
    <article
      style={{
        minHeight: "118px",
        padding: "18px",
        borderRadius: "16px",
        border:
          "1px solid rgba(75,107,132,0.13)",
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(247,252,255,0.90))",
        boxShadow:
          "0 8px 22px rgba(18,48,71,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              flex: "0 0 42px",
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              color: "#1977c5",
              border:
                "1px solid rgba(25,119,197,0.16)",
              background:
                "#eaf4fe",
            }}
          >
            {icon}
          </div>

          <div>
            <strong
              style={{
                display: "block",
                color: "#203446",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              {title}
            </strong>

            <span
              style={{
                display: "block",
                marginTop: "4px",
                color: "#748797",
                fontSize: "11px",
              }}
            >
              {description}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: online
              ? "#137c59"
              : "#b42318",
            fontSize: "11px",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: online
                ? "#22c55e"
                : "#ef4444",
              boxShadow: online
                ? "0 0 9px rgba(34,197,94,0.50)"
                : "0 0 9px rgba(239,68,68,0.50)",
            }}
          />

          {online
            ? "Online"
            : "Offline"}
        </div>
      </div>

      <div
        style={{
          marginTop: "16px",
          paddingTop: "12px",
          borderTop:
            "1px solid rgba(75,107,132,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <span
          style={{
            color: "#8192a0",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          Tempo de resposta
        </span>

        <strong
          style={{
            color: "#203446",
            fontSize: "11px",
            fontWeight: 800,
          }}
        >
          {formatLatency(
            health.latency_ms,
          )}
        </strong>
      </div>

      {!online &&
        health.error_type && (
          <div
            style={{
              marginTop: "10px",
              color: "#b42318",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            Erro: {health.error_type}
          </div>
        )}
    </article>
  );
}


export default function InfrastructureHealth() {
  const [
    health,
    setHealth,
  ] =
    useState<InfrastructureHealthData | null>(
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


  const loadHealth = useCallback(
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
          await getInfrastructureHealth();

        setHealth(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível verificar a infraestrutura.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );


  useEffect(() => {
    void loadHealth();

    const interval =
      window.setInterval(
        () => {
          void loadHealth();
        },
        60_000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [loadHealth]);


  if (loading) {
    return (
      <section
        style={{
          width:
            "min(100% - 48px, 1540px)",
          margin:
            "22px auto 0",
          padding: "22px",
          borderRadius: "17px",
          border:
            "1px solid rgba(75,107,132,0.14)",
          background:
            "linear-gradient(155deg, rgba(255,255,255,0.95), rgba(247,252,255,0.86))",
          color: "#203446",
          boxShadow:
            "0 10px 28px rgba(18,48,71,0.055)",
        }}
      >
        A verificar infraestrutura...
      </section>
    );
  }


  const healthy =
    health?.status === "healthy";


  return (
    <section
      style={{
        width:
          "min(100% - 48px, 1540px)",
        margin:
          "22px auto 0",
        padding: "22px",
        borderRadius: "17px",
        border:
          "1px solid rgba(75,107,132,0.14)",
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.96), rgba(247,252,255,0.88))",
        color: "#10233d",
        boxShadow:
          "0 10px 28px rgba(18,48,71,0.055)",
        backdropFilter:
          "blur(16px) saturate(135%)",
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
            SISTEMA
          </span>

          <h2
            style={{
              margin:
                "5px 0 4px",
              color: "#10233d",
              fontSize: "24px",
              fontWeight: 750,
              letterSpacing:
                "-0.025em",
            }}
          >
            Estado da infraestrutura
          </h2>

          <p
            style={{
              margin: 0,
              color: "#6a7e90",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Verificação em tempo real dos
            serviços essenciais do EPIC Payments.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
          }}
        >
          <div
            style={{
              minHeight: "38px",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding:
                "8px 12px",
              borderRadius: "10px",
              border: healthy
                ? "1px solid rgba(21,148,103,0.22)"
                : "1px solid rgba(239,68,68,0.22)",
              background: healthy
                ? "#e8f7f0"
                : "#fff0ef",
              color: healthy
                ? "#137c59"
                : "#b42318",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {healthy ? (
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#22c55e",
                }}
              />
            ) : (
              <TriangleAlert
                size={15}
              />
            )}

            {healthy
              ? "Sistema saudável"
              : "Sistema degradado"}
          </div>

          <button
            type="button"
            onClick={() =>
              void loadHealth(
                true,
              )
            }
            disabled={refreshing}
            style={{
              minHeight: "38px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              padding:
                "8px 13px",
              borderRadius: "10px",
              border:
                "1px solid rgba(75,107,132,0.17)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,248,253,0.96))",
              color: "#24445d",
              boxShadow:
                "0 3px 10px rgba(18,48,71,0.04)",
              cursor: refreshing
                ? "default"
                : "pointer",
              fontSize: "11px",
              fontWeight: 750,
            }}
          >
            <RefreshCw
              size={14}
            />

            {refreshing
              ? "A atualizar..."
              : "Atualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "11px 13px",
            borderRadius: "10px",
            border:
              "1px solid rgba(239,68,68,0.16)",
            background:
              "#fff0ef",
            color: "#b42318",
            fontSize: "11px",
          }}
        >
          {error}
        </div>
      )}

      {health && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          <ServiceCard
            title="Backend"
            description="Render / FastAPI"
            icon={
              <Server
                size={21}
              />
            }
            health={
              health.services.backend
            }
          />

          <ServiceCard
            title="Neon"
            description="PostgreSQL principal"
            icon={
              <Database
                size={21}
              />
            }
            health={
              health.services.neon
            }
          />

          <ServiceCard
            title="Cloudflare D1"
            description="Índice e dados auxiliares"
            icon={
              <Cloud
                size={21}
              />
            }
            health={
              health.services
                .cloudflare_d1
            }
          />

          <ServiceCard
            title="Cloudflare R2"
            description="Ficheiros e documentos"
            icon={
              <HardDrive
                size={21}
              />
            }
            health={
              health.services
                .cloudflare_r2
            }
          />
        </div>
      )}
    </section>
  );
}