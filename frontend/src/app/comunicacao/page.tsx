"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  Send,
  UsersRound,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
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
  attachCommunicationReport,
  createMultibancoReference,
  sendCommunicationSms,
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
  smsId: string;
  sendingSms: boolean;
  smsError: string;
  reason: string;

  isMinor: boolean;
  cedisMatch: boolean;
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



function escapeHtml(
  value: string | number | null | undefined,
): string {
  return String(
    value ?? "",
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatReportTimestamp(): string {
  return new Intl.DateTimeFormat(
    "pt-PT",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(
    new Date(),
  );
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
    smsId: "",
    sendingSms: false,
    smsError: "",
    reason: "",

    isMinor:
      movement.is_minor,

    cedisMatch:
      movement.cedis_match,
  };
}


export default function ComunicacaoPage() {
  const searchParams =
    new URLSearchParams(
      typeof window !== "undefined"
        ? window.location.search
        : "",
    );

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

  const [
    communicationLoaded,
    setCommunicationLoaded,
  ] = useState(false);


  const [
    attachingReport,
    setAttachingReport,
  ] = useState(false);

  const [
    attachedReportName,
    setAttachedReportName,
  ] = useState("");

  const reportWindowRef =
    useRef<Window | null>(
      null,
    );

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

        const baseRows =
          unpaid.map(
            (movement) =>
              movementToRow(
                movement,
                fileId,
              ),
          );

        const storageKey =
          `epic-communication:${fileId}`;

        const reportStorageKey =
          `epic-communication-report:${fileId}`;

        try {
          const savedReportName =
            window.localStorage.getItem(
              reportStorageKey,
            );

          if (savedReportName) {
            setAttachedReportName(
              savedReportName,
            );
          }
        } catch {
          // A Comunicação continua a funcionar sem armazenamento local.
        }

        let savedRows:
          CommunicationRow[] | null =
            null;

        try {
          const saved =
            window.localStorage.getItem(
              storageKey,
            );

          if (saved) {
            savedRows =
              JSON.parse(saved);
          }
        } catch {
          savedRows = null;
        }

        const savedById =
          new Map(
            (savedRows || []).map(
              (row) => [
                row.id,
                row,
              ],
            ),
          );

        const restoredRows =
          baseRows.map(
            (baseRow) => {
              const savedRow =
                savedById.get(
                  baseRow.id,
                );

              if (!savedRow) {
                return baseRow;
              }

              return {
                ...baseRow,

                memberNumber:
                  savedRow.memberNumber ??
                  baseRow.memberNumber,

                name:
                  savedRow.name ??
                  baseRow.name,

                age:
                  savedRow.age ??
                  baseRow.age,

                phone:
                  savedRow.phone ??
                  baseRow.phone,

                amount:
                  savedRow.amount ??
                  baseRow.amount,

                entity:
                  savedRow.entity || "",

                reference:
                  savedRow.reference || "",

                referenceExpiresAt:
                  savedRow.referenceExpiresAt || "",

                easypayId:
                  savedRow.easypayId || "",

                smsStatus:
                  savedRow.smsStatus ||
                  "pending",

                smsId:
                  savedRow.smsId || "",

                sendingSms:
                  false,

                smsError:
                  "",

                reason:
                  savedRow.reason || "",

                isMinor:
                  savedRow.isMinor ??
                  baseRow.isMinor,

                cedisMatch:
                  baseRow.cedisMatch,

                creatingReference:
                  false,

                referenceError:
                  "",
              };
            },
          );

        setRows(
          restoredRows,
        );

        setCommunicationLoaded(true);

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


  useEffect(() => {
    if (
      !communicationLoaded ||
      !fileId
    ) {
      return;
    }

    const storageKey =
      `epic-communication:${fileId}`;

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(
          rows.map(
            (row) => ({
              ...row,
              creatingReference: false,
              referenceError: "",
              sendingSms: false,
              smsError: "",
            }),
          ),
        ),
      );
    } catch {
      // Se o browser impedir armazenamento local,
      // a Comunicação continua a funcionar normalmente.
    }
  }, [
    rows,
    fileId,
    communicationLoaded,
  ]);


  useEffect(() => {
    function handleReportMessage(
      event: MessageEvent,
    ) {
      if (
        event.data?.type !==
        "EPIC_ATTACH_COMMUNICATION_REPORT"
      ) {
        return;
      }

      void handleAttachReport();
    }

    window.addEventListener(
      "message",
      handleReportMessage,
    );

    return () => {
      window.removeEventListener(
        "message",
        handleReportMessage,
      );
    };
  });


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


  async function handleSendSms(
    row: CommunicationRow,
  ) {
    if (
      row.sendingSms ||
      row.smsStatus === "sent"
    ) {
      return;
    }

    if (
      !row.entity.trim() ||
      !row.reference.trim()
    ) {
      updateRow(
        row.id,
        {
          smsStatus: "failed",
          smsError:
            "Crie primeiro a referência Multibanco.",
        },
      );

      return;
    }

    const amount =
      normalizeAmountForApi(
        row.amount,
      );

    if (amount === null) {
      updateRow(
        row.id,
        {
          smsStatus: "failed",
          smsError:
            "O valor não é válido.",
        },
      );

      return;
    }

    if (!row.phone.trim()) {
      updateRow(
        row.id,
        {
          smsStatus: "failed",
          smsError:
            "Indique o número de telemóvel.",
        },
      );

      return;
    }

    updateRow(
      row.id,
      {
        sendingSms: true,
        smsError: "",
        smsStatus: "pending",
      },
    );

    try {
      const result =
        await sendCommunicationSms({
          phone:
            row.phone.trim(),
          entity:
            row.entity.trim(),
          reference:
            row.reference.trim(),
          value:
            amount,
        });

      updateRow(
        row.id,
        {
          sendingSms: false,
          smsStatus: "sent",
          smsId:
            result.sms_id,
          smsError: "",
        },
      );
    } catch (sendError) {
      updateRow(
        row.id,
        {
          sendingSms: false,
          smsStatus: "failed",
          smsError:
            sendError instanceof Error
              ? sendError.message
              : "Não foi possível enviar o SMS.",
        },
      );
    }
  }



  async function handleAttachReport() {
    if (
      !reportReady ||
      !calendarDate ||
      attachingReport
    ) {
      return;
    }

    setAttachingReport(
      true,
    );

    setAttachedReportName(
      "",
    );

    reportWindowRef.current?.postMessage(
      {
        type:
          "EPIC_REPORT_ATTACHING",
      },
      "*",
    );

    try {
      const result =
        await attachCommunicationReport({
          calendar_date:
            calendarDate,

          source_file_id:
            fileId,

          source_filename:
            filename,

          cedis_filename:
            cedisFilename,

          rows:
            rows.map(
              (row) => ({
                member_number:
                  row.memberNumber,

                name:
                  row.name,

                phone:
                  row.phone,

                value:
                  normalizeAmountForApi(
                    row.amount,
                  ) ?? 0,

                entity:
                  row.entity,

                reference:
                  row.reference,

                sms_status:
                  row.smsStatus,

                reason:
                  row.reason,
              }),
            ),
        });

      setAttachedReportName(
        result.original_filename,
      );

      try {
        window.localStorage.setItem(
          `epic-communication-report:${fileId}`,
          result.original_filename,
        );
      } catch {
        // O relatório já foi criado no servidor.
      }

      reportWindowRef.current?.postMessage(
        {
          type:
            "EPIC_REPORT_ATTACHED",

          filename:
            result.original_filename,
        },
        "*",
      );

      window.opener?.postMessage(
        {
          type:
            "EPIC_CALENDAR_REPORT_ATTACHED",

          date:
            calendarDate,
        },
        "*",
      );
    } catch (attachError) {
      const message =
        attachError instanceof Error
          ? attachError.message
          : "Não foi possível anexar o relatório.";

      reportWindowRef.current?.postMessage(
        {
          type:
            "EPIC_REPORT_ATTACH_ERROR",

          message,
        },
        "*",
      );

      window.alert(
        message,
      );
    } finally {
      setAttachingReport(
        false,
      );
    }
  }


  function handleGenerateReport() {
    if (
      !reportReady ||
      attachedReportName
    ) {
      return;
    }

    const reportWindow =
      window.open(
        "",
        `epicCommunicationReport${fileId ?? ""}`,
        "popup=yes,width=1200,height=820,resizable=yes,scrollbars=yes",
      );

    reportWindowRef.current =
      reportWindow;

    if (!reportWindow) {
      window.alert(
        "O navegador bloqueou a janela do relatório. Permita pop-ups para o EPIC Payments.",
      );

      return;
    }

    const generatedAt =
      formatReportTimestamp();

    const reportRows =
      rows.map(
        (row) => {
          const smsSent =
            row.smsStatus === "sent";

          const statusLabel =
            smsSent
              ? "Enviado"
              : "Não enviado";

          const reasonText =
            smsSent
              ? (
                  row.reason.trim() ||
                  "—"
                )
              : row.reason.trim();

          return `
            <tr>
              <td>${escapeHtml(row.memberNumber)}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${escapeHtml(row.phone || "—")}</td>
              <td class="money">${escapeHtml(formatAmountInput(row.amount))} €</td>
              <td>${escapeHtml(row.entity || "—")}</td>
              <td>${escapeHtml(row.reference || "—")}</td>
              <td>
                <span class="status ${smsSent ? "sent" : "not-sent"}">
                  ${statusLabel}
                </span>
              </td>
              <td>${escapeHtml(reasonText || "—")}</td>
            </tr>
          `;
        },
      )
      .join("");

    const html = `
      <!doctype html>
      <html lang="pt">
        <head>
          <meta charset="utf-8" />
          <title>Relatório de Comunicação - ${escapeHtml(formatDate(calendarDate))}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 34px;
              color: #171717;
              background: #f4f4f4;
              font-family: Arial, Helvetica, sans-serif;
            }

            .toolbar {
              max-width: 1180px;
              margin: 0 auto 16px;
              display: flex;
              justify-content: flex-end;
              gap: 10px;
            }

            .toolbar-button {
              min-height: 42px;
              border-radius: 9px;
              padding: 10px 17px;
              font-size: 13px;
              font-weight: 800;
              cursor: pointer;
            }

            .print-button {
              border: 0;
              color: #fff;
              background: #97000a;
            }

            .attach-button {
              border: 0;
              color: #fff;
              background: #97000a;
              box-shadow:
                0 5px 14px rgba(151, 0, 10, .16);
            }

            .attach-button:hover:not(:disabled) {
              background: #b0000c;
              transform: translateY(-1px);
            }

            .attach-button:disabled {
              opacity: .68;
              cursor: not-allowed;
            }

            .attach-button.created {
              opacity: 1;
              color: #7c0a12;
              background: #f7dfe1;
              border: 1px solid #e6a8ad;
              box-shadow: none;
            }

            .report-success {
              display: none;
              max-width: 1180px;
              margin: 0 auto 16px;
              padding: 14px 16px;
              border: 1px solid #b9dfc4;
              border-radius: 10px;
              color: #176b37;
              background: #eef9f1;
              font-size: 13px;
              font-weight: 700;
              line-height: 1.45;
            }

            .report-success strong {
              display: block;
              margin-bottom: 3px;
              font-size: 14px;
            }

            .report {
              max-width: 1180px;
              margin: 0 auto;
              padding: 34px;
              background: #fff;
              border: 1px solid #dedede;
              border-radius: 14px;
              box-shadow: 0 8px 28px rgba(0, 0, 0, .06);
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              padding-bottom: 22px;
              margin-bottom: 22px;
              border-bottom: 3px solid #9d0009;
            }

            .brand {
              color: #9d0009;
              font-size: 11px;
              font-weight: 900;
              letter-spacing: 1.6px;
            }

            h1 {
              margin: 6px 0 4px;
              font-size: 28px;
            }

            .subtitle,
            .meta {
              color: #777;
              font-size: 12px;
              line-height: 1.55;
            }

            .meta {
              text-align: right;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 22px;
            }

            .summary-card {
              padding: 14px 16px;
              border: 1px solid #e2e2e2;
              border-radius: 10px;
              background: #fafafa;
            }

            .summary-label {
              display: block;
              margin-bottom: 5px;
              color: #777;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: .8px;
              text-transform: uppercase;
            }

            .summary-value {
              font-size: 22px;
              font-weight: 900;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            th {
              padding: 10px 7px;
              color: #555;
              background: #efefef;
              border-bottom: 1px solid #d9d9d9;
              font-size: 9px;
              text-align: left;
              text-transform: uppercase;
            }

            td {
              padding: 10px 7px;
              border-bottom: 1px solid #ededed;
              font-size: 10px;
              vertical-align: top;
              overflow-wrap: anywhere;
            }

            .money {
              font-weight: 800;
              white-space: nowrap;
            }

            .status {
              display: inline-block;
              padding: 4px 7px;
              border-radius: 999px;
              font-size: 9px;
              font-weight: 900;
              white-space: nowrap;
            }

            .sent {
              color: #176b37;
              background: #e7f5eb;
            }

            .not-sent {
              color: #a00008;
              background: #fff0f1;
            }

            .footer {
              margin-top: 24px;
              padding-top: 14px;
              border-top: 1px solid #e1e1e1;
              color: #888;
              font-size: 9px;
              text-align: center;
            }

            @media print {
              @page {
                size: A4 landscape;
                margin: 10mm;
              }

              body {
                padding: 0;
                background: #fff;
              }

              .toolbar {
                display: none;
              }

              .report {
                max-width: none;
                padding: 0;
                border: 0;
                border-radius: 0;
                box-shadow: none;
              }

              thead {
                display: table-header-group;
              }

              tr {
                break-inside: avoid;
              }
            }
          </style>
        </head>

        <body>
          <div class="toolbar">
            <button
              class="toolbar-button print-button"
              onclick="window.print()"
            >
              Imprimir / Guardar PDF
            </button>

            <button
              id="attach-report-button"
              class="toolbar-button attach-button"
              onclick="
                if (this.disabled) return;
                this.disabled = true;
                this.style.cursor = 'wait';
                this.textContent = 'A guardar relatório...';
                window.opener?.postMessage(
                  { type: 'EPIC_ATTACH_COMMUNICATION_REPORT' },
                  '*'
                );
              "
            >
              Guardar relatório
            </button>
          </div>

          <div
            id="report-success"
            class="report-success"
          >
            <strong>Relatório guardado com sucesso.</strong>
            O relatório foi anexado ao dia
            ${escapeHtml(formatDate(calendarDate))}
            no Calendário. Pode fechar esta janela e verificar o relatório
            junto ao respetivo dia.
          </div>

          <main class="report">
            <section class="header">
              <div>
                <div class="brand">EPIC PAYMENTS</div>
                <h1>Relatório de Comunicação</h1>
                <div class="subtitle">
                  Mensalidades não cobradas e respetivo estado de comunicação.
                </div>
              </div>

              <div class="meta">
                <strong>Processamento:</strong>
                ${escapeHtml(formatDate(calendarDate))}
                <br />
                <strong>Ficheiro:</strong>
                ${escapeHtml(filename || "Ficheiro bancário")}
                <br />
                <strong>CEDIS:</strong>
                ${escapeHtml(cedisFilename || "—")}
                <br />
                <strong>Gerado em:</strong>
                ${escapeHtml(generatedAt)}
              </div>
            </section>

            <section class="summary">
              <div class="summary-card">
                <span class="summary-label">Processos</span>
                <span class="summary-value">${rows.length}</span>
              </div>

              <div class="summary-card">
                <span class="summary-label">SMS enviados</span>
                <span class="summary-value">${sentCount}</span>
              </div>

              <div class="summary-card">
                <span class="summary-label">Não enviados / justificados</span>
                <span class="summary-value">${rows.length - sentCount}</span>
              </div>
            </section>

            <table>
              <colgroup>
                <col style="width: 8%" />
                <col style="width: 17%" />
                <col style="width: 11%" />
                <col style="width: 8%" />
                <col style="width: 8%" />
                <col style="width: 12%" />
                <col style="width: 10%" />
                <col style="width: 26%" />
              </colgroup>

              <thead>
                <tr>
                  <th>Nº Sócio</th>
                  <th>Nome</th>
                  <th>Telemóvel</th>
                  <th>Valor</th>
                  <th>Entidade</th>
                  <th>Referência</th>
                  <th>SMS</th>
                  <th>Motivo</th>
                </tr>
              </thead>

              <tbody>
                ${reportRows}
              </tbody>
            </table>

            <div class="footer">
              EPIC Payments · Relatório de Comunicação
            </div>
          </main>

          <script>
            window.addEventListener(
              "message",
              function (event) {
                const button =
                  document.getElementById(
                    "attach-report-button"
                  );

                if (!button) {
                  return;
                }

                if (
                  event.data?.type ===
                  "EPIC_REPORT_ATTACHING"
                ) {
                  button.disabled = true;
                  button.style.cursor = "wait";
                  button.textContent =
                    "A guardar relatório...";
                }

                if (
                  event.data?.type ===
                  "EPIC_REPORT_ATTACHED"
                ) {
                  button.disabled = true;
                  button.style.cursor = "default";
                  button.classList.add(
                    "created"
                  );
                  button.textContent =
                    "Relatório guardado";

                  button.title =
                    event.data?.filename || "";

                  const success =
                    document.getElementById(
                      "report-success"
                    );

                  if (success) {
                    success.style.display =
                      "block";
                  }
                }

                if (
                  event.data?.type ===
                  "EPIC_REPORT_ATTACH_ERROR"
                ) {
                  button.disabled = false;
                  button.style.cursor = "pointer";
                  button.classList.remove(
                    "created"
                  );
                  button.textContent =
                    "Guardar relatório";

                  window.alert(
                    event.data?.message ||
                    "Não foi possível guardar o relatório."
                  );
                }
              }
            );
          </script>
        </body>
      </html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(
      html,
    );
    reportWindow.document.close();
    reportWindow.focus();
  }


  return (
    <AppLayout>
      <main style={pageStyle}>
        <section style={headingStyle}>
          <div>
            <div style={kickerStyle}>
              EPIC PAYMENTS
            </div>

            <h1 style={titleStyle}>
              Comunicação
            </h1>

            <p style={subtitleStyle}>
              Processo controlado, um sócio de cada vez.
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
                  <UsersRound size={22} />
                }
                label="PROCESSOS"
                value={String(
                  rows.length,
                )}
                detail="Mensalidades não cobradas"
              />

              <SummaryCard
                icon={
                  <Send size={22} />
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
                  <CircleAlert size={22} />
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
                role="button"
                tabIndex={
                  reportReady &&
                  !attachedReportName
                    ? 0
                    : -1
                }
                aria-disabled={
                  !reportReady ||
                  Boolean(
                    attachedReportName,
                  )
                }
                title={
                  reportReady
                    ? "Gerar relatório da comunicação"
                    : `Faltam justificar ${missingReasonCount} processo(s).`
                }
                onClick={
                  handleGenerateReport
                }
                onKeyDown={(event) => {
                  if (
                    reportReady &&
                    !attachedReportName &&
                    (
                      event.key === "Enter" ||
                      event.key === " "
                    )
                  ) {
                    event.preventDefault();
                    handleGenerateReport();
                  }
                }}
                style={{
                  ...reportCardStyle,
                  ...(
                    reportReady &&
                    !attachedReportName
                      ? {}
                      : disabledReportCardStyle
                  ),
                }}
              >
                <div style={reportIconStyle}>
                  <FileText size={24} />
                </div>

                <div>
                  <span style={reportLabelStyle}>
                    RELATÓRIO
                  </span>

                  <strong style={reportTitleStyle}>
                    {attachedReportName
                      ? "Relatório guardado"
                      : "Criar relatório"}
                  </strong>

                  <span style={reportDetailStyle}>
                    {attachedReportName
                      ? `Guardado: ${attachedReportName}`
                      : reportReady
                        ? "Clique para abrir e guardar o relatório"
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
                  Confirme os dados e trate cada sócio individualmente.
                </span>
              </div>
            </section>


            <section style={tableCardStyle}>
              <div style={tableScrollStyle}>
                <table style={tableStyle}>
                  <colgroup>
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "17%" }} />
                  </colgroup>

                  <thead>
                    <tr>
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
                        Status
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
                            <td style={cellStyle}>
                              <div style={memberStyle}>
                                <input
                                  value={row.memberNumber}
                                  onChange={(event) =>
                                    updateRow(
                                      row.id,
                                      {
                                        memberNumber:
                                          event.target.value,
                                      },
                                    )
                                  }
                                  disabled={
                                    row.creatingReference ||
                                    referenceCreated
                                  }
                                  style={{
                                    ...editableInputStyle,
                                    fontWeight: 800,
                                  }}
                                />

                                {!row.cedisMatch ? (
                                  <span
                                    title="Este número de sócio não foi encontrado na Base CEDIS ativa."
                                    style={warningIconStyle}
                                  >
                                    <AlertTriangle size={14} />
                                  </span>
                                ) : null}
                              </div>

                              {row.originalMemberReference ? (
                                <div
                                  style={bankCodeStyle}
                                  title="Código original presente no ficheiro bancário."
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
                                        event.target.value,
                                    },
                                  )
                                }
                                disabled={
                                  row.creatingReference ||
                                  referenceCreated
                                }
                                style={{
                                  ...editableInputStyle,
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
                                      event.target.value;

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
                                    textAlign: "center",
                                  }}
                                />

                                {row.isMinor ? (
                                  <span
                                    title="Sócio menor de idade. Confirme o contacto antes do envio."
                                    style={minorWarningStyle}
                                  >
                                    <AlertTriangle size={14} />
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
                                        event.target.value,
                                    },
                                  )
                                }
                                style={editableInputStyle}
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
                                          event.target.value,
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
                                    fontWeight: 800,
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
                                    Val.:{" "}
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
                                          event.target.value,
                                      },
                                    )
                                  }
                                  placeholder={
                                    reasonRequired
                                      ? "Motivo..."
                                      : "Opcional"
                                  }
                                  style={{
                                    ...editableInputStyle,

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
                                    Obrigatório se o SMS não for enviado
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td style={cellStyle}>
                              <div style={actionCellStyle}>
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
                                        size={13}
                                        className="processing-spinner"
                                      />
                                      A criar...
                                    </>
                                  ) : referenceCreated ? (
                                    <>
                                      <CheckCircle2 size={13} />
                                      Criada
                                    </>
                                  ) : (
                                    <>
                                      <WalletCards size={13} />
                                      Criar referência
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleSendSms(
                                      row,
                                    )
                                  }
                                  style={{
                                    ...sendButtonStyle,
                                    ...(
                                      row.sendingSms ||
                                      row.smsStatus === "sent" ||
                                      !referenceCreated
                                        ? disabledButtonStyle
                                        : {}
                                    ),
                                    ...(
                                      row.smsStatus === "sent"
                                        ? sentSmsButtonStyle
                                        : {}
                                    ),
                                  }}
                                  disabled={
                                    row.sendingSms ||
                                    row.smsStatus === "sent" ||
                                    !referenceCreated
                                  }
                                  title={
                                    !referenceCreated
                                      ? "Crie primeiro a referência Multibanco."
                                      : row.smsStatus === "sent"
                                        ? "SMS enviado com sucesso."
                                        : "Enviar SMS individual para este sócio."
                                  }
                                >
                                  {row.sendingSms ? (
                                    <>
                                      <Loader2
                                        size={13}
                                        className="processing-spinner"
                                      />
                                      A enviar...
                                    </>
                                  ) : row.smsStatus === "sent" ? (
                                    <>
                                      <CheckCircle2 size={13} />
                                      SMS enviado
                                    </>
                                  ) : (
                                    <>
                                      <Send size={13} />
                                      Enviar SMS
                                    </>
                                  )}
                                </button>

                                {row.smsError ? (
                                  <span
                                    style={smsErrorStyle}
                                    title={row.smsError}
                                  >
                                    <CircleAlert size={12} />
                                    {row.smsError}
                                  </span>
                                ) : null}

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
        <CheckCircle2 size={13} />
        Enviado
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span style={failedStatusStyle}>
        <CircleAlert size={13} />
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
  padding: "22px 18px 42px",
  boxSizing: "border-box",
};

const headingStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: "18px",
  marginBottom: "16px",
};

const kickerStyle: CSSProperties = {
  color: "#9d0009",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: "1.5px",
  marginBottom: "4px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#161616",
  fontSize: "27px",
  fontWeight: 900,
};

const subtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#777",
  fontSize: "12px",
};

const processingStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: "3px",
};

const processingLabelStyle: CSSProperties = {
  color: "#999",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: "1.1px",
};

const processingFileStyle: CSSProperties = {
  color: "#777",
  fontSize: "10px",
};

const processingCedisStyle: CSSProperties = {
  color: "#999",
  fontSize: "8px",
};

const messageCardStyle: CSSProperties = {
  minHeight: "100px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px",
  padding: "22px",
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
    "repeat(3, minmax(150px, 1fr)) minmax(210px, 1.15fr)",
  gap: "10px",
  marginBottom: "14px",
};

const summaryCardStyle: CSSProperties = {
  minHeight: "76px",
  display: "flex",
  alignItems: "center",
  gap: "11px",
  padding: "12px 14px",
  background:
    "linear-gradient(145deg, #ffffff, #f8f8f8)",
  border: "1px solid #e3e3e3",
  borderRadius: "13px",
  boxShadow:
    "0 5px 14px rgba(0,0,0,.04)",
};

const summaryIconStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
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
  marginBottom: "3px",
  color: "#898989",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: ".9px",
};

const summaryValueLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "7px",
  flexWrap: "wrap",
};

const summaryValueStyle: CSSProperties = {
  color: "#161616",
  fontSize: "21px",
  lineHeight: 1,
};

const summaryDetailStyle: CSSProperties = {
  color: "#777",
  fontSize: "9px",
};

const reportCardStyle: CSSProperties = {
  minHeight: "76px",
  display: "flex",
  alignItems: "center",
  gap: "11px",
  padding: "12px 15px",
  borderRadius: "13px",
  color: "#fff",
  background:
    "linear-gradient(110deg, #730007 0%, #a7000b 42%, #d20f1a 100%)",
  boxShadow:
    "0 7px 18px rgba(130,0,8,.16)",
  cursor: "pointer",
};

const disabledReportCardStyle: CSSProperties = {
  filter: "grayscale(.75)",
  opacity: 0.55,
  cursor: "not-allowed",
};

const reportIconStyle: CSSProperties = {
  width: "39px",
  height: "39px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  background: "rgba(0,0,0,.18)",
};

const reportLabelStyle: CSSProperties = {
  display: "block",
  color: "rgba(255,255,255,.68)",
  fontSize: "8px",
  fontWeight: 900,
  letterSpacing: ".9px",
};

const reportTitleStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  fontSize: "13px",
};

const reportDetailStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "rgba(255,255,255,.75)",
  fontSize: "9px",
};

const actionsBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  padding: "12px 14px",
  marginBottom: "9px",
  border: "1px solid #e3e3e3",
  borderRadius: "12px",
  background: "#fff",
};

const actionsTitleStyle: CSSProperties = {
  display: "block",
  color: "#191919",
  fontSize: "13px",
};

const actionsSubtitleStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#888",
  fontSize: "10px",
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.58,
  cursor: "not-allowed",
};

const tableCardStyle: CSSProperties = {
  overflow: "hidden",
  border: "1px solid #dedede",
  borderRadius: "13px",
  background: "#fff",
  boxShadow:
    "0 6px 18px rgba(0,0,0,.035)",
};

const tableScrollStyle: CSSProperties = {
  width: "100%",
  overflowX: "hidden",
};

const tableStyle: CSSProperties = {
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
};

const tableHeaderStyle: CSSProperties = {
  padding: "10px 4px",
  borderBottom: "1px solid #dedede",
  background:
    "linear-gradient(180deg, #f7f7f7, #ededed)",
  color: "#555",
  fontSize: "8px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".35px",
  textAlign: "left",
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  borderBottom: "1px solid #eeeeee",
};

const cellStyle: CSSProperties = {
  padding: "8px 4px",
  verticalAlign: "middle",
  color: "#222",
  fontSize: "10px",
  overflow: "hidden",
};

const editableInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: "32px",
  boxSizing: "border-box",
  padding: "0 6px",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  background: "#fff",
  color: "#202020",
  font: "inherit",
  fontSize: "10px",
  outline: "none",
};

const memberStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "3px",
  minWidth: 0,
};

const bankCodeStyle: CSSProperties = {
  marginTop: "3px",
  color: "#a00008",
  fontSize: "7px",
  fontWeight: 800,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const warningIconStyle: CSSProperties = {
  display: "inline-flex",
  flexShrink: 0,
  color: "#b40710",
  cursor: "help",
};

const ageStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "3px",
  minWidth: 0,
};

const minorWarningStyle: CSSProperties = {
  display: "inline-flex",
  flexShrink: 0,
  color: "#c58400",
  cursor: "help",
};

const amountFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "2px",
  minWidth: 0,
};

const euroStyle: CSSProperties = {
  color: "#444",
  fontWeight: 800,
  fontSize: "10px",
  flexShrink: 0,
};

const referenceCellStyle: CSSProperties = {
  display: "grid",
  gap: "3px",
  minWidth: 0,
};

const expiryStyle: CSSProperties = {
  color: "#4f765d",
  fontSize: "7px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const reasonFieldStyle: CSSProperties = {
  display: "grid",
  gap: "3px",
  minWidth: 0,
};

const requiredTextStyle: CSSProperties = {
  color: "#a00008",
  fontSize: "7px",
  fontWeight: 700,
  lineHeight: 1.15,
};

const actionCellStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
};

const generateButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "29px",
  padding: "0 5px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  border: "1px solid #cfcfcf",
  borderRadius: "6px",
  background:
    "linear-gradient(180deg, #fff, #f1f1f1)",
  color: "#333",
  fontSize: "8px",
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

const sentSmsButtonStyle: CSSProperties = {
  opacity: 1,
  border: "1px solid #9bc4a8",
  background:
    "linear-gradient(180deg, #f3fbf5, #e7f5eb)",
  color: "#176b37",
};

const smsErrorStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "3px",
  color: "#a00008",
  fontSize: "7px",
  fontWeight: 700,
  lineHeight: 1.2,
};

const referenceErrorStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "3px",
  color: "#a00008",
  fontSize: "7px",
  fontWeight: 700,
  lineHeight: 1.2,
};

const sentStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "5px 6px",
  borderRadius: "999px",
  background: "#eaf8ef",
  color: "#187540",
  fontSize: "8px",
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
  padding: "40px",
  color: "#48715b",
  textAlign: "center",
};

const tableFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  padding: "9px 13px",
  background: "#fafafa",
  borderTop: "1px solid #e7e7e7",
  color: "#888",
  fontSize: "8px",
};
