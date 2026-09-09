"use client";

import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "@/components/layout/AppLayout";

import {
  getPayments,
  refreshPayment,
  refreshPendingPayments,
  type PaymentReferenceItem,
} from "@/services/payments";

import styles from "./page.module.css";


type StatusFilter =
  | "all"
  | "pending"
  | "paid"
  | "expired"
  | "failed";


function formatMoney(
  value: number,
): string {
  return new Intl.NumberFormat(
    "pt-PT",
    {
      style: "currency",
      currency: "EUR",
    },
  ).format(value);
}


function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "pt-PT",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}


function statusLabel(
  status: string,
): string {
  switch (
    status.toLowerCase()
  ) {
    case "paid":
      return "Pago";

    case "expired":
      return "Expirado";

    case "failed":
    case "error":
      return "Falhou";

    case "deleted":
      return "Eliminado";

    case "voided":
      return "Anulado";

    case "authorised":
      return "Autorizado";

    case "active":
    case "pending":
    default:
      return "Pendente";
  }
}


function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toLowerCase();

  if (
    normalized === "paid"
  ) {
    return (
      <span
        className={`${styles.status} ${styles.statusPaid}`}
      >
        <CheckCircle2
          size={14}
        />
        Pago
      </span>
    );
  }

  if (
    normalized === "expired"
  ) {
    return (
      <span
        className={`${styles.status} ${styles.statusExpired}`}
      >
        <Clock3
          size={14}
        />
        Expirado
      </span>
    );
  }

  if (
    [
      "failed",
      "error",
      "deleted",
      "voided",
    ].includes(
      normalized
    )
  ) {
    return (
      <span
        className={`${styles.status} ${styles.statusFailed}`}
      >
        <XCircle
          size={14}
        />
        {statusLabel(
          normalized
        )}
      </span>
    );
  }

  return (
    <span
      className={`${styles.status} ${styles.statusPending}`}
    >
      <Clock3
        size={14}
      />
      Pendente
    </span>
  );
}


export default function PagamentosPage() {
  const [
    items,
    setItems,
  ] = useState<
    PaymentReferenceItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    refreshingId,
    setRefreshingId,
  ] = useState<
    number | null
  >(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>(
    "all"
  );

  const [
    lastUpdateMessage,
    setLastUpdateMessage,
  ] = useState("");


  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const data =
          await getPayments(
            statusFilter,
            search,
          );

        setItems(
          data
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os pagamentos.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      statusFilter,
      search,
    ],
  );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load();
        },
        search ? 250 : 0,
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [load, search]);


  const counts =
    useMemo(
      () => {
        const result = {
          total:
            items.length,
          paid: 0,
          pending: 0,
          expired: 0,
        };

        for (
          const item
          of items
        ) {
          if (
            item.display_status
            === "paid"
          ) {
            result.paid += 1;
          } else if (
            item.display_status
            === "expired"
          ) {
            result.expired += 1;
          } else {
            result.pending += 1;
          }
        }

        return result;
      },
      [items],
    );


  async function handleRefreshPending() {
    if (
      refreshing
    ) {
      return;
    }

    setRefreshing(true);
    setError("");
    setLastUpdateMessage(
      ""
    );

    try {
      const result =
        await refreshPendingPayments();

      setLastUpdateMessage(
        `${result.checked} referência(s) verificadas · `
        + `${result.updated} atualizada(s)`
        + (
          result.failed
            ? ` · ${result.failed} falha(s)`
            : ""
        ),
      );

      await load();
    } catch (
      refreshError
    ) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível atualizar os estados.",
      );
    } finally {
      setRefreshing(false);
    }
  }


  async function handleRefreshOne(
    item: PaymentReferenceItem,
  ) {
    if (
      refreshingId !== null
    ) {
      return;
    }

    setRefreshingId(
      item.id
    );
    setError("");

    try {
      await refreshPayment(
        item.id
      );

      await load();
    } catch (
      refreshError
    ) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Não foi possível atualizar a referência.",
      );
    } finally {
      setRefreshingId(
        null
      );
    }
  }


  return (
    <AppLayout hideHeader>
      <main
        className={
          styles.page
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <span
              className={
                styles.kicker
              }
            >
              EPIC PAYMENTS
            </span>

            <h1>
              Pagamentos
            </h1>

            <p>
              Acompanhe o estado das referências Multibanco
              criadas no EPIC Payments.
            </p>
          </div>

          <button
            type="button"
            className={
              styles.refreshButton
            }
            onClick={
              () =>
                void handleRefreshPending()
            }
            disabled={
              refreshing
            }
          >
            {refreshing ? (
              <Loader2
                size={17}
                className={
                  styles.spin
                }
              />
            ) : (
              <RefreshCw
                size={17}
              />
            )}

            {refreshing
              ? "A verificar..."
              : "Atualizar estados"}
          </button>
        </header>

        <section
          className={
            styles.summary
          }
        >
          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.iconBlue
              }
            >
              <CreditCard
                size={22}
              />
            </div>

            <div>
              <span>
                REFERÊNCIAS
              </span>

              <strong>
                {counts.total}
              </strong>
            </div>
          </article>

          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.iconGreen
              }
            >
              <CheckCircle2
                size={22}
              />
            </div>

            <div>
              <span>
                PAGAS
              </span>

              <strong>
                {counts.paid}
              </strong>
            </div>
          </article>

          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.iconAmber
              }
            >
              <Clock3
                size={22}
              />
            </div>

            <div>
              <span>
                PENDENTES
              </span>

              <strong>
                {counts.pending}
              </strong>
            </div>
          </article>

          <article
            className={
              styles.summaryCard
            }
          >
            <div
              className={
                styles.iconRed
              }
            >
              <XCircle
                size={22}
              />
            </div>

            <div>
              <span>
                EXPIRADAS
              </span>

              <strong>
                {counts.expired}
              </strong>
            </div>
          </article>
        </section>

        <section
          className={
            styles.filters
          }
        >
          <div
            className={
              styles.searchBox
            }
          >
            <Search
              size={16}
            />

            <input
              value={search}
              onChange={
                (event) =>
                  setSearch(
                    event.target.value
                  )
              }
              placeholder="Pesquisar sócio, nome, entidade ou referência..."
            />
          </div>

          <div
            className={
              styles.filterButtons
            }
          >
            {(
              [
                ["all", "Todos"],
                ["pending", "Pendentes"],
                ["paid", "Pagos"],
                ["expired", "Expirados"],
                ["failed", "Falhados"],
              ] as const
            ).map(
              ([
                value,
                label,
              ]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    statusFilter
                    === value
                      ? styles.filterActive
                      : ""
                  }
                  onClick={
                    () =>
                      setStatusFilter(
                        value
                      )
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </section>

        {lastUpdateMessage ? (
          <div
            className={
              styles.infoMessage
            }
          >
            <CheckCircle2
              size={16}
            />
            {lastUpdateMessage}
          </div>
        ) : null}

        {error ? (
          <div
            className={
              styles.errorMessage
            }
          >
            <CircleAlert
              size={17}
            />
            {error}
          </div>
        ) : null}

        <section
          className={
            styles.tableCard
          }
        >
          {loading ? (
            <div
              className={
                styles.loading
              }
            >
              <Loader2
                size={24}
                className={
                  styles.spin
                }
              />

              A carregar pagamentos...
            </div>
          ) : items.length === 0 ? (
            <div
              className={
                styles.empty
              }
            >
              <CreditCard
                size={34}
              />

              <strong>
                Ainda não existem referências para mostrar.
              </strong>

              <span>
                As novas referências criadas no EPIC Payments
                passam a aparecer automaticamente aqui.
              </span>
            </div>
          ) : (
            <div
              className={
                styles.tableScroll
              }
            >
              <table>
                <thead>
                  <tr>
                    <th>
                      Nº SÓCIO
                    </th>
                    <th>
                      NOME
                    </th>
                    <th>
                      VALOR
                    </th>
                    <th>
                      ENTIDADE
                    </th>
                    <th>
                      REFERÊNCIA
                    </th>
                    <th>
                      CRIADA EM
                    </th>
                    <th>
                      VALIDADE
                    </th>
                    <th>
                      ESTADO
                    </th>
                    <th>
                      PAGO EM
                    </th>
                    <th>
                      COLABORADOR
                    </th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td
                          className={
                            styles.member
                          }
                        >
                          {item.member_number || "—"}
                        </td>

                        <td>
                          {item.member_name || "—"}
                        </td>

                        <td
                          className={
                            styles.money
                          }
                        >
                          {formatMoney(
                            item.value
                          )}
                        </td>

                        <td>
                          {item.entity}
                        </td>

                        <td
                          className={
                            styles.reference
                          }
                        >
                          {item.reference}
                        </td>

                        <td>
                          {formatDateTime(
                            item.created_at
                          )}
                        </td>

                        <td>
                          {formatDateTime(
                            item.expires_at
                          )}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              item.display_status
                            }
                          />
                        </td>

                        <td>
                          {formatDateTime(
                            item.paid_at
                          )}
                        </td>

                        <td>
                          {item.created_by_name || "—"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              styles.rowRefresh
                            }
                            title="Consultar esta referência na Easypay"
                            onClick={
                              () =>
                                void handleRefreshOne(
                                  item
                                )
                            }
                            disabled={
                              refreshingId
                              !== null
                            }
                          >
                            {refreshingId
                            === item.id ? (
                              <Loader2
                                size={15}
                                className={
                                  styles.spin
                                }
                              />
                            ) : (
                              <RefreshCw
                                size={15}
                              />
                            )}
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  );
}
