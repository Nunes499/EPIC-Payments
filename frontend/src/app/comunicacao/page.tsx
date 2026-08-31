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

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import AppLayout from "@/components/layout/AppLayout";

import {
  processCalendarFile,
  type ApiBankMovement,
} from "@/services/calendarFiles";

import {
  createMultibancoReference,
} from "@/services/communication";


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
  referenceExpiresAt: string;
  easypayId: string;

  creatingReference: boolean;
  referenceError: string;

  smsStatus: SmsStatus;
  reason: string;

  isMinor: boolean;
  cedisMatch: boolean;

  selected: boolean;
};


function normalizeAmountForApi(
  value: string,
): number | null {
  let cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "");

  if (!cleaned) {
    return null;
  }

  /*
   * Aceita:
   * 64.90
   * 64,90
   * 1.234,56
   * 1,234.56
   */
  const lastComma =
    cleaned.lastIndexOf(",");

  const lastDot =
    cleaned.lastIndexOf(".");

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    if (lastComma > lastDot) {
      cleaned = cleaned
        .replace(/\./g, "")
        .replace(",", ".");
    } else {
      cleaned =
        cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    cleaned =
      cleaned.replace(",", ".");
  }

  cleaned =
    cleaned.replace(/[^\d.-]/g, "");

  const numeric = Number(cleaned);

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    return null;
  }

  return Math.round(
    numeric * 100,
  ) / 100;
}


function formatAmountInput(
  value: string,
): string {
  const numeric =
    normalizeAmountForApi(value);

  if (numeric === null) {
    return value;
  }

  return numeric.toFixed(2);
}


function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const datePart =
    value.slice(0, 10);

  const parts =
    datePart.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return (
    `${parts[2]}/${parts[1]}/${parts[0]}`
  );
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

    /*
     * REGRA:
     * O nome apresentado vem do ficheiro bancário.
     * A Base CEDIS não substitui o nome.
     */
    name:
      movement.name || "",

    age:
      movement.age,

    phone:
      normalizePhoneForDisplay(
        movement.phone,
      ),

    amount:
      formatAmountInput(
        String(movement.amount ?? ""),
      ),

    bankReasonCode:
      movement.reason_code || "",

    bankReasonDescription:
      movement.reason_description || "",

    bankReference:
      movement.bank_reference || "",

    entity: "",
    reference: "",
    referenceExpiresAt: "",
    easypayId: "",

    creatingReference: false,
    referenceError: "",

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
          "Esta comunicação não está associada " +
          "a um processamento bancário.",
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


  async function handleCreateReference(
    row: CommunicationRow,
  ) {
    if (
      row.creatingReference ||
      row.entity ||
      row.reference
    ) {
      return;
    }

    const memberNumber =
      row.memberNumber.trim();

    const memberName =
      row.name.trim();

    const amount =
      normalizeAmountForApi(
        row.amount,
      );

    if (!memberNumber) {
      updateRow(
        row.id,
        {
          referenceError:
            "Indique o nº de sócio antes de criar a referência.",
        },
      );

      return;
    }

    if (amount === null) {
      updateRow(
        row.id,
        {
          referenceError:
            "O valor não é válido.",
        },
      );

      return;
    }

    if (amount < 0.5) {
      updateRow(
        row.id,
        {
          referenceError:
            "O valor mínimo é 0,50 €.",
        },
      );

      return;
    }

    updateRow(
      row.id,
      {
        creatingReference: true,
        referenceError: "",
      },
    );

    try {
      const result =
        await createMultibancoReference({
          member_number:
            memberNumber,
          member_name:
            memberName,
          value:
            amount,
        });

      updateRow(
        row.id,
        {
          entity:
            result.entity,
          reference:
            result.reference,
          referenceExpiresAt:
            result.expires_at,
          easypayId:
            result.easypay_id,
          amount:
            result.value.toFixed(2),
          creatingReference:
            false,
          referenceError:
            "",
        },
      );
    } catch (createError) {
      updateRow(
        row.id,
        {
          creatingReference:
            false,
          referenceError:
            createError instanceof Error
              ? createError.message
              : "Não foi possível criar a referência.",
        },
      );
    }
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
            <span style={processingLabelStyle}>
              PROCESSAMENTO
            </span>

            <strong>
              {formatDate(
                calendarDate,
              )}
            </strong>

            <span style={processingFileStyle}>
              {filename ||
                "Ficheiro bancário"}
            </span>

            {cedisFilename ? (
              <span style={processingCedisStyle}>
                CEDIS: {cedisFilename}
              </span>
            ) : null}
          </div>
        </section>


        {loading ? (
          <section style={messageCardStyle}>
            <Loader2
              size={25}
              className="processing-spinner"
            />

            <div style={messageTextStyle}>
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
          <section style={errorCardStyle}>
            <CircleAlert size={24} />

            <div style={messageTextStyle}>
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
            <section style={summaryGridStyle}>
              <SummaryCard
                icon={
                  <UsersRound size={23} />
                }
                label="PROCESSOS"
                value={String(
                  rows.length,
                )}
                detail="Mensalidades não cobradas"
              />

              <SummaryCard
                icon={
                  <Send size={23} />
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
                  <CircleAlert size={23} />
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
                <div style={reportIconStyle}>
                  <FileText size={25} />
                </div>

                <div>
                  <span style={reportLabelStyle}>
                    RELATÓRIO
                  </span>

                  <strong style={reportTitleStyle}>
                    Gerar relatório
                  </strong>

                  <span style={reportDetailStyle}>
                    {reportReady
                      ? "Pronto para gerar"
                      : `Faltam ${missingReasonCount} justificações`}
                  </span>
                </div>
              </div>
            </section>


            <section style={actionsBarStyle}>
              <div>
                <strong style={actionsTitleStyle}>
                  Processos de comunicação
                </strong>

                <span style={actionsSubtitleStyle}>
                  Confirme e ajuste os dados
                  antes do envio.
                  {selectedCount > 0
                    ? ` ${selectedCount} selecionado(s).`
                    : ""}
                </span>
              </div>

              <div style={actionsButtonsStyle}>
                <button
                  type="button"
                  style={{
                    ...secondaryButtonStyle,
                    ...disabledButtonStyle,
                  }}
                  disabled
                  title="A criação em massa será ativada depois de validarmos a criação individual."
                >
                  <WalletCards size={17} />
                  Gerar referências selecionadas
                </button>

                <button
                  type="button"
                  style={{
                    ...redButtonStyle,
                    ...disabledButtonStyle,
                  }}
                  disabled
                  title="A ligação à SMSUP será feita depois da EasyPay."
                >
                  <MessageSquareText size={17} />
                  Enviar SMS selecionados
                </button>
              </div>
            </section>


            <section style={tableCardStyle}>
              <div style={tableScrollStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={checkboxHeaderStyle}>
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

                        const referenceCreated =
                          Boolean(
                            row.entity &&
                            row.reference,
                          );

                        return (
                          <tr
                            key={row.id}
                            style={rowStyle}
                          >
                            <td style={checkboxCellStyle}>
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(event) =>
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

                            <td style={cellStyle}>
                              <div style={memberStyle}>
                                <input
                                  value={row.memberNumber}
                                  onChange={(event) =>
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
                                  disabled={
                                    row.creatingReference ||
                                    referenceCreated
                                  }
                                  style={{
                                    ...editableInputStyle,
                                    width: "82px",
                                    fontWeight: 800,
                                  }}
                                />

                                {!row.cedisMatch ? (
                                  <span
                                    title="Este número de sócio não foi encontrado na Base CEDIS ativa. Confirme os dados antes do envio."
                                    style={warningIconStyle}
                                  >
                                    <AlertTriangle size={16} />
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

                            <td style={cellStyle}>
                              <input
                                value={row.name}
                                onChange={(event) =>
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
                                disabled={
                                  row.creatingReference ||
                                  referenceCreated
                                }
                                style={{
                                  ...editableInputStyle,
                                  minWidth: "185px",
                                  fontWeight: 750,
                                }}
                              />
                            </td>

                            <td style={cellStyle}>
                              <div style={ageStyle}>
                                <input
                                  value={row.age ?? ""}
                                  onChange={(event) => {
                                    const value =
                                      event
                                        .target
                                        .value;

                                    const age =
                                      value === ""
                                        ? null
                                        : Number(value);

                                    updateRow(
                                      row.id,
                                      {
                                        age:
                                          Number.isNaN(age)
                                            ? null
                                            : age,

                                        isMinor:
                                          age !==
                                            null &&
                                          age < 18,
                                      },
                                    );
                                  }}
                                  style={{
                                    ...editableInputStyle,
                                    width: "48px",
                                    textAlign: "center",
                                  }}
                                />

                                {row.isMinor ? (
                                  <span
                                    title="Sócio menor de idade. Confirme e altere o número de telemóvel para o contacto adequado antes do envio."
                                    style={minorWarningStyle}
                                  >
                                    <AlertTriangle size={16} />
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td style={cellStyle}>
                              <input
                                value={row.phone}
                                onChange={(event) =>
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
                                  width: "120px",
                                }}
                              />
                            </td>

                            <td style={cellStyle}>
                              <div style={amountFieldStyle}>
                                <input
                                  value={row.amount}
                                  inputMode="decimal"
                                  onChange={(event) =>
                                    updateRow(
                                      row.id,
                                      {
                                        amount:
                                          event
                                            .target
                                            .value,
                                        referenceError:
                                          "",
                                      },
                                    )
                                  }
                                  onBlur={() =>
                                    updateRow(
                                      row.id,
                                      {
                                        amount:
                                          formatAmountInput(
                                            row.amount,
                                          ),
                                      },
                                    )
                                  }
                                  disabled={
                                    row.creatingReference ||
                                    referenceCreated
                                  }
                                  style={{
                                    ...editableInputStyle,
                                    width: "73px",
                                    fontWeight: 800,
                                    paddingRight: "5px",
                                  }}
                                />
                                <span style={euroStyle}>
                                  €
                                </span>
                              </div>
                            </td>

                            <td style={cellStyle}>
                              <input
                                value={row.entity}
                                readOnly
                                placeholder="—"
                                style={{
                                  ...editableInputStyle,
                                  width: "75px",
                                  background:
                                    referenceCreated
                                      ? "#f1faf4"
                                      : "#f7f7f7",
                                  fontWeight:
                                    referenceCreated
                                      ? 800
                                      : 400,
                                }}
                              />
                            </td>

                            <td style={cellStyle}>
                              <div style={referenceCellStyle}>
                                <input
                                  value={row.reference}
                                  readOnly
                                  placeholder="—"
                                  style={{
                                    ...editableInputStyle,
                                    width: "120px",
                                    background:
                                      referenceCreated
                                        ? "#f1faf4"
                                        : "#f7f7f7",
                                    fontWeight:
                                      referenceCreated
                                        ? 800
                                        : 400,
                                  }}
                                />

                                {row.referenceExpiresAt ? (
                                  <span style={expiryStyle}>
                                    Validade:{" "}
                                    {formatDate(
                                      row.referenceExpiresAt,
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td style={cellStyle}>
                              <SmsStatusBadge
                                status={row.smsStatus}
                              />
                            </td>

                            <td style={cellStyle}>
                              <div style={reasonFieldStyle}>
                                <input
                                  value={row.reason}
                                  onChange={(event) =>
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
                                    minWidth: "205px",

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
                                  <span style={requiredTextStyle}>
                                    Obrigatório se o SMS
                                    não for enviado
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td style={cellStyle}>
                              <div style={actionCellStyle}>
                                <div style={rowActionsStyle}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCreateReference(
                                        row,
                                      )
                                    }
                                    disabled={
                                      row.creatingReference ||
                                      referenceCreated
                                    }
                                    style={{
                                      ...generateButtonStyle,
                                      ...(
                                        row.creatingReference ||
                                        referenceCreated
                                          ? disabledButtonStyle
                                          : {}
                                      ),
                                      ...(
                                        referenceCreated
                                          ? referenceCreatedButtonStyle
                                          : {}
                                      ),
                                    }}
                                    title={
                                      referenceCreated
                                        ? "Referência Multibanco já criada."
                                        : "Criar referência Multibanco através da EasyPay."
                                    }
                                  >
                                    {row.creatingReference ? (
                                      <>
                                        <Loader2
                                          size={14}
                                          className="processing-spinner"
                                        />
                                        A criar...
                                      </>
                                    ) : referenceCreated ? (
                                      <>
                                        <CheckCircle2 size={14} />
                                        Referência criada
                                      </>
                                    ) : (
                                      <>
                                        <WalletCards size={14} />
                                        Criar referência
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    style={{
                                      ...sendButtonStyle,
                                      ...disabledButtonStyle,
                                    }}
                                    disabled
                                    title="A ligação à SMSUP será feita depois da EasyPay."
                                  >
                                    Enviar SMS
                                  </button>
                                </div>

                                {row.referenceError ? (
                                  <span
                                    style={referenceErrorStyle}
                                    title={row.referenceError}
                                  >
                                    <CircleAlert size={12} />
                                    {row.referenceError}
                                  </span>
                                ) : null}
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
                <div style={emptyStateStyle}>
                  <CheckCircle2 size={28} />

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

              <div style={tableFooterStyle}>
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
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div style={summaryCardStyle}>
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
        <span style={summaryLabelStyle}>
          {label}
        </span>

        <div style={summaryValueLineStyle}>
          <strong style={summaryValueStyle}>
            {value}
          </strong>

          <span style={summaryDetailStyle}>
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
  children: ReactNode;
}) {
  return (
    <th style={tableHeaderStyle}>
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
      <span style={sentStatusStyle}>
        <CheckCircle2 size={15} />
        Enviado
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span style={failedStatusStyle}>
        <CircleAlert size={15} />
        Falhou
      </span>
    );
  }

  return (
    <span style={pendingStatusStyle}>
      Pendente
    </span>
  );
}


/* ========================= */
/* ESTILOS                   */
/* ========================= */

const pageStyle: CSSProperties = {
  width: "100%",
  maxWidth: "1700px",
  margin: "0 auto",
  padding: "30px 34px 55px",
  boxSizing: "border-box",
};

const headingStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "30px",
  marginBottom: "24px",
};

const backButtonStyle: CSSProperties = {
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

const kickerStyle: CSSProperties = {
  color: "#9d0009",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "1.6px",
  marginBottom: "5px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#161616",
  fontSize: "30px",
  fontWeight: 900,
};

const subtitleStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#777",
  fontSize: "13px",
};

const processingStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: "4px",
};

const processingLabelStyle: CSSProperties = {
  color: "#999",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1.2px",
};

const processingFileStyle: CSSProperties = {
  color: "#777",
  fontSize: "11px",
};

const processingCedisStyle: CSSProperties = {
  color: "#999",
  fontSize: "9px",
};

const messageCardStyle: CSSProperties = {
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

const messageTextStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
};

const errorCardStyle: CSSProperties = {
  ...messageCardStyle,
  color: "#a00008",
  borderColor: "#e2b4b7",
  background: "#fff8f8",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, minmax(180px, 1fr)) minmax(260px, 1.25fr)",
  gap: "14px",
  marginBottom: "20px",
};

const summaryCardStyle: CSSProperties = {
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

const summaryIconStyle: CSSProperties = {
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

const summaryWarningIconStyle: CSSProperties = {
  background:
    "linear-gradient(145deg, #770007, #bd0711)",
};

const summaryLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#898989",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1px",
};

const summaryValueLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "9px",
  flexWrap: "wrap",
};

const summaryValueStyle: CSSProperties = {
  color: "#161616",
  fontSize: "24px",
  lineHeight: 1,
};

const summaryDetailStyle: CSSProperties = {
  color: "#777",
  fontSize: "11px",
};

const reportCardStyle: CSSProperties = {
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

const disabledReportCardStyle: CSSProperties = {
  filter: "grayscale(.75)",
  opacity: 0.55,
  cursor: "not-allowed",
};

const reportIconStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "11px",
  background: "rgba(0,0,0,.18)",
};

const reportLabelStyle: CSSProperties = {
  display: "block",
  color: "rgba(255,255,255,.68)",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1px",
};

const reportTitleStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  fontSize: "15px",
};

const reportDetailStyle: CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "rgba(255,255,255,.75)",
  fontSize: "10px",
};

const actionsBarStyle: CSSProperties = {
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

const actionsTitleStyle: CSSProperties = {
  display: "block",
  color: "#191919",
  fontSize: "14px",
};

const actionsSubtitleStyle: CSSProperties = {
  display: "block",
  marginTop: "3px",
  color: "#888",
  fontSize: "11px",
};

const actionsButtonsStyle: CSSProperties = {
  display: "flex",
  gap: "9px",
};

const secondaryButtonStyle: CSSProperties = {
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

const redButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: "1px solid #8f0008",
  color: "#fff",
  background:
    "linear-gradient(100deg, #740007, #a9000b 55%, #ca0d17)",
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.58,
  cursor: "not-allowed",
};

const tableCardStyle: CSSProperties = {
  overflow: "hidden",
  border: "1px solid #dedede",
  borderRadius: "14px",
  background: "#fff",
  boxShadow:
    "0 7px 22px rgba(0,0,0,.04)",
};

const tableScrollStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "1530px",
  borderCollapse: "collapse",
};

const tableHeaderStyle: CSSProperties = {
  padding: "12px 9px",
  borderBottom: "1px solid #dedede",
  background:
    "linear-gradient(180deg, #f7f7f7, #ededed)",
  color: "#555",
  fontSize: "9px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".55px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const checkboxHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  width: "38px",
  textAlign: "center",
};

const rowStyle: CSSProperties = {
  borderBottom: "1px solid #eeeeee",
};

const cellStyle: CSSProperties = {
  padding: "10px 8px",
  verticalAlign: "middle",
  color: "#222",
  fontSize: "11px",
};

const checkboxCellStyle: CSSProperties = {
  ...cellStyle,
  textAlign: "center",
};

const editableInputStyle: CSSProperties = {
  height: "34px",
  boxSizing: "border-box",
  padding: "0 8px",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  background: "#fff",
  color: "#202020",
  font: "inherit",
  fontSize: "11px",
  outline: "none",
};

const memberStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const bankCodeStyle: CSSProperties = {
  marginTop: "4px",
  color: "#a00008",
  fontSize: "8px",
  fontWeight: 800,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
};

const warningIconStyle: CSSProperties = {
  display: "inline-flex",
  color: "#b40710",
  cursor: "help",
};

const ageStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
};

const minorWarningStyle: CSSProperties = {
  display: "inline-flex",
  color: "#c58400",
  cursor: "help",
};

const amountFieldStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
};

const euroStyle: CSSProperties = {
  color: "#444",
  fontWeight: 800,
  fontSize: "11px",
};

const referenceCellStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
};

const expiryStyle: CSSProperties = {
  color: "#4f765d",
  fontSize: "8px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const reasonFieldStyle: CSSProperties = {
  display: "grid",
  gap: "5px",
};

const requiredTextStyle: CSSProperties = {
  color: "#a00008",
  fontSize: "8px",
  fontWeight: 700,
};

const actionCellStyle: CSSProperties = {
  display: "grid",
  gap: "5px",
};

const rowActionsStyle: CSSProperties = {
  display: "flex",
  gap: "6px",
};

const generateButtonStyle: CSSProperties = {
  minHeight: "32px",
  padding: "0 9px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  border: "1px solid #cfcfcf",
  borderRadius: "6px",
  background:
    "linear-gradient(180deg, #fff, #f1f1f1)",
  color: "#333",
  fontSize: "9px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const referenceCreatedButtonStyle: CSSProperties = {
  opacity: 1,
  border: "1px solid #9bc4a8",
  background:
    "linear-gradient(180deg, #f3fbf5, #e7f5eb)",
  color: "#176b37",
};

const sendButtonStyle: CSSProperties = {
  ...generateButtonStyle,
  border: "1px solid #870008",
  background:
    "linear-gradient(100deg, #760008, #b40913)",
  color: "#fff",
};

const referenceErrorStyle: CSSProperties = {
  maxWidth: "250px",
  display: "flex",
  alignItems: "flex-start",
  gap: "4px",
  color: "#a00008",
  fontSize: "8px",
  fontWeight: 700,
  lineHeight: 1.25,
};

const sentStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "6px 8px",
  borderRadius: "999px",
  background: "#eaf8ef",
  color: "#187540",
  fontSize: "9px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const failedStatusStyle: CSSProperties = {
  ...sentStatusStyle,
  background: "#fff0f1",
  color: "#ad0710",
};

const pendingStatusStyle: CSSProperties = {
  ...sentStatusStyle,
  background: "#f1f1f1",
  color: "#666",
};

const emptyStateStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "7px",
  padding: "45px",
  color: "#48715b",
  textAlign: "center",
};

const tableFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  padding: "11px 16px",
  background: "#fafafa",
  borderTop: "1px solid #e7e7e7",
  color: "#888",
  fontSize: "9px",
};
