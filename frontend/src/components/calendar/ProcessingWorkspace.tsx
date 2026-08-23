"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers3,
  Loader2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  processCalendarFile,
  type ApiBankFileProcessing,
} from "@/services/calendarFiles";

import type {
  CalendarFile,
  ProcessingSelection,
} from "./calendar-types";

import "./processing.css";

type ProcessingWorkspaceProps = {
  selection: ProcessingSelection | null;
  onClose: () => void;
};

type ProcessingFileState = {
  file: CalendarFile;
  loading: boolean;
  error: string | null;
  data: ApiBankFileProcessing | null;
};

function getFileIcon(
  file: CalendarFile,
) {
  if (file.type === "report") {
    return FileSpreadsheet;
  }

  return FileText;
}

function formatCurrency(
  value: string | number,
): string {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  if (Number.isNaN(numericValue)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "pt-PT",
    {
      style: "currency",
      currency: "EUR",
    },
  ).format(numericValue);
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const parts =
    value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function ProcessingWorkspace({
  selection,
  onClose,
}: ProcessingWorkspaceProps) {
  const [
    fileStates,
    setFileStates,
  ] = useState<ProcessingFileState[]>(
    [],
  );

  useEffect(() => {
    if (!selection) {
      setFileStates([]);
      return;
    }

    const initialStates =
      selection.files.map(
        (file) => ({
          file,
          loading:
            file.type === "xml",
          error: null,
          data: null,
        }),
      );

    setFileStates(
      initialStates,
    );

    let cancelled = false;

    async function loadFiles() {
      const results =
        await Promise.all(
          selection!.files.map(
            async (file) => {
              if (
                file.type !== "xml"
              ) {
                return {
                  file,
                  loading: false,
                  error:
                    "A leitura de PDF será ligada numa etapa seguinte.",
                  data: null,
                } satisfies ProcessingFileState;
              }

              try {
                const data =
                  await processCalendarFile(
                    file.id,
                  );

                return {
                  file,
                  loading: false,
                  error: null,
                  data,
                } satisfies ProcessingFileState;
              } catch (error) {
                return {
                  file,
                  loading: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Não foi possível processar o ficheiro.",
                  data: null,
                } satisfies ProcessingFileState;
              }
            },
          ),
        );

      if (!cancelled) {
        setFileStates(
          results,
        );
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [selection]);

  const totals =
    useMemo(() => {
      let movements = 0;
      let amount = 0;

      for (
        const item
        of fileStates
      ) {
        if (!item.data) {
          continue;
        }

        movements +=
          item.data.parsed_transactions;

        amount +=
          Number(
            item.data.parsed_total_amount,
          );
      }

      return {
        movements,
        amount,
      };
    }, [fileStates]);

  if (!selection) {
    return null;
  }

  const pdfCount =
    selection.files.filter(
      (file) =>
        file.type === "pdf",
    ).length;

  const xmlCount =
    selection.files.filter(
      (file) =>
        file.type === "xml",
    ).length;

  const hasLoadedMovements =
    totals.movements > 0;

  return (
    <div className="processing-workspace">
      <header className="processing-workspace-topbar">
        <div className="processing-workspace-title">
          <button
            type="button"
            className="processing-back-button"
            onClick={onClose}
          >
            <ArrowLeft size={18} />
            Voltar ao calendário
          </button>

          <div>
            <span className="section-label">
              EPIC Payments
            </span>

            <h1>
              Processamento bancário
            </h1>

            <p>
              {formatDate(
                selection.date,
              )}
            </p>
          </div>
        </div>

        <div className="processing-workspace-status">
          <span>
            <Layers3 size={16} />
            {selection.files.length} ficheiro
            {selection.files.length === 1
              ? ""
              : "s"}
          </span>
        </div>
      </header>

      <main className="processing-workspace-content">
        <section className="processing-summary-grid">
          <article className="processing-summary-card">
            <span>
              Ficheiros selecionados
            </span>

            <strong>
              {selection.files.length}
            </strong>
          </article>

          <article className="processing-summary-card">
            <span>
              PDF
            </span>

            <strong>
              {pdfCount}
            </strong>
          </article>

          <article className="processing-summary-card">
            <span>
              XML
            </span>

            <strong>
              {xmlCount}
            </strong>
          </article>

          <article className="processing-summary-card">
            <span>
              Movimentos
            </span>

            <strong>
              {totals.movements}
            </strong>

            <small>
              {totals.movements > 0
                ? formatCurrency(
                    totals.amount,
                  )
                : "A aguardar leitura"}
            </small>
          </article>
        </section>

        <section className="processing-toolbar">
          <div>
            <span className="section-label">
              Ficheiros em processamento
            </span>

            <h2>
              Todos os movimentos apresentados por ficheiro
            </h2>

            <p>
              Nesta fase são apresentados todos os movimentos do XML,
              incluindo pagamentos aceites e rejeitados.
            </p>
          </div>

          <button
            type="button"
            className="processing-filter-button"
            disabled={!hasLoadedMovements}
            title={
              hasLoadedMovements
                ? "Filtragem será implementada na próxima etapa"
                : "Disponível depois de carregar os movimentos"
            }
          >
            <Filter size={17} />
            Filtrar sócios
          </button>
        </section>

        <div className="processing-file-groups">
          {fileStates.map(
            (
              state,
              index,
            ) => {
              const Icon =
                getFileIcon(
                  state.file,
                );

              return (
                <section
                  key={state.file.id}
                  className="processing-file-group"
                >
                  <header className="processing-file-group-header">
                    <div className="processing-file-heading">
                      <span className="processing-file-index">
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>

                      <span className="processing-file-type-icon">
                        <Icon size={20} />
                      </span>

                      <div>
                        <h3>
                          {state.file.name}
                        </h3>

                        <p>
                          {state.file.type.toUpperCase()}

                          {state.file.size
                            ? ` · ${state.file.size}`
                            : ""}

                          {state.data
                            ? ` · ${state.data.parsed_transactions} movimentos · ${formatCurrency(
                                state.data.parsed_total_amount,
                              )}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {state.loading ? (
                      <span className="processing-file-state processing-file-state-loading">
                        <Loader2
                          size={13}
                          className="processing-spinner"
                        />
                        A ler ficheiro
                      </span>
                    ) : null}

                    {!state.loading &&
                    state.data ? (
                      <span className="processing-file-state processing-file-state-success">
                        <CheckCircle2 size={13} />
                        Leitura concluída
                      </span>
                    ) : null}

                    {!state.loading &&
                    state.error ? (
                      <span className="processing-file-state processing-file-state-warning">
                        <AlertTriangle size={13} />
                        Leitura indisponível
                      </span>
                    ) : null}
                  </header>

                  <div className="processing-table-shell">
                    <div className="processing-table-head">
                      <span>Nº Sócio</span>
                      <span>Nome</span>
                      <span>Valor</span>
                      <span>Motivo</span>
                      <span>Telemóvel</span>
                      <span>Email</span>
                      <span>Nascimento</span>
                    </div>

                    {state.loading ? (
                      <div className="processing-empty-table">
                        <Loader2
                          size={26}
                          className="processing-spinner"
                        />

                        <strong>
                          A ler movimentos bancários...
                        </strong>

                        <span>
                          O EPIC Payments está a analisar o ficheiro XML.
                        </span>
                      </div>
                    ) : null}

                    {!state.loading &&
                    state.error ? (
                      <div className="processing-empty-table">
                        <AlertTriangle
                          size={23}
                        />

                        <strong>
                          {state.file.type === "pdf"
                            ? "Leitura PDF ainda não ligada"
                            : "Não foi possível ler o ficheiro"}
                        </strong>

                        <span>
                          {state.error}
                        </span>
                      </div>
                    ) : null}

                    {!state.loading &&
                    state.data ? (
                      <div className="processing-table-body">
                        {state.data.movements.map(
                          (movement) => {
                            const accepted =
                              movement.reason_code ===
                              "0000";

                            const normalized =
                              movement.original_member_reference !==
                              movement.member_number;

                            return (
                              <div
                                key={`${state.file.id}-${movement.sequence}`}
                                className={[
                                  "processing-table-row",
                                  accepted
                                    ? "processing-table-row-accepted"
                                    : "processing-table-row-rejected",
                                ].join(" ")}
                              >
                                <div className="processing-member-cell">
                                  <strong>
                                    {movement.member_number ||
                                      "—"}
                                  </strong>

                                  {normalized ? (
                                    <small>
                                      Banco:{" "}
                                      {
                                        movement.original_member_reference
                                      }
                                    </small>
                                  ) : null}
                                </div>

                                <div>
                                  {movement.name ||
                                    "—"}
                                </div>

                                <div className="processing-amount-cell">
                                  {formatCurrency(
                                    movement.amount,
                                  )}
                                </div>

                                <div className="processing-reason-cell">
                                  <span
                                    className={[
                                      "processing-reason-badge",
                                      accepted
                                        ? "processing-reason-badge-accepted"
                                        : "processing-reason-badge-rejected",
                                    ].join(" ")}
                                  >
                                    {movement.reason_code ||
                                      "—"}
                                  </span>

                                  {movement.reason_description ? (
                                    <small className="processing-reason-description">
                                      {movement.reason_description}
                                    </small>
                                  ) : null}
                                </div>

                                <div className="processing-empty-value">
                                  —
                                </div>

                                <div className="processing-empty-value">
                                  —
                                </div>

                                <div className="processing-empty-value">
                                  —
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            },
          )}
        </div>
      </main>
    </div>
  );
}
