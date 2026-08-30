"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  FileText,
  Loader2,
  MessageSquareText,
  Send,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "@/components/layout/AppLayout";

import {
  processCalendarFile,
  type ApiBankMovement,
} from "@/services/calendarFiles";


type SmsStatus =
  | "pending"
  | "sent"
  | "failed";


type CommunicationRow = {
  id: string;

  sequence: number;

  memberNumber: string;
  originalMemberReference: string;

  name: string;

  age: number | null;
  phone: string;

  amount: string;

  bankReasonCode: string;
  bankReasonDescription: string;

  bankReference: string;

  entity: string;
  reference: string;

  smsStatus: SmsStatus;

  reason: string;

  isMinor: boolean;
  cedisMatch: boolean;

  selected: boolean;
};


function formatCurrency(
  value: string,
): string {
  const numeric =
    Number(value);

  if (Number.isNaN(numeric)) {
    return value;
  }

  return new Intl.NumberFormat(
    "pt-PT",
    {
      style: "currency",
      currency: "EUR",
    },
  ).format(numeric);
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


function normalizePhoneForDisplay(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  let digits =
    value.replace(/\D/g, "");

  if (
    digits.startsWith("351") &&
    digits.length > 9
  ) {
    digits =
      digits.slice(3);
  }

  if (digits.length === 9) {
    return [
      digits.slice(0, 3),
      digits.slice(3, 6),
      digits.slice(6, 9),
    ].join(" ");
  }

  return value.trim();
}


function movementToRow(
  movement: ApiBankMovement,
  fileId: number,
): CommunicationRow {
  return {
    id:
      `${fileId}-${movement.sequence}`,

    sequence:
      movement.sequence,

    memberNumber:
      movement.member_number || "",

    originalMemberReference:
      movement.original_member_reference || "",

    name:
      movement.name || "",

    age:
      movement.age,

    phone:
      normalizePhoneForDisplay(
        movement.phone,
      ),

    amount:
      movement.amount,

    bankReasonCode:
      movement.reason_code || "",

    bankReasonDescription:
      movement.reason_description || "",

    bankReference:
      movement.bank_reference || "",

    entity: "",
    reference: "",

    smsStatus: "pending",

    reason: "",

    isMinor:
      movement.is_minor,

    cedisMatch:
      movement.cedis_match,

    selected: false,
  };
}


export default function ComunicacaoPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const fileIdText =
    searchParams.get("fileId");

  const calendarDate =
    searchParams.get("date");

  const fileId =
    fileIdText
      ? Number(fileIdText)
      : null;

  const [
    rows,
    setRows,
  ] = useState<CommunicationRow[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    filename,
    setFilename,
  ] = useState("");

  const [
    cedisFilename,
    setCedisFilename,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCommunication() {
      if (
        !fileId ||
        Number.isNaN(fileId)
      ) {
        setLoading(false);

        setError(
          "Esta comunicação não está associada a um processamento bancário.",
        );

        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await processCalendarFile(
            fileId,
          );

        if (cancelled) {
          return;
        }

        /*
         * REGRA DA COMUNICAÇÃO:
         *
         * Código 0000 = cobrança executada.
         * Tudo o que não seja 0000 entra
         * na área de Comunicação.
         */
        const unpaid =
          data.movements.filter(
            (movement) =>
              movement.reason_code !==
              "0000",
          );

        setRows(
          unpaid.map(
            (movement) =>
              movementToRow(
                movement,
                fileId,
              ),
          ),
        );

        setFilename(
          data.filename,
        );

        setCedisFilename(
          data.cedis_filename || "",
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os processos de comunicação.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCommunication();

    return () => {
      cancelled = true;
    };
  }, [fileId]);


  const sentCount =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.smsStatus ===
            "sent",
        ).length,
      [rows],
    );


  const missingReasonCount =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.smsStatus !==
              "sent" &&
            row.reason.trim().length <
              3,
        ).length,
      [rows],
    );


  const reportReady =
    rows.length > 0 &&
    missingReasonCount === 0;


  const selectedCount =
    rows.filter(
      (row) => row.selected,
    ).length;


  function updateRow(
    id: string,
    changes: Partial<CommunicationRow>,
  ) {
    setRows(
      (current) =>
        current.map(
          (row) =>
            row.id === id
              ? {
                  ...row,
                  ...changes,
                }
              : row,
        ),
    );
  }


  function toggleAll() {
    const allSelected =
      rows.length > 0 &&
      rows.every(
        (row) => row.selected,
      );

    setRows(
      (current) =>
        current.map(
          (row) => ({
            ...row,
            selected:
              !allSelected,
          }),
        ),
    );
  }


  return (
    <AppLayout>
      <main style={pageStyle}>

        <section style={headingStyle}>
          <div>
            <button
              type="button"
              style={backButtonStyle}
              onClick={() =>
                router.push("/")
              }
            >
              <ChevronLeft size={17} />
              Voltar ao calendário
            </button>

            <div style={kickerStyle}>
              EPIC PAYMENTS
            </div>

            <h1 style={titleStyle}>
              Comunicação
            </h1>

            <p style={subtitleStyle}>
              Gestão das mensalidades não
              cobradas, referências Multibanco
              e comunicação aos sócios.
            </p>
          </div>

          <div style={processingStyle}>
            <span
              style={processingLabelStyle}
            >
              PROCESSAMENTO
            </span>

            <strong>
              {formatDate(
                calendarDate,
              )}
            </strong>

            <span
              style={processingFileStyle}
            >
              {filename ||
                "Ficheiro bancário"}
            </span>

            {cedisFilename ? (
              <span
                style={
                  processingCedisStyle
                }
              >
                CEDIS: {cedisFilename}
              </span>
            ) : null}
          </div>
        </section>


        {loading ? (
          <section
            style={messageCardStyle}
          >
            <Loader2
              size={25}
              className="processing-spinner"
            />

            <div>
              <strong>
                A preparar Comunicação
              </strong>

              <span>
                A carregar os sócios com
                mensalidade não cobrada.
              </span>
            </div>
          </section>
        ) : null}


        {!loading && error ? (
          <section
            style={errorCardStyle}
          >
            <CircleAlert size={24} />

            <div>
              <strong>
                Não foi possível abrir
                a Comunicação
              </strong>

              <span>
                {error}
              </span>
            </div>
          </section>
        ) : null}


        {!loading &&
        !error ? (
          <>
            <section
              style={summaryGridStyle}
            >
              <SummaryCard
                icon={
                  <UsersRound
                    size={23}
                  />
                }
                label="PROCESSOS"
                value={String(
                  rows.length,
                )}
                detail="Mensalidades não cobradas"
              />

              <SummaryCard
                icon={
                  <Send
                    size={23}
                  />
                }
                label="SMS ENVIADOS"
                value={String(
                  sentCount,
                )}
                detail={
                  `${rows.length - sentCount} por concluir`
                }
              />

              <SummaryCard
                icon={
                  <CircleAlert
                    size={23}
                  />
                }
                label="POR JUSTIFICAR"
                value={String(
                  missingReasonCount,
                )}
                detail={
                  missingReasonCount ===
                  0
                    ? "Todos os processos válidos"
                    : "Necessitam de motivo"
                }
                warning={
                  missingReasonCount > 0
                }
              />

              <div
                title={
                  reportReady
                    ? "Gerar relatório da comunicação"
                    : `Não é possível gerar o relatório. Faltam justificar ${missingReasonCount} processo(s) sem SMS enviado.`
                }
                style={{
                  ...reportCardStyle,

                  ...(
                    reportReady
                      ? {}
                      : disabledReportCardStyle
                  ),
                }}
              >
                <div
                  style={reportIconStyle}
                >
                  <FileText
                    size={25}
                  />
                </div>

                <div>
                  <span
                    style={
                      reportLabelStyle
                    }
                  >
                    RELATÓRIO
                  </span>

                  <strong
                    style={
                      reportTitleStyle
                    }
                  >
                    Gerar relatório
                  </strong>

                  <span
                    style={
                      reportDetailStyle
                    }
                  >
                    {reportReady
                      ? "Pronto para gerar"
                      : `Faltam ${missingReasonCount} justificações`}
                  </span>
                </div>
              </div>
            </section>


            <section
              style={actionsBarStyle}
            >
              <div>
                <strong
                  style={
                    actionsTitleStyle
                  }
                >
                  Processos de comunicação
                </strong>

                <span
                  style={
                    actionsSubtitleStyle
                  }
                >
                  Confirme e ajuste os
                  dados antes do envio.
                  {selectedCount > 0
                    ? ` ${selectedCount} selecionado(s).`
                    : ""}
                </span>
              </div>

              <div
                style={
                  actionsButtonsStyle
                }
              >
                <button
                  type="button"
                  style={
                    secondaryButtonStyle
                  }
                >
                  <WalletCards
                    size={17}
                  />
                  Gerar referências selecionadas
                </button>

                <button
                  type="button"
                  style={redButtonStyle}
                >
                  <MessageSquareText
                    size={17}
                  />
                  Enviar SMS selecionados
                </button>
              </div>
            </section>


            <section
              style={tableCardStyle}
            >
              <div
                style={tableScrollStyle}
              >
                <table
                  style={tableStyle}
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          checkboxHeaderStyle
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            rows.length >
                              0 &&
                            rows.every(
                              (row) =>
                                row.selected,
                            )
                          }
                          onChange={
                            toggleAll
                          }
                        />
                      </th>

                      <TableHeader>
                        Nº Sócio
                      </TableHeader>

                      <TableHeader>
                        Nome
                      </TableHeader>

                      <TableHeader>
                        Idade
                      </TableHeader>

                      <TableHeader>
                        Telemóvel
                      </TableHeader>

                      <TableHeader>
                        Valor
                      </TableHeader>

                      <TableHeader>
                        Entidade
                      </TableHeader>

                      <TableHeader>
                        Referência
                      </TableHeader>

                      <TableHeader>
                        Status SMS
                      </TableHeader>

                      <TableHeader>
                        Motivo
                      </TableHeader>

                      <TableHeader>
                        Ações
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map(
                      (row) => {
                        const reasonRequired =
                          row.smsStatus !==
                          "sent";

                        const invalidReason =
                          reasonRequired &&
                          row.reason
                            .trim()
                            .length < 3;

                        return (
                          <tr
                            key={row.id}
                            style={rowStyle}
                          >
                            <td
                              style={
                                checkboxCellStyle
                              }
                            >
                              <input
                                type="checkbox"
                                checked={
                                  row.selected
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRow(
                                    row.id,
                                    {
                                      selected:
                                        event
                                          .target
                                          .checked,
                                    },
                                  )
                                }
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <div
                                style={
                                  memberStyle
                                }
                              >
                                <input
                                  value={
                                    row.memberNumber
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRow(
                                      row.id,
                                      {
                                        memberNumber:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  style={{
                                    ...editableInputStyle,
                                    width:
                                      "82px",
                                    fontWeight:
                                      800,
                                  }}
                                />

                                {!row.cedisMatch ? (
                                  <span
                                    title="Este número de sócio não foi encontrado na Base CEDIS ativa. Confirme os dados antes do envio."
                                    style={
                                      warningIconStyle
                                    }
                                  >
                                    <AlertTriangle
                                      size={16}
                                    />
                                  </span>
                                ) : null}
                              </div>

                              {row.originalMemberReference ? (
                                <div
                                  style={bankCodeStyle}
                                  title="Código de envio original presente no ficheiro bancário."
                                >
                                  Banco:{" "}
                                  {row.originalMemberReference}
                                </div>
                              ) : null}
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <input
                                value={
                                  row.name
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRow(
                                    row.id,
                                    {
                                      name:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                style={{
                                  ...editableInputStyle,
                                  minWidth:
                                    "185px",
                                  fontWeight:
                                    750,
                                }}
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <div
                                style={
                                  ageStyle
                                }
                              >
                                <input
                                  value={
                                    row.age ??
                                    ""
                                  }
                                  onChange={(
                                    event,
                                  ) => {
                                    const value =
                                      event
                                        .target
                                        .value;

                                    const age =
                                      value ===
                                      ""
                                        ? null
                                        : Number(
                                            value,
                                          );

                                    updateRow(
                                      row.id,
                                      {
                                        age:
                                          Number.isNaN(
                                            age,
                                          )
                                            ? null
                                            : age,

                                        isMinor:
                                          age !==
                                            null &&
                                          age <
                                            18,
                                      },
                                    );
                                  }}
                                  style={{
                                    ...editableInputStyle,
                                    width:
                                      "48px",
                                    textAlign:
                                      "center",
                                  }}
                                />

                                {row.isMinor ? (
                                  <span
                                    title="Sócio menor de idade. Confirme e altere o número de telemóvel para o contacto adequado antes do envio."
                                    style={
                                      minorWarningStyle
                                    }
                                  >
                                    <AlertTriangle
                                      size={16}
                                    />
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <input
                                value={
                                  row.phone
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRow(
                                    row.id,
                                    {
                                      phone:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                style={{
                                  ...editableInputStyle,
                                  width:
                                    "120px",
                                }}
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <input
                                value={
                                  formatCurrency(
                                    row.amount,
                                  )
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRow(
                                    row.id,
                                    {
                                      amount:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                style={{
                                  ...editableInputStyle,
                                  width:
                                    "85px",
                                  fontWeight:
                                    800,
                                }}
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <input
                                value={
                                  row.entity
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRow(
                                    row.id,
                                    {
                                      entity:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="—"
                                style={{
                                  ...editableInputStyle,
                                  width:
                                    "75px",
                                }}
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <input
                                value={
                                  row.reference
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRow(
                                    row.id,
                                    {
                                      reference:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                placeholder="—"
                                style={{
                                  ...editableInputStyle,
                                  width:
                                    "120px",
                                }}
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <SmsStatusBadge
                                status={
                                  row.smsStatus
                                }
                              />
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <div
                                style={{
                                  display:
                                    "grid",
                                  gap:
                                    "5px",
                                }}
                              >
                                <input
                                  value={
                                    row.reason
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRow(
                                      row.id,
                                      {
                                        reason:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  placeholder={
                                    reasonRequired
                                      ? "Introduzir motivo..."
                                      : "Opcional"
                                  }
                                  style={{
                                    ...editableInputStyle,
                                    minWidth:
                                      "205px",

                                    borderColor:
                                      invalidReason
                                        ? "#d69599"
                                        : "#d9d9d9",

                                    background:
                                      invalidReason
                                        ? "#fff7f7"
                                        : "#fff",
                                  }}
                                />

                                {invalidReason ? (
                                  <span
                                    style={
                                      requiredTextStyle
                                    }
                                  >
                                    Obrigatório se o
                                    SMS não for enviado
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td
                              style={
                                cellStyle
                              }
                            >
                              <div
                                style={
                                  rowActionsStyle
                                }
                              >
                                <button
                                  type="button"
                                  style={
                                    generateButtonStyle
                                  }
                                  title="A ligação à EasyPay será feita na próxima etapa."
                                >
                                  Criar referência
                                </button>

                                <button
                                  type="button"
                                  style={
                                    sendButtonStyle
                                  }
                                  title="A ligação à SMSUP será feita depois da EasyPay."
                                >
                                  Enviar SMS
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {rows.length === 0 ? (
                <div
                  style={
                    emptyStateStyle
                  }
                >
                  <CheckCircle2
                    size={28}
                  />

                  <strong>
                    Não existem mensalidades
                    não cobradas
                  </strong>

                  <span>
                    Este processamento não
                    contém movimentos para
                    Comunicação.
                  </span>
                </div>
              ) : null}

              <div
                style={
                  tableFooterStyle
                }
              >
                <span>
                  {rows.length} processos
                  nesta comunicação
                </span>

                <span>
                  Telemóvel e idade obtidos
                  através da Base CEDIS ativa.
                </span>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </AppLayout>
  );
}


function SummaryCard({
  icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div
      style={summaryCardStyle}
    >
      <div
        style={{
          ...summaryIconStyle,

          ...(warning
            ? summaryWarningIconStyle
            : {}),
        }}
      >
        {icon}
      </div>

      <div>
        <span
          style={summaryLabelStyle}
        >
          {label}
        </span>

        <div
          style={
            summaryValueLineStyle
          }
        >
          <strong
            style={
              summaryValueStyle
            }
          >
            {value}
          </strong>

          <span
            style={
              summaryDetailStyle
            }
          >
            {detail}
          </span>
        </div>
      </div>
    </div>
  );
}


function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      style={tableHeaderStyle}
    >
      {children}
    </th>
  );
}


function SmsStatusBadge({
  status,
}: {
  status: SmsStatus;
}) {
  if (status === "sent") {
    return (
      <span
        style={sentStatusStyle}
      >
        <CheckCircle2 size={15} />
        Enviado
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        style={failedStatusStyle}
      >
        <CircleAlert size={15} />
        Falhou
      </span>
    );
  }

  return (
    <span
      style={pendingStatusStyle}
    >
      Pendente
    </span>
  );
}


/* ========================= */
/* ESTILOS                   */
/* ========================= */

const pageStyle = {
  width: "100%",
  maxWidth: "1700px",
  margin: "0 auto",
  padding: "30px 34px 55px",
  boxSizing: "border-box" as const,
};

const headingStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "30px",
  marginBottom: "24px",
};

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: 0,
  marginBottom: "17px",
  border: 0,
  background: "transparent",
  color: "#666",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
};

const kickerStyle = {
  color: "#9d0009",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "1.6px",
  marginBottom: "5px",
};

const titleStyle = {
  margin: 0,
  color: "#161616",
  fontSize: "30px",
  fontWeight: 900,
};

const subtitleStyle = {
  margin: "7px 0 0",
  color: "#777",
  fontSize: "13px",
};

const processingStyle = {
  display: "grid",
  justifyItems: "end",
  gap: "4px",
};

const processingLabelStyle = {
  color: "#999",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1.2px",
};

const processingFileStyle = {
  color: "#777",
  fontSize: "11px",
};

const processingCedisStyle = {
  color: "#999",
  fontSize: "9px",
};

const messageCardStyle = {
  minHeight: "110px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px",
  padding: "25px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: "14px",
};

const errorCardStyle = {
  ...messageCardStyle,
  color: "#a00008",
  borderColor: "#e2b4b7",
  background: "#fff8f8",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, minmax(180px, 1fr)) minmax(260px, 1.25fr)",
  gap: "14px",
  marginBottom: "20px",
};

const summaryCardStyle = {
  minHeight: "92px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "16px 18px",
  background:
    "linear-gradient(145deg, #ffffff, #f8f8f8)",
  border: "1px solid #e3e3e3",
  borderRadius: "14px",
  boxShadow:
    "0 6px 18px rgba(0,0,0,.045)",
};

const summaryIconStyle = {
  width: "42px",
  height: "42px",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "11px",
  color: "#fff",
  background:
    "linear-gradient(145deg, #353535 0%, #777 55%, #414141 100%)",
};

const summaryWarningIconStyle = {
  background:
    "linear-gradient(145deg, #770007, #bd0711)",
};

const summaryLabelStyle = {
  display: "block",
  marginBottom: "4px",
  color: "#898989",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1px",
};

const summaryValueLineStyle = {
  display: "flex",
  alignItems: "baseline",
  gap: "9px",
  flexWrap: "wrap" as const,
};

const summaryValueStyle = {
  color: "#161616",
  fontSize: "24px",
  lineHeight: 1,
};

const summaryDetailStyle = {
  color: "#777",
  fontSize: "11px",
};

const reportCardStyle = {
  minHeight: "92px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "16px 19px",
  borderRadius: "14px",
  color: "#fff",
  background:
    "linear-gradient(110deg, #730007 0%, #a7000b 42%, #d20f1a 100%)",
  boxShadow:
    "0 8px 20px rgba(130,0,8,.18)",
  cursor: "pointer",
};

const disabledReportCardStyle = {
  filter: "grayscale(.75)",
  opacity: 0.55,
  cursor: "not-allowed",
};

const reportIconStyle = {
  width: "44px",
  height: "44px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "11px",
  background: "rgba(0,0,0,.18)",
};

const reportLabelStyle = {
  display: "block",
  color: "rgba(255,255,255,.68)",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1px",
};

const reportTitleStyle = {
  display: "block",
  marginTop: "2px",
  fontSize: "15px",
};

const reportDetailStyle = {
  display: "block",
  marginTop: "3px",
  color: "rgba(255,255,255,.75)",
  fontSize: "10px",
};

const actionsBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "16px 18px",
  marginBottom: "12px",
  border: "1px solid #e3e3e3",
  borderRadius: "13px",
  background: "#fff",
};

const actionsTitleStyle = {
  display: "block",
  color: "#191919",
  fontSize: "14px",
};

const actionsSubtitleStyle = {
  display: "block",
  marginTop: "3px",
  color: "#888",
  fontSize: "11px",
};

const actionsButtonsStyle = {
  display: "flex",
  gap: "9px",
};

const secondaryButtonStyle = {
  height: "38px",
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  padding: "0 14px",
  border: "1px solid #d5d5d5",
  borderRadius: "8px",
  background:
    "linear-gradient(180deg, #fff, #f4f4f4)",
  color: "#333",
  fontSize: "11px",
  fontWeight: 800,
  cursor: "pointer",
};

const redButtonStyle = {
  ...secondaryButtonStyle,
  border: "1px solid #8f0008",
  color: "#fff",
  background:
    "linear-gradient(100deg, #740007, #a9000b 55%, #ca0d17)",
};

const tableCardStyle = {
  overflow: "hidden",
  border: "1px solid #dedede",
  borderRadius: "14px",
  background: "#fff",
  boxShadow:
    "0 7px 22px rgba(0,0,0,.04)",
};

const tableScrollStyle = {
  width: "100%",
  overflowX: "auto" as const,
};

const tableStyle = {
  width: "100%",
  minWidth: "1530px",
  borderCollapse: "collapse" as const,
};

const tableHeaderStyle = {
  padding: "12px 9px",
  borderBottom: "1px solid #dedede",
  background:
    "linear-gradient(180deg, #f7f7f7, #ededed)",
  color: "#555",
  fontSize: "9px",
  fontWeight: 900,
  textTransform: "uppercase" as const,
  letterSpacing: ".55px",
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

const checkboxHeaderStyle = {
  ...tableHeaderStyle,
  width: "38px",
  textAlign: "center" as const,
};

const rowStyle = {
  borderBottom: "1px solid #eeeeee",
};

const cellStyle = {
  padding: "10px 8px",
  verticalAlign: "middle" as const,
  color: "#222",
  fontSize: "11px",
};

const checkboxCellStyle = {
  ...cellStyle,
  textAlign: "center" as const,
};

const editableInputStyle = {
  height: "34px",
  boxSizing: "border-box" as const,
  padding: "0 8px",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  background: "#fff",
  color: "#202020",
  font: "inherit",
  fontSize: "11px",
  outline: "none",
};

const memberStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const bankCodeStyle = {
  marginTop: "4px",
  color: "#a00008",
  fontSize: "8px",
  fontWeight: 800,
  lineHeight: 1.15,
  whiteSpace: "nowrap" as const,
};

const warningIconStyle = {
  display: "inline-flex",
  color: "#b40710",
  cursor: "help",
};

const ageStyle = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
};

const minorWarningStyle = {
  display: "inline-flex",
  color: "#c58400",
  cursor: "help",
};

const requiredTextStyle = {
  color: "#a00008",
  fontSize: "8px",
  fontWeight: 700,
};

const rowActionsStyle = {
  display: "flex",
  gap: "6px",
};

const generateButtonStyle = {
  height: "32px",
  padding: "0 9px",
  border: "1px solid #cfcfcf",
  borderRadius: "6px",
  background:
    "linear-gradient(180deg, #fff, #f1f1f1)",
  color: "#333",
  fontSize: "9px",
  fontWeight: 800,
  whiteSpace: "nowrap" as const,
  cursor: "pointer",
};

const sendButtonStyle = {
  ...generateButtonStyle,
  border: "1px solid #870008",
  background:
    "linear-gradient(100deg, #760008, #b40913)",
  color: "#fff",
};

const sentStatusStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "6px 8px",
  borderRadius: "999px",
  background: "#eaf8ef",
  color: "#187540",
  fontSize: "9px",
  fontWeight: 900,
  whiteSpace: "nowrap" as const,
};

const failedStatusStyle = {
  ...sentStatusStyle,
  background: "#fff0f1",
  color: "#ad0710",
};

const pendingStatusStyle = {
  ...sentStatusStyle,
  background: "#f1f1f1",
  color: "#666",
};

const emptyStateStyle = {
  display: "grid",
  justifyItems: "center",
  gap: "7px",
  padding: "45px",
  color: "#48715b",
  textAlign: "center" as const,
};

const tableFooterStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  padding: "11px 16px",
  background: "#fafafa",
  borderTop: "1px solid #e7e7e7",
  color: "#888",
  fontSize: "9px",
};