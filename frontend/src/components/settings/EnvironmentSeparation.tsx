"use client";

import {
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  Info,
  Laptop,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getEnvironmentSeparation,
  type EnvironmentSeparation as EnvironmentSeparationData,
  type EnvironmentSeparationCheck,
} from "@/services/system";


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


type CheckCardProps = {
  check: EnvironmentSeparationCheck;
  icon: React.ReactNode;
};


function CheckCard({
  check,
  icon,
}: CheckCardProps) {
  const isOk =
    check.status === "ok";

  const isInfo =
    check.status === "info";

  const color =
    isOk
      ? "#137c59"
      : isInfo
        ? "#1977c5"
        : "#b42318";

  const background =
    isOk
      ? "rgba(232,247,240,0.55)"
      : isInfo
        ? "rgba(234,244,254,0.58)"
        : "rgba(255,240,239,0.68)";

  const border =
    isOk
      ? "rgba(21,148,103,0.14)"
      : isInfo
        ? "rgba(25,119,197,0.14)"
        : "rgba(239,68,68,0.16)";

  const StatusIcon =
    isOk
      ? CheckCircle2
      : isInfo
        ? Info
        : XCircle;

  return (
    <article
      style={{
        minHeight: "122px",
        padding: "15px",
        borderRadius: "14px",
        border: `1px solid ${border}`,
        background,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "11px",
        }}
      >
        <div
          style={{
            width: "39px",
            height: "39px",
            flex: "0 0 39px",
            display: "grid",
            placeItems: "center",
            borderRadius: "11px",
            background:
              "rgba(255,255,255,0.72)",
            color,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <StatusIcon
              size={14}
              color={color}
            />

            <strong
              style={{
                color,
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {check.label}
            </strong>
          </div>

          <p
            style={{
              margin: "8px 0 0",
              color: "#657b8b",
              fontSize: "9px",
              lineHeight: 1.55,
            }}
          >
            {check.detail}
          </p>
        </div>
      </div>
    </article>
  );
}


export default function EnvironmentSeparation() {
  const [
    data,
    setData,
  ] =
    useState<
      EnvironmentSeparationData | null
    >(null);

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
  ] =
    useState<string | null>(
      null,
    );


  const loadData =
    useCallback(
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

          const result =
            await getEnvironmentSeparation();

          setData(result);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : (
                "Não foi possível verificar " +
                "a separação entre PCs e produção."
              ),
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

    const interval =
      window.setInterval(
        () => {
          void loadData();
        },
        60_000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [loadData]);


  if (loading) {
    return (
      <section
        style={{
          width:
            "min(100% - 48px, 1540px)",
          margin: "22px auto 0",
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
        A verificar separação entre PCs e produção...
      </section>
    );
  }


  const independent =
    data?.production_independent
    ?? false;

  const statusColor =
    independent
      ? "#137c59"
      : "#b42318";

  const statusBackground =
    independent
      ? "#e8f7f0"
      : "#fff0ef";

  const statusBorder =
    independent
      ? "rgba(21,148,103,0.22)"
      : "rgba(239,68,68,0.18)";

  const StatusIcon =
    independent
      ? ShieldCheck
      : TriangleAlert;


  return (
    <section
      style={{
        width:
          "min(100% - 48px, 1540px)",
        margin: "22px auto 0",
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
          justifyContent:
            "space-between",
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
            AMBIENTE E PRODUÇÃO
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
            PCs e Produção
          </h2>

          <p
            style={{
              margin: 0,
              color: "#6a7e90",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Confirma que a aplicação em produção
            não depende de ficheiros, processos ou
            armazenamento de um computador específico.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadData(true)
          }
          disabled={refreshing}
          style={{
            minHeight: "38px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            padding: "8px 13px",
            borderRadius: "10px",
            border:
              "1px solid rgba(75,107,132,0.17)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,248,253,0.96))",
            color: "#24445d",
            boxShadow:
              "0 3px 10px rgba(18,48,71,0.04)",
            cursor:
              refreshing
                ? "default"
                : "pointer",
            fontSize: "11px",
            fontWeight: 750,
          }}
        >
          <RefreshCw size={14} />

          {refreshing
            ? "A verificar..."
            : "Verificar agora"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "11px 13px",
            borderRadius: "10px",
            border:
              "1px solid rgba(239,68,68,0.16)",
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
              border:
                `1px solid ${statusBorder}`,
              background:
                statusBackground,
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
                background:
                  "rgba(255,255,255,0.68)",
                color: statusColor,
              }}
            >
              <StatusIcon
                size={24}
              />
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
                {data.summary.active_local_dependencies}
                {" "}
                dependências locais ativas
                {" · "}
                {data.summary.legacy_local_records}
                {" "}
                registos históricos locais
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <CheckCard
              check={
                data.checks.production_independent
              }
              icon={
                <Laptop size={20} />
              }
            />

            <CheckCard
              check={
                data.checks.cedis_active
              }
              icon={
                <Database size={20} />
              }
            />

            <CheckCard
              check={
                data.checks.r2
              }
              icon={
                <HardDrive size={20} />
              }
            />

            <CheckCard
              check={
                data.checks.backup
              }
              icon={
                <ShieldCheck size={20} />
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "10px",
            }}
          >
            <CheckCard
              check={
                data.checks.calendar_files
              }
              icon={
                <Server size={20} />
              }
            />

            <CheckCard
              check={
                data.checks.neon
              }
              icon={
                <Database size={20} />
              }
            />

            <CheckCard
              check={
                data.checks.d1
              }
              icon={
                <Cloud size={20} />
              }
            />

            <CheckCard
              check={
                data.checks.legacy_records
              }
              icon={
                <Info size={20} />
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                padding: "14px 15px",
                borderRadius: "13px",
                border:
                  "1px solid rgba(25,119,197,0.13)",
                background:
                  "rgba(234,244,254,0.52)",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: "#748797",
                  fontSize: "8px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                CEDIS
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  color: "#10233d",
                  fontSize: "18px",
                }}
              >
                {data.summary.cedis_active_r2}
                {" / "}
                {data.summary.cedis_active}
                {" "}
                ativa no R2
              </strong>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#657b8b",
                  fontSize: "9px",
                  lineHeight: 1.5,
                }}
              >
                {data.summary.cedis_historical_r2}
                {" "}
                históricas no R2 e
                {" "}
                {data.summary.cedis_historical_local}
                {" "}
                referências locais antigas inativas.
              </p>
            </div>

            <div
              style={{
                padding: "14px 15px",
                borderRadius: "13px",
                border:
                  "1px solid rgba(21,148,103,0.13)",
                background:
                  "rgba(232,247,240,0.52)",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: "#748797",
                  fontSize: "8px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                DEPENDÊNCIAS OPERACIONAIS
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "5px",
                  color: "#137c59",
                  fontSize: "18px",
                }}
              >
                {data.summary.active_local_dependencies}
                {" "}
                locais
              </strong>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#657b8b",
                  fontSize: "9px",
                  lineHeight: 1.5,
                }}
              >
                Produção pode continuar operacional
                sem este PC ou qualquer outro
                computador de desenvolvimento.
              </p>
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
              borderTop:
                "1px solid rgba(75,107,132,0.10)",
              color: "#8495a3",
              fontSize: "9px",
            }}
          >
            <span>
              Diagnóstico:
              {" "}
              <strong>somente leitura</strong>
            </span>

            <span>
              Atualização automática a cada
              {" "}
              60 segundos.
            </span>

            <span>
              Verificação:
              {" "}
              <strong>
                {formatDateTime(
                  data.checked_at,
                )}
              </strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
