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
  Printer,
  RefreshCw,
  SearchCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  processCalendarFile,
  type ApiBankFileProcessing,
  type ApiBankMovement,
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


type CalendarFileWithRecovery = CalendarFile & {
  fileCategory?: string;
  recoveryPart?: number | null;
  relatedFileId?: number | null;
};


type RecoveryStatus =
  | "RECUPERADA"
  | "NAO_PAGA";


type RecoveryResult = ApiBankMovement & {
  recovery_status: RecoveryStatus;
  final_reason_code: string;
  final_reason_description: string;
  conclusion: string;
  source_file: "F1" | "F2";
};


function getFileCategory(
  file: CalendarFile,
): string {
  return (
    file as CalendarFileWithRecovery
  ).fileCategory || "normal";
}


function getRecoveryPart(
  file: CalendarFile,
): number | null {
  return (
    file as CalendarFileWithRecovery
  ).recoveryPart ?? null;
}


function isRecoveryFile(
  file: CalendarFile,
): boolean {
  return getFileCategory(file) === "recovery";
}


function getFileIcon(
  file: CalendarFile,
) {
  if (file.type === "report") {
    return FileSpreadsheet;
  }

  if (isRecoveryFile(file)) {
    return RefreshCw;
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

  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


function formatDateTime(
  value: Date | null,
): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-PT",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(value);
}


function escapeHtml(
  value: string | number | null | undefined,
): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getReturnOrigin(
  movement: RecoveryResult,
): {
  label: string;
  description: string;
} {
  if (movement.source_file === "F1") {
    return {
      label:
        "Rejeitada no Ficheiro 1 (F1)",
      description:
        "A cobrança foi rejeitada no processamento inicial e não chegou a ser cobrada.",
    };
  }

  return {
    label:
      "Devolvida no Ficheiro 2 (F2)",
    description:
      "A cobrança foi aceite no Ficheiro 1, mas foi posteriormente devolvida/reembolsada no Ficheiro 2.",
  };
}


function ReasonCodeTooltip({
  code,
  description,
  accepted,
}: {
  code: string;
  description: string;
  accepted: boolean;
}) {
  const safeDescription =
    description.trim() ||
    "Sem descrição disponível.";

  return (
    <span className="processing-code-tooltip">
      <span
        className={[
          "processing-reason-badge",
          accepted
            ? "processing-reason-badge-accepted"
            : "processing-reason-badge-rejected",
        ].join(" ")}
        tabIndex={0}
        aria-label={`${code}: ${safeDescription}`}
      >
        {code || "—"}
      </span>

      <span
        className="processing-code-tooltip-popover"
        role="tooltip"
      >
        <span className="processing-code-tooltip-brand">
          EPIC PAYMENTS
        </span>

        <strong>
          {code || "Código"}
        </strong>

        <span>
          {safeDescription}
        </span>
      </span>
    </span>
  );
}


function buildRecoveryResults(
  f1: ApiBankFileProcessing,
  f2: ApiBankFileProcessing,
): RecoveryResult[] {
  const f2ByReference =
    new Map<string, ApiBankMovement>();

  for (const movement of f2.movements) {
    const reference =
      movement.bank_reference?.trim();

    if (!reference) {
      continue;
    }

    f2ByReference.set(
      reference,
      movement,
    );
  }

  return f1.movements.map(
    (movement) => {
      const reference =
        movement.bank_reference?.trim() || "";

      const f2Movement =
        reference
          ? f2ByReference.get(reference)
          : undefined;

      /*
       * Regra funcional:
       *
       * 1. Rejeitado já no F1 -> NÃO PAGA.
       * 2. 0000 no F1 mas aparece no F2 -> NÃO PAGA,
       *    usando o motivo do F2.
       * 3. 0000 no F1 e não aparece no F2 -> RECUPERADA.
       *
       * A chave é sempre a Referência da Cobrança.
       */
      if (movement.reason_code !== "0000") {
        return {
          ...movement,
          recovery_status: "NAO_PAGA",
          final_reason_code:
            movement.reason_code,
          final_reason_description:
            movement.reason_description,
          conclusion:
            "Não pago — rejeitado no Ficheiro 1",
          source_file: "F1",
        };
      }

      if (f2Movement) {
        return {
          ...movement,
          reason_code:
            f2Movement.reason_code,
          reason_description:
            f2Movement.reason_description,
          recovery_status: "NAO_PAGA",
          final_reason_code:
            f2Movement.reason_code,
          final_reason_description:
            f2Movement.reason_description,
          conclusion:
            "Não pago — apareceu devolvido no Ficheiro 2",
          source_file: "F2",
        };
      }

      return {
        ...movement,
        recovery_status: "RECUPERADA",
        final_reason_code: "0000",
        final_reason_description:
          "Recuperada com sucesso",
        conclusion:
          "Pago / recuperado — não apareceu devolvido no Ficheiro 2",
        source_file: "F1",
      };
    },
  );
}


export default function ProcessingWorkspace({
  selection,
  onClose,
}: ProcessingWorkspaceProps) {
  const [
    fileStates,
    setFileStates,
  ] = useState<ProcessingFileState[]>([]);

  const [
    showOnlyUnpaid,
    setShowOnlyUnpaid,
  ] = useState(false);

  const [
    recoveryResults,
    setRecoveryResults,
  ] = useState<RecoveryResult[] | null>(
    null,
  );




  const generatedBy =
    "Administrador";


  useEffect(() => {
    if (!selection) {
      return;
    }

    const html =
      document.documentElement;

    const body =
      document.body;

    const previousHtmlOverflow =
      html.style.overflow;

    const previousBodyOverflow =
      body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow =
        previousHtmlOverflow;

      body.style.overflow =
        previousBodyOverflow;
    };
  }, [selection]);


  useEffect(() => {
    if (!selection) {
      setFileStates([]);
      setShowOnlyUnpaid(false);
      setRecoveryResults(null);
      return;
    }

    setShowOnlyUnpaid(false);
    setRecoveryResults(null);

    const initialStates =
      selection.files.map(
        (file) => ({
          file,
          loading:
            file.type === "xml" ||
            file.type === "pdf",
          error: null,
          data: null,
        }),
      );

    setFileStates(initialStates);

    let cancelled = false;

    async function loadFiles() {
      const results =
        await Promise.all(
          selection!.files.map(
            async (file) => {
              if (
                file.type !== "xml" &&
                file.type !== "pdf"
              ) {
                return {
                  file,
                  loading: false,
                  error:
                    "Este formato ainda não pode ser processado.",
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
        setFileStates(results);
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

      for (const item of fileStates) {
        if (!item.data) {
          continue;
        }

        movements +=
          item.data.parsed_transactions;

        amount += Number(
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


  const recoveryFiles =
    selection.files.filter(
      (file) => isRecoveryFile(file),
    );

  const isRecoverySelection =
    recoveryFiles.length > 0 &&
    recoveryFiles.length ===
      selection.files.length;

  const pdfCount =
    selection.files.filter(
      (file) =>
        file.type === "pdf" &&
        !isRecoveryFile(file),
    ).length;

  const xmlCount =
    selection.files.filter(
      (file) =>
        file.type === "xml",
    ).length;

  const hasLoadedMovements =
    totals.movements > 0;

  const f1State =
    fileStates.find(
      (state) =>
        isRecoveryFile(state.file) &&
        getRecoveryPart(state.file) === 1,
    );

  const f2State =
    fileStates.find(
      (state) =>
        isRecoveryFile(state.file) &&
        getRecoveryPart(state.file) === 2,
    );

  const recoveryPairReady =
    Boolean(
      f1State?.data &&
      f2State?.data &&
      !f1State.loading &&
      !f2State.loading &&
      !f1State.error &&
      !f2State.error,
    );

  const recoveredRecoveryResults =
    recoveryResults?.filter(
      (movement) =>
        movement.recovery_status ===
        "RECUPERADA",
    ) ?? [];

  const unpaidRecoveryResults =
    recoveryResults?.filter(
      (movement) =>
        movement.recovery_status ===
        "NAO_PAGA",
    ) ?? [];

  const recoveredCount =
    recoveredRecoveryResults.length;

  const unpaidCount =
    unpaidRecoveryResults.length;



  function handleRecoveryFilter() {
    if (
      !f1State?.data ||
      !f2State?.data
    ) {
      return;
    }

    const results =
      buildRecoveryResults(
        f1State.data,
        f2State.data,
      );

    setRecoveryResults(results);

    window.setTimeout(() => {
      document
        .getElementById(
          "recovery-filter-result",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }


  function handlePreparePrint() {
    if (
      !selection ||
      !recoveryResults
    ) {
      return;
    }

    const generatedAt =
      new Date();

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1100,height=820",
      );

    if (!printWindow) {
      window.alert(
        "O navegador bloqueou a janela de impressão. Permita pop-ups para o EPIC Payments e tente novamente.",
      );

      return;
    }

    printWindow.opener =
      null;

    const logoUrl =
      `${window.location.origin}/branding/logo-epic-payments-dark.png`;

    const fileNames =
      selection.files
        .map(
          (file) =>
            file.name,
        )
        .join(" + ");

    const chunkItems = <T,>(
      items: T[],
      size: number,
    ): T[][] => {
      const chunks: T[][] = [];

      for (
        let index = 0;
        index < items.length;
        index += size
      ) {
        chunks.push(
          items.slice(
            index,
            index + size,
          ),
        );
      }

      return chunks;
    };

    const renderMemberCell = (
      movement: RecoveryResult,
    ) => {
      const memberNumber =
        movement.member_number ||
        "—";

      const bankMemberReference =
        movement.original_member_reference ||
        "";

      const showBankReference =
        Boolean(
          bankMemberReference &&
          bankMemberReference !==
            memberNumber,
        );

      return `
        <div class="member-cell">
          <strong>${escapeHtml(memberNumber)}</strong>
          ${
            showBankReference
              ? `<span class="bank-member-reference">Banco: ${escapeHtml(bankMemberReference)}</span>`
              : ""
          }
        </div>
      `;
    };

    const renderRecoveredRows = (
      movements: RecoveryResult[],
    ) =>
      movements
        .map(
          (movement) => `
            <tr>
              <td>${escapeHtml(movement.bank_reference || "—")}</td>
              <td>${renderMemberCell(movement)}</td>
              <td class="name-cell">${escapeHtml(movement.name || "—")}</td>
              <td class="amount-cell">${escapeHtml(formatCurrency(movement.amount))}</td>
              <td><span class="code code-ok">${escapeHtml(movement.final_reason_code)}</span></td>
              <td><span class="result-ok">✓ Cobrado</span></td>
            </tr>
          `,
        )
        .join("");

    const renderUnpaidRows = (
      movements: RecoveryResult[],
    ) =>
      movements
        .map(
          (movement) => {
            const origin =
              getReturnOrigin(
                movement,
              );

            return `
              <tr>
                <td>${escapeHtml(movement.bank_reference || "—")}</td>
                <td>${renderMemberCell(movement)}</td>
                <td class="name-cell">${escapeHtml(movement.name || "—")}</td>
                <td class="amount-cell">${escapeHtml(formatCurrency(movement.amount))}</td>
                <td>
                  <span class="code code-bad">${escapeHtml(movement.final_reason_code)}</span>
                  <span class="reason">${escapeHtml(movement.final_reason_description)}</span>
                </td>
                <td>
                  <span class="origin-badge">${escapeHtml(origin.label)}</span>
                  <span class="origin-description">${escapeHtml(origin.description)}</span>
                </td>
              </tr>
            `;
          },
        )
        .join("");

    /*
     * A paginação é feita pelo próprio relatório em blocos A4.
     * Assim conseguimos apresentar "1-7", "2-7", etc. no rodapé,
     * sem depender dos cabeçalhos/rodapés do navegador.
     */
    const recoveredPages =
      chunkItems(
        recoveredRecoveryResults,
        18,
      );

    const unpaidPages =
      chunkItems(
        unpaidRecoveryResults,
        13,
      );

    if (
      recoveredPages.length === 0
    ) {
      recoveredPages.push([]);
    }

    if (
      unpaidPages.length === 0
    ) {
      unpaidPages.push([]);
    }

    const totalPages =
      recoveredPages.length +
      unpaidPages.length;

    const totalAttempts =
      recoveredCount +
      unpaidCount;

    const renderHeader = (
      subtitle: string,
    ) => `
      <header class="report-header">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="EPIC Payments" />

        <div class="report-title">
          <h1>Relatório de Recuperação</h1>
          <span>${escapeHtml(subtitle)}</span>
        </div>
      </header>
    `;

    const renderContinuationHeader = (
      subtitle: string,
    ) => `
      <header class="report-header report-header-compact">
        <img class="logo logo-compact" src="${escapeHtml(logoUrl)}" alt="EPIC Payments" />

        <div class="report-title report-title-compact">
          <h1>Relatório de Recuperação</h1>
          <span>${escapeHtml(subtitle)}</span>
        </div>
      </header>
    `;

    const renderMetadata = () => `
      <div class="metadata">
        <div class="meta-card">
          <span class="label">Data de criação</span>
          <strong>${escapeHtml(formatDateTime(generatedAt))}</strong>
        </div>

        <div class="meta-card">
          <span class="label">Gerado por</span>
          <strong>${escapeHtml(generatedBy)}</strong>
        </div>

        <div class="meta-card meta-files">
          <span class="label">Ficheiros processados</span>
          <strong>${escapeHtml(fileNames)}</strong>
        </div>

        <div class="meta-card count-card count-total">
          <strong>${totalAttempts}</strong>
          <span class="label">tentativas</span>
        </div>

        <div class="meta-card count-card count-ok">
          <strong>${recoveredCount}</strong>
          <span class="label">recuperadas</span>
        </div>

        <div class="meta-card count-card count-bad">
          <strong>${unpaidCount}</strong>
          <span class="label">não recuperadas</span>
        </div>
      </div>
    `;

    const recoveredPagesHtml =
      recoveredPages
        .map(
          (movements, pageIndex) => {
            const pageNumber =
              pageIndex + 1;

            return `
              <section class="print-page">
                ${
                  pageIndex === 0
                    ? `${renderHeader(
                        "Resultado final da conciliação F1 + F2",
                      )}${renderMetadata()}`
                    : renderContinuationHeader(
                        "Cobranças recuperadas — continuação",
                      )
                }

                <div class="section-title section-title-ok">
                  <div class="section-title-main">
                    <strong>Cobranças recuperadas</strong>
                    <span>${recoveredCount} cobranças</span>
                  </div>

                  <small>
                    Cobranças aceites no Ficheiro 1 (código 0000) que não surgiram posteriormente como devolvidas/reembolsadas no Ficheiro 2.
                  </small>
                </div>

                <table class="recovered-table">
                  <thead>
                    <tr>
                      <th>Ref.</th>
                      <th>Nº Sócio</th>
                      <th>Nome</th>
                      <th>Valor</th>
                      <th>Código</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderRecoveredRows(movements)}
                  </tbody>
                </table>

                <footer class="page-footer">
                  <span>EPIC Payments · Relatório de Recuperação</span>
                  <strong>${pageNumber}-${totalPages}</strong>
                </footer>
              </section>
            `;
          },
        )
        .join("");

    const unpaidPagesHtml =
      unpaidPages
        .map(
          (movements, pageIndex) => {
            const pageNumber =
              recoveredPages.length +
              pageIndex +
              1;

            return `
              <section class="print-page">
                ${renderContinuationHeader(
                  pageIndex === 0
                    ? "Cobranças não recuperadas"
                    : "Cobranças não recuperadas — continuação",
                )}

                <div class="section-title section-title-bad">
                  <div class="section-title-main">
                    <strong>Cobranças não recuperadas</strong>
                    <span>${unpaidCount} cobranças</span>
                  </div>

                  <small>
                    Inclui cobranças rejeitadas no Ficheiro 1 e cobranças inicialmente aceites no F1 que surgiram depois como devolvidas/reembolsadas no F2.
                  </small>
                </div>

                <table class="unpaid-table">
                  <thead>
                    <tr>
                      <th>Ref.</th>
                      <th>Nº Sócio</th>
                      <th>Nome</th>
                      <th>Valor</th>
                      <th>Código / Motivo</th>
                      <th>Origem do não pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderUnpaidRows(movements)}
                  </tbody>
                </table>

                <footer class="page-footer">
                  <span>EPIC Payments · Relatório de Recuperação</span>
                  <strong>${pageNumber}-${totalPages}</strong>
                </footer>
              </section>
            `;
          },
        )
        .join("");

    const documentHtml = `
      <!doctype html>
      <html lang="pt">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>EPIC Payments - Relatório de Recuperação</title>

          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 10mm 12mm 10mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #151515;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .print-page {
              position: relative;
              width: 100%;
              height: 275mm;
              overflow: hidden;
              padding-bottom: 15mm;
              break-after: page;
              page-break-after: always;
            }

            .print-page:last-child {
              break-after: auto;
              page-break-after: auto;
            }

            .report-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8mm;
              border-bottom: 1.2pt solid #ef2733;
              padding-bottom: 5mm;
              margin-bottom: 5mm;
            }

            .logo {
              width: 43mm;
              max-height: 19mm;
              object-fit: contain;
              object-position: left center;
            }

            .report-title {
              text-align: right;
            }

            .report-title h1 {
              margin: 0;
              font-size: 17pt;
              font-weight: 900;
              letter-spacing: -0.02em;
              text-transform: uppercase;
            }

            .report-title span {
              display: block;
              margin-top: 1.5mm;
              color: #777777;
              font-size: 7.5pt;
              font-weight: 700;
            }


            .report-header-compact {
              padding-bottom: 2mm;
              margin-bottom: 2.5mm;
            }

            .logo-compact {
              width: 27mm;
              max-height: 10mm;
            }

            .report-title-compact h1 {
              font-size: 12.5pt;
            }

            .report-title-compact span {
              margin-top: 1mm;
              font-size: 6.8pt;
            }

            .metadata {
              display: grid;
              grid-template-columns: 0.92fr 0.78fr 1.6fr 0.68fr 0.68fr 0.82fr;
              gap: 2.2mm;
              margin-bottom: 5mm;
            }

            .meta-card {
              min-height: 18mm;
              border: 0.7pt solid #dddddd;
              border-radius: 3.4mm;
              background:
                linear-gradient(
                  180deg,
                  #ffffff 0%,
                  #f7f7f7 100%
                );
              padding: 3.2mm 3.3mm;
              box-shadow:
                0 1.4mm 4mm
                rgba(0, 0, 0, 0.055);
            }

            .meta-card .label {
              display: block;
              margin-bottom: 1.4mm;
              color: #777777;
              font-size: 6.2pt;
              font-weight: 800;
              text-transform: uppercase;
            }

            .meta-card strong {
              display: block;
              color: #161616;
              font-size: 7.8pt;
              font-weight: 850;
              line-height: 1.3;
            }

            .meta-files strong {
              overflow-wrap: anywhere;
              font-size: 6.8pt;
            }

            .count-card {
              display: flex;
              flex-direction: column;
              justify-content: center;
              text-align: center;
            }

            .count-card strong {
              font-size: 17pt;
              line-height: 1;
            }

            .count-card .label {
              margin: 1.4mm 0 0;
              font-size: 5.8pt;
            }

            .count-total {
              border-color: rgba(35, 35, 35, 0.20);
              background:
                linear-gradient(
                  180deg,
                  #ffffff 0%,
                  #eeeeee 100%
                );
            }

            .count-total strong {
              color: #191919;
            }

            .count-total .label {
              color: #5f5f5f;
            }

            .count-ok {
              border-color: rgba(22, 126, 65, 0.28);
              background: rgba(22, 126, 65, 0.045);
            }

            .count-ok strong,
            .count-ok .label {
              color: #167e41;
            }

            .count-bad {
              border-color: rgba(211, 25, 38, 0.28);
              background: rgba(211, 25, 38, 0.045);
            }

            .count-bad strong,
            .count-bad .label {
              color: #d31926;
            }

            .section-title {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 6mm;
              border-radius: 2.5mm 2.5mm 0 0;
              padding: 3.2mm 3.8mm;
              color: #ffffff;
            }

            .section-title-ok {
              background: #167e41;
            }

            .section-title-bad {
              background: #d31926;
            }

            .section-title-main {
              display: flex;
              align-items: baseline;
              gap: 3mm;
            }

            .section-title-main strong {
              font-size: 11pt;
              font-weight: 900;
              text-transform: uppercase;
            }

            .section-title-main span {
              font-size: 7pt;
              font-weight: 800;
            }

            .section-title small {
              max-width: 92mm;
              font-size: 6.3pt;
              font-weight: 650;
              line-height: 1.35;
              text-align: right;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 7pt;
            }

            thead {
              display: table-header-group;
            }

            tr {
              break-inside: avoid;
              page-break-inside: avoid;
              orphans: 1;
              widows: 1;
            }

            tbody tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            th {
              border-bottom: 0.7pt solid #d6d6d6;
              background: #f3f3f3;
              padding: 2.2mm 2mm;
              color: #555555;
              font-size: 6.2pt;
              font-weight: 900;
              text-align: left;
              text-transform: uppercase;
            }

            td {
              border-bottom: 0.45pt solid #e5e5e5;
              padding: 2.15mm 2mm;
              vertical-align: middle;
              line-height: 1.22;
              overflow-wrap: anywhere;
            }

            .recovered-table tbody tr:nth-child(even) {
              background: rgba(22, 126, 65, 0.027);
            }

            .unpaid-table tbody tr:nth-child(even) {
              background: rgba(211, 25, 38, 0.027);
            }

            .amount-cell {
              font-weight: 800;
              white-space: nowrap;
            }

            .name-cell {
              font-weight: 700;
            }

            .member-cell {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 0.45mm;
            }

            .member-cell strong {
              font-size: 7pt;
              font-weight: 850;
            }

            .bank-member-reference {
              display: block;
              color: #b06a00;
              font-size: 5.8pt;
              font-weight: 800;
              line-height: 1.15;
            }

            .recovered-table th:nth-child(1),
            .recovered-table td:nth-child(1) { width: 10%; }
            .recovered-table th:nth-child(2),
            .recovered-table td:nth-child(2) { width: 13%; }
            .recovered-table th:nth-child(3),
            .recovered-table td:nth-child(3) { width: 28%; }
            .recovered-table th:nth-child(4),
            .recovered-table td:nth-child(4) { width: 13%; }
            .recovered-table th:nth-child(5),
            .recovered-table td:nth-child(5) { width: 13%; }
            .recovered-table th:nth-child(6),
            .recovered-table td:nth-child(6) { width: 23%; }

            .unpaid-table th:nth-child(1),
            .unpaid-table td:nth-child(1) { width: 8%; }
            .unpaid-table th:nth-child(2),
            .unpaid-table td:nth-child(2) { width: 11%; }
            .unpaid-table th:nth-child(3),
            .unpaid-table td:nth-child(3) { width: 20%; }
            .unpaid-table th:nth-child(4),
            .unpaid-table td:nth-child(4) { width: 10%; }
            .unpaid-table th:nth-child(5),
            .unpaid-table td:nth-child(5) { width: 23%; }
            .unpaid-table th:nth-child(6),
            .unpaid-table td:nth-child(6) { width: 28%; }

            .code {
              font-weight: 900;
            }

            .code-ok {
              display: inline-block;
              border: 0.6pt solid rgba(22, 126, 65, 0.32);
              border-radius: 8mm;
              background: rgba(22, 126, 65, 0.06);
              padding: 1mm 2.2mm;
              color: #167e41;
              font-size: 6.4pt;
            }

            .code-bad {
              display: block;
              margin-bottom: 0.7mm;
              color: #d31926;
              font-size: 6.7pt;
            }

            .result-ok {
              color: #167e41;
              font-size: 6.8pt;
              font-weight: 900;
              text-transform: uppercase;
            }

            .reason {
              display: block;
              color: #454545;
              font-size: 6.1pt;
              line-height: 1.3;
            }

            .origin-badge {
              display: inline-block;
              margin-bottom: 1mm;
              border: 0.6pt solid rgba(211, 25, 38, 0.28);
              border-radius: 8mm;
              background: rgba(211, 25, 38, 0.05);
              padding: 0.9mm 1.8mm;
              color: #c81824;
              font-size: 5.7pt;
              font-weight: 900;
              line-height: 1.2;
              text-transform: uppercase;
            }

            .origin-description {
              display: block;
              color: #555555;
              font-size: 5.9pt;
              line-height: 1.3;
            }


            .unpaid-table td {
              line-height: 1.38;
            }

            .unpaid-table .reason,
            .unpaid-table .origin-description {
              line-height: 1.35;
            }

            .recovered-table,
            .unpaid-table {
              margin-bottom: 8mm;
            }


            /* Compactação para aproveitar melhor a folha A4 */
            .unpaid-table th,
            .recovered-table th {
              padding-top: 2.1mm;
              padding-bottom: 2.1mm;
            }

            .unpaid-table td {
              padding-top: 2.45mm;
              padding-bottom: 2.45mm;
              line-height: 1.24;
            }

            .recovered-table td {
              padding-top: 2.25mm;
              padding-bottom: 2.25mm;
              line-height: 1.20;
            }

            .section-title {
              margin-bottom: 2.5mm;
            }

            .page-footer {
              position: absolute;
              right: 0;
              bottom: 2.5mm;
              left: 0;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-top: 0.6pt solid #dddddd;
              padding-top: 2.2mm;
              color: #777777;
              font-size: 6.2pt;
              font-weight: 700;
            }

            .page-footer strong {
              color: #202020;
              font-size: 7pt;
              font-weight: 900;
            }
          </style>
        </head>

        <body>
          ${recoveredPagesHtml}
          ${unpaidPagesHtml}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(
      documentHtml,
    );
    printWindow.document.close();

    const images =
      Array.from(
        printWindow.document.images,
      );

    const imagePromises =
      images.map(
        (image) => {
          if (image.complete) {
            return Promise.resolve();
          }

          return new Promise<void>(
            (resolve) => {
              image.onload =
                () => resolve();
              image.onerror =
                () => resolve();
            },
          );
        },
      );

    void Promise.all(
      imagePromises,
    ).then(
      () => {
        window.setTimeout(
          () => {
            printWindow.focus();
            printWindow.print();
          },
          120,
        );
      },
    );
  }


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
              {isRecoverySelection
                ? "Processamento de recuperação"
                : "Processamento bancário"}
            </h1>

            <p>
              {formatDate(selection.date)}
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
              {isRecoverySelection
                ? "Recuperação"
                : "PDF"}
            </span>

            <strong>
              {isRecoverySelection
                ? recoveryFiles.length
                : pdfCount}
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
              Movimentos lidos
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
              {isRecoverySelection
                ? "Conteúdo original de cada ficheiro"
                : "Todos os movimentos apresentados por ficheiro"}
            </h2>

            <p>
              {isRecoverySelection
                ? "F1 e F2 são apresentados separadamente. Nesta fase ainda não é feita qualquer conciliação entre os dois ficheiros."
                : showOnlyUnpaid
                  ? "A mostrar apenas os sócios com cobrança não paga."
                  : "São apresentados todos os movimentos bancários, incluindo pagamentos aceites e rejeitados."}
            </p>
          </div>

          {!isRecoverySelection ? (
            <button
              type="button"
              className="processing-filter-button"
              disabled={!hasLoadedMovements}
              aria-pressed={
                showOnlyUnpaid
              }
              onClick={() =>
                setShowOnlyUnpaid(
                  (current) =>
                    !current,
                )
              }
            >
              <Filter size={17} />
              {showOnlyUnpaid
                ? "Mostrar todos"
                : "Filtrar sócios"}
            </button>
          ) : null}
        </section>


        <div className="processing-file-groups">
          {fileStates.map(
            (state, index) => {
              const Icon =
                getFileIcon(
                  state.file,
                );

              const recovery =
                isRecoveryFile(
                  state.file,
                );

              const recoveryPart =
                getRecoveryPart(
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
                          {recovery
                            ? `RECUPERAÇÃO · FICHEIRO ${recoveryPart ?? "—"}`
                            : state.file.type.toUpperCase()}

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
                        <CheckCircle2
                          size={13}
                        />
                        Leitura concluída
                      </span>
                    ) : null}

                    {!state.loading &&
                    state.error ? (
                      <span className="processing-file-state processing-file-state-warning">
                        <AlertTriangle
                          size={13}
                        />
                        Leitura indisponível
                      </span>
                    ) : null}
                  </header>


                  <div className="processing-table-shell">
                    {recovery ? (
                      <div className="processing-table-head processing-recovery-source-grid">
                        <span>
                          Ref. Cobrança
                        </span>
                        <span>Nº Sócio</span>
                        <span>Nome</span>
                        <span>Valor</span>
                        <span>Código</span>
                      </div>
                    ) : (
                      <div className="processing-table-head">
                        <span>Nº Sócio</span>
                        <span>Nome</span>
                        <span>Valor</span>
                        <span>Motivo</span>
                        <span>Telemóvel</span>
                        <span>Email</span>
                        <span>Idade</span>
                      </div>
                    )}


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
                          O EPIC Payments está a analisar o ficheiro.
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
                          Não foi possível ler o ficheiro
                        </strong>

                        <span>
                          {state.error}
                        </span>
                      </div>
                    ) : null}


                    {!state.loading &&
                    state.data ? (
                      <div className="processing-table-body">
                        {state.data.movements
                          .filter(
                            (movement) =>
                              !recovery &&
                              showOnlyUnpaid
                                ? movement.reason_code !==
                                  "0000"
                                : true,
                          )
                          .map(
                            (movement) => {
                              const accepted =
                                movement.reason_code ===
                                "0000";

                              const normalized =
                                movement.original_member_reference !==
                                movement.member_number;

                              if (recovery) {
                                return (
                                  <div
                                    key={`${state.file.id}-${movement.sequence}`}
                                    className={[
                                      "processing-table-row",
                                      "processing-recovery-source-grid",
                                      accepted
                                        ? "processing-table-row-accepted"
                                        : "processing-table-row-rejected",
                                    ].join(
                                      " ",
                                    )}
                                  >
                                    <div>
                                      <strong>
                                        {movement.bank_reference ||
                                          "—"}
                                      </strong>
                                    </div>

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
                                      <ReasonCodeTooltip
                                        code={
                                          movement.reason_code ||
                                          "—"
                                        }
                                        description={
                                          movement.reason_description ||
                                          ""
                                        }
                                        accepted={
                                          accepted
                                        }
                                      />
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={`${state.file.id}-${movement.sequence}`}
                                  className={[
                                    "processing-table-row",
                                    accepted
                                      ? "processing-table-row-accepted"
                                      : "processing-table-row-rejected",
                                  ].join(
                                    " ",
                                  )}
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
                                    <ReasonCodeTooltip
                                      code={
                                        movement.reason_code ||
                                        "—"
                                      }
                                      description={
                                        movement.reason_description ||
                                        ""
                                      }
                                      accepted={
                                        accepted
                                      }
                                    />
                                  </div>

                                  <div>
                                    {movement.phone ||
                                      "—"}
                                  </div>

                                  <div>
                                    {movement.email ||
                                      "—"}
                                  </div>

                                  <div>
                                    {movement.age != null
                                      ? `${movement.age} anos`
                                      : "—"}
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


        {isRecoverySelection ? (
          <>
            <section className="recovery-step-section">
              <div className="recovery-step-heading">
                <span className="section-label">
                  Fluxo de recuperação
                </span>

                <h2>
                  Tratamento F1 + F2
                </h2>

                <p>
                  As duas etapas abaixo são executadas pela ordem indicada.
                </p>
              </div>

              <div className="recovery-action-grid recovery-action-grid-two">
                <button
                  type="button"
                  className={[
                    "recovery-action-card",
                    recoveryResults
                      ? "recovery-action-card-complete"
                      : "",
                  ].join(" ")}
                  disabled={
                    !recoveryPairReady
                  }
                  onClick={
                    handleRecoveryFilter
                  }
                >

                  <span className="recovery-action-icon">
                    <SearchCheck
                      size={24}
                    />
                  </span>

                  <span className="recovery-action-copy">
                    <strong>
                      Realizar filtragem
                    </strong>

                    <small>
                      Conciliar F1 e F2 pela Referência da Cobrança e determinar pago / não pago.
                    </small>
                  </span>

                  {recoveryResults ? (
                    <CheckCircle2
                      className="recovery-action-check"
                      size={19}
                    />
                  ) : null}
                </button>


                <button
                  type="button"
                  className="recovery-action-card"
                  disabled={
                    !recoveryResults
                  }
                  onClick={
                    handlePreparePrint
                  }
                >

                  <span className="recovery-action-icon">
                    <Printer
                      size={24}
                    />
                  </span>

                  <span className="recovery-action-copy">
                    <strong>
                      Imprimir
                    </strong>

                    <small>
                      Abrir diretamente a impressão com os dados resultantes da filtragem F1 + F2.
                    </small>
                  </span>

                </button>
              </div>
            </section>


            {recoveryResults ? (
              <section
                id="recovery-filter-result"
                className="recovery-result-card"
              >
                <header className="recovery-result-header">
                  <div>
                    <span className="section-label">
                      Resultado da etapa 01
                    </span>

                    <h2>
                      Conciliação F1 + F2
                    </h2>

                    <p>
                      Resultado calculado exclusivamente pela Referência da Cobrança.
                    </p>
                  </div>

                  <div className="recovery-result-stats">
                    <span className="recovery-stat recovery-stat-success">
                      <strong>
                        {recoveredCount}
                      </strong>
                      recuperados
                    </span>

                    <span className="recovery-stat recovery-stat-danger">
                      <strong>
                        {unpaidCount}
                      </strong>
                      não pagos
                    </span>
                  </div>
                </header>

                <div className="recovery-result-table">
                  <div className="recovery-result-table-head recovery-filter-grid">
                    <span>
                      Ref. Cobrança
                    </span>
                    <span>Nº Sócio</span>
                    <span>Nome</span>
                    <span>Valor</span>
                    <span>Estado</span>
                    <span>Código</span>
                    <span>Conclusão</span>
                  </div>

                  {recoveryResults.map(
                    (movement) => (
                      <div
                        key={`filtered-${movement.sequence}-${movement.bank_reference}`}
                        className={[
                          "recovery-result-table-row",
                          "recovery-filter-grid",
                          movement.recovery_status ===
                          "RECUPERADA"
                            ? "recovery-result-row-success"
                            : "recovery-result-row-danger",
                        ].join(" ")}
                      >
                        <div>
                          {movement.bank_reference ||
                            "—"}
                        </div>

                        <div>
                          <strong>
                            {movement.member_number ||
                              "—"}
                          </strong>
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

                        <div>
                          <span
                            className={[
                              "recovery-status-badge",
                              movement.recovery_status ===
                              "RECUPERADA"
                                ? "recovery-status-badge-success"
                                : "recovery-status-badge-danger",
                            ].join(
                              " ",
                            )}
                          >
                            {movement.recovery_status ===
                            "RECUPERADA"
                              ? "PAGO / RECUPERADO"
                              : "NÃO PAGO"}
                          </span>
                        </div>

                        <div>
                          <ReasonCodeTooltip
                            code={
                              movement.final_reason_code
                            }
                            description={
                              movement.final_reason_description
                            }
                            accepted={
                              movement.recovery_status ===
                              "RECUPERADA"
                            }
                          />
                        </div>

                        <div className="recovery-conclusion-cell">
                          {
                            movement.conclusion
                          }
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            ) : null}




          </>
        ) : null}
      </main>
    </div>
  );
}
