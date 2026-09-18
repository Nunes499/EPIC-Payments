"use client";

import {
  Database,
  HardDrive,
  Layers3,
  RefreshCw,
  Table2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getNeonStorageUsage,
  type NeonStorageUsage as NeonStorageUsageData,
} from "@/services/system";


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
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
  );

  const value =
    bytes /
    Math.pow(1024, index);

  return `${value.toLocaleString(
    "pt-PT",
    {
      maximumFractionDigits: 2,
    },
  )} ${units[index]}`;
}


function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Sem informação";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
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


type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
};


function MetricCard({
  title,
  value,
  description,
  icon,
}: MetricCardProps) {
  return (
    <article
      style={{
        minHeight: "126px",
        padding: "17px",
        borderRadius: "15px",
        border:
          "1px solid rgba(75,107,132,0.13)",
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(247,252,255,0.90))",
        boxShadow:
          "0 7px 20px rgba(18,48,71,0.045)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
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
            border:
              "1px solid rgba(25,119,197,0.16)",
            background:
              "#eaf4fe",
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
              textTransform:
                "uppercase",
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
              letterSpacing:
                "-0.02em",
            }}
          >
            {value}
          </strong>
        </div>
      </div>

      <p
        style={{
          margin:
            "13px 0 0",
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


export default function NeonStorageUsage() {
  const [
    usage,
    setUsage,
  ] =
    useState<NeonStorageUsageData | null>(
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
  ] =
    useState<string | null>(
      null,
    );


  const loadUsage =
    useCallback(
      async (
        manualRefresh = false,
      ) => {
        try {
          if (
            manualRefresh
          ) {
            setRefreshing(
              true,
            );
          } else {
            setLoading(
              true,
            );
          }

          setError(null);

          const data =
            await getNeonStorageUsage();

          setUsage(data);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar a utilização do Neon.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );


  useEffect(() => {
    void loadUsage();

    const interval =
      window.setInterval(
        () => {
          void loadUsage();
        },
        60_000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [loadUsage]);


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
        A carregar utilização do Neon...
      </section>
    );
  }


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
          justifyContent:
            "space-between",
          alignItems:
            "flex-end",
          gap: "22px",
          flexWrap: "wrap",
          marginBottom:
            "18px",
        }}
      >
        <div>
          <span
            style={{
              color: "#0878bd",
              fontSize: "9px",
              fontWeight: 800,
              letterSpacing:
                "0.12em",
            }}
          >
            ARMAZENAMENTO
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
            Neon PostgreSQL
          </h2>

          <p
            style={{
              margin: 0,
              color: "#6a7e90",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            Utilização da base de dados principal
            do EPIC Payments.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "9px",
          }}
        >
          <div
            style={{
              minHeight: "38px",
              display: "flex",
              alignItems:
                "center",
              gap: "7px",
              padding:
                "8px 12px",
              borderRadius:
                "10px",
              border:
                "1px solid rgba(21,148,103,0.22)",
              background:
                "#e8f7f0",
              color: "#137c59",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius:
                  "999px",
                background:
                  "#22c55e",
              }}
            />

            Online
          </div>

          <button
            type="button"
            onClick={() =>
              void loadUsage(
                true,
              )
            }
            disabled={
              refreshing
            }
            style={{
              minHeight:
                "38px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              gap: "7px",
              padding:
                "8px 13px",
              borderRadius:
                "10px",
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
              fontSize:
                "11px",
              fontWeight:
                750,
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
            marginBottom:
              "16px",
            padding:
              "11px 13px",
            borderRadius:
              "10px",
            border:
              "1px solid rgba(239,68,68,0.16)",
            background:
              "#fff0ef",
            color: "#b42318",
            fontSize:
              "11px",
          }}
        >
          {error}
        </div>
      )}

      {usage && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "10px",
            }}
          >
            <MetricCard
              title="Base de dados total"
              value={formatBytes(
                usage.database_size_bytes,
              )}
              description="Espaço total ocupado pela base PostgreSQL, incluindo dados internos e estruturas do sistema."
              icon={
                <Database
                  size={21}
                />
              }
            />

            <MetricCard
              title="Dados da aplicação"
              value={formatBytes(
                usage.user_data_size_bytes,
              )}
              description="Tamanho combinado das tabelas e índices pertencentes à aplicação."
              icon={
                <HardDrive
                  size={21}
                />
              }
            />

            <MetricCard
              title="Tabelas"
              value={formatBytes(
                usage.tables_size_bytes,
              )}
              description="Espaço ocupado diretamente pelos registos guardados nas tabelas."
              icon={
                <Table2
                  size={21}
                />
              }
            />

            <MetricCard
              title="Índices"
              value={formatBytes(
                usage.indexes_size_bytes,
              )}
              description="Espaço utilizado pelos índices que aceleram pesquisas e consultas."
              icon={
                <Layers3
                  size={21}
                />
              }
            />
          </div>

          <div
            style={{
              marginTop:
                "14px",
              overflow:
                "hidden",
              borderRadius:
                "14px",
              border:
                "1px solid rgba(75,107,132,0.13)",
              background:
                "rgba(255,255,255,0.82)",
            }}
          >
            <div
              style={{
                padding:
                  "13px 15px",
                borderBottom:
                  "1px solid rgba(75,107,132,0.10)",
                background:
                  "rgba(248,252,254,0.84)",
              }}
            >
              <strong
                style={{
                  color:
                    "#203446",
                  fontSize:
                    "12px",
                  fontWeight:
                    800,
                }}
              >
                Maiores tabelas
              </strong>

              <span
                style={{
                  display:
                    "block",
                  marginTop:
                    "3px",
                  color:
                    "#7b8e9d",
                  fontSize:
                    "9px",
                }}
              >
                As estruturas que mais espaço ocupam
                atualmente no Neon.
              </span>
            </div>

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "650px",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Tabela",
                      "Dados",
                      "Índices",
                      "Total",
                    ].map(
                      (
                        title,
                      ) => (
                        <th
                          key={
                            title
                          }
                          style={{
                            padding:
                              "10px 14px",
                            textAlign:
                              "left",
                            color:
                              "#8192a0",
                            fontSize:
                              "8px",
                            fontWeight:
                              800,
                            letterSpacing:
                              "0.04em",
                            textTransform:
                              "uppercase",
                            borderBottom:
                              "1px solid rgba(75,107,132,0.09)",
                          }}
                        >
                          {
                            title
                          }
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {usage.largest_tables.map(
                    (
                      table,
                    ) => (
                      <tr
                        key={`${table.schema_name}.${table.table_name}`}
                      >
                        <td
                          style={{
                            padding:
                              "10px 14px",
                            color:
                              "#203446",
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            borderBottom:
                              "1px solid rgba(75,107,132,0.08)",
                          }}
                        >
                          {
                            table.table_name
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "10px 14px",
                            color:
                              "#60758b",
                            fontSize:
                              "10px",
                            borderBottom:
                              "1px solid rgba(75,107,132,0.08)",
                          }}
                        >
                          {formatBytes(
                            table.table_size_bytes,
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "10px 14px",
                            color:
                              "#60758b",
                            fontSize:
                              "10px",
                            borderBottom:
                              "1px solid rgba(75,107,132,0.08)",
                          }}
                        >
                          {formatBytes(
                            table.indexes_size_bytes,
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "10px 14px",
                            color:
                              "#0878bd",
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            borderBottom:
                              "1px solid rgba(75,107,132,0.08)",
                          }}
                        >
                          {formatBytes(
                            table.total_size_bytes,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: "14px",
              flexWrap: "wrap",
              marginTop:
                "12px",
              paddingTop:
                "10px",
              borderTop:
                "1px solid rgba(75,107,132,0.10)",
              color:
                "#8495a3",
              fontSize:
                "9px",
            }}
          >
            <span>
              Base:{" "}
              <strong>
                {
                  usage.database_name
                }
              </strong>
            </span>

            <span>
              Atualização automática a cada 60 segundos.
            </span>

            <span>
              Medição:{" "}
              <strong>
                {formatDateTime(
                  usage.measured_at,
                )}
              </strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}