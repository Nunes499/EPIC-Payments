"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileDown,
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


type BankPdfMovement = {
  collection_reference: string;
  adc_reference: string;
  debtor_name: string;
  debtor_iban: string;
  amount: number;
  reason_code: string;
  reason_description: string;
};


type BankPdfReport = {
  report_date: string;
  file_identification: string;
  file_total_amount: number;
  file_total_records: number;
  return_date: string;
  creditor_reference: string;
  return_type: string;
  creditor_name: string;
  creditor_iban: string;
  settlement_date: string;
  lot_identification: string;
  accepted_count: number;
  accepted_amount: number;
  rejected_count: number;
  rejected_amount: number;
  movements: BankPdfMovement[];
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


function isAcceptedMovement(
  movement: ApiBankMovement,
): boolean {
  return movement.reason_code === "0000";
}


function isImportantRejectedCode(
  movement: ApiBankMovement,
): boolean {
  const code = (
    movement.reason_code || ""
  )
    .trim()
    .toUpperCase();

  return (
    code !== "" &&
    code !== "0000" &&
    code !== "AM04"
  );
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


function formatBankDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const clean = value.slice(0, 10);
  const parts = clean.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}


function formatBankNumber(
  value: number,
): string {
  const fixed = value.toFixed(2);
  const [integerPart, decimalPart] =
    fixed.split(".");

  const groupedInteger =
    integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ".",
    );

  return `${groupedInteger},${decimalPart}`;
}


function formatBankEuro(
  value: number,
): string {
  return `${formatBankNumber(value)} EUR`;
}


function formatBankTableEuro(
  value: number,
): string {
  return `${formatBankNumber(value)} €`;
}


function elementChildrenByLocalName(
  parent: Element | Document,
  localName: string,
): Element[] {
  return Array.from(
    parent.getElementsByTagName("*"),
  ).filter(
    (element) =>
      element.localName === localName,
  );
}


function firstDirectDescendantText(
  parent: Element | Document,
  localName: string,
): string {
  const element =
    elementChildrenByLocalName(
      parent,
      localName,
    )[0];

  return element?.textContent?.trim() || "";
}


function firstTextAlongPath(
  parent: Element,
  path: string[],
): string {
  let current: Element | null = parent;

  for (const localName of path) {
    if (!current) {
      return "";
    }

    current =
      Array.from(
        current.children,
      ).find(
        (child) =>
          child.localName === localName,
      ) || null;
  }

  return current?.textContent?.trim() || "";
}


function getReturnTypeFromXml(
  xml: Document,
): string {
  const proprietaryCodes =
    elementChildrenByLocalName(
      xml,
      "Prtry",
    ).map(
      (element) =>
        element.textContent
          ?.trim()
          .toUpperCase() || "",
    );

  if (
    proprietaryCodes.includes("M009") ||
    proprietaryCodes.includes("L002")
  ) {
    return "Retorno - Devoluções/Reembolsos";
  }

  return "Retorno - Rejeições";
}


function buildBankPdfReport(
  xmlText: string,
  processedData: ApiBankFileProcessing,
): BankPdfReport {
  const parser = new DOMParser();
  const xml =
    parser.parseFromString(
      xmlText,
      "application/xml",
    );

  if (
    xml.getElementsByTagName(
      "parsererror",
    ).length > 0
  ) {
    throw new Error(
      "Não foi possível interpretar o XML para gerar o PDF.",
    );
  }

  const groupHeader =
    elementChildrenByLocalName(
      xml,
      "GrpHdr",
    )[0];

  const originalGroup =
    elementChildrenByLocalName(
      xml,
      "OrgnlGrpInfAndSts",
    )[0];

  const paymentGroup =
    elementChildrenByLocalName(
      xml,
      "OrgnlPmtInfAndSts",
    )[0];

  const reportDateRaw =
    groupHeader
      ? firstDirectDescendantText(
          groupHeader,
          "CreDtTm",
        )
      : "";

  const fileIdentification =
    originalGroup
      ? firstDirectDescendantText(
          originalGroup,
          "OrgnlMsgId",
        )
      : "";

  const lotIdentification =
    paymentGroup
      ? firstDirectDescendantText(
          paymentGroup,
          "OrgnlPmtInfId",
        )
      : fileIdentification;

  const fileTotalRecords =
    Number(
      originalGroup
        ? firstDirectDescendantText(
            originalGroup,
            "OrgnlNbOfTxs",
          )
        : 0,
    ) || 0;

  const fileTotalAmount =
    Number(
      originalGroup
        ? firstDirectDescendantText(
            originalGroup,
            "OrgnlCtrlSum",
          )
        : 0,
    ) || 0;

  const processedReasonMap =
    new Map<string, string>();

  for (
    const movement
    of processedData.movements
  ) {
    const key = [
      movement.original_member_reference || "",
      String(
        Number(
          movement.amount || 0,
        ).toFixed(2),
      ),
      (
        movement.reason_code || ""
      ).toUpperCase(),
    ].join("|");

    if (
      movement.reason_description &&
      !processedReasonMap.has(key)
    ) {
      processedReasonMap.set(
        key,
        movement.reason_description,
      );
    }
  }

  const transactionElements =
    elementChildrenByLocalName(
      xml,
      "TxInfAndSts",
    );

  const movements: BankPdfMovement[] =
    transactionElements.map(
      (transaction) => {
        const originalTxRef =
          Array.from(
            transaction.children,
          ).find(
            (child) =>
              child.localName ===
              "OrgnlTxRef",
          );

        const reasonCode =
          (
            firstTextAlongPath(
              transaction,
              [
                "StsRsnInf",
                "Rsn",
                "Cd",
              ],
            ) ||
            firstTextAlongPath(
              transaction,
              [
                "StsRsnInf",
                "Rsn",
                "Prtry",
              ],
            )
          )
            .trim()
            .toUpperCase();

        const collectionReference =
          firstDirectDescendantText(
            transaction,
            "OrgnlEndToEndId",
          );

        const adcReference =
          originalTxRef
            ? firstTextAlongPath(
                originalTxRef,
                [
                  "MndtRltdInf",
                  "MndtId",
                ],
              )
            : "";

        const debtorName =
          originalTxRef
            ? firstTextAlongPath(
                originalTxRef,
                [
                  "Dbtr",
                  "Pty",
                  "Nm",
                ],
              )
            : "";

        const debtorIban =
          originalTxRef
            ? firstTextAlongPath(
                originalTxRef,
                [
                  "DbtrAcct",
                  "Id",
                  "IBAN",
                ],
              )
            : "";

        const amount =
          Number(
            originalTxRef
              ? firstTextAlongPath(
                  originalTxRef,
                  [
                    "Amt",
                    "InstdAmt",
                  ],
                )
              : 0,
          ) || 0;

        const reasonKey = [
          adcReference,
          amount.toFixed(2),
          reasonCode,
        ].join("|");

        const processedReasonDescription =
          processedReasonMap.get(
            reasonKey,
          ) || "";

        const reasonDescription =
          reasonCode === "0000"
            ? "Normal; lançamento executado; relação de dados válida"
            : reasonCode === "AM04"
              ? "Insuficiência de fundos"
              : (
                  processedReasonDescription ||
                  "Rejeição bancária"
                );

        return {
          collection_reference:
            collectionReference,
          adc_reference:
            adcReference,
          debtor_name:
            debtorName,
          debtor_iban:
            debtorIban,
          amount,
          reason_code:
            reasonCode,
          reason_description:
            reasonDescription,
        };
      },
    );

  const firstTxRef =
    transactionElements.length > 0
      ? Array.from(
          transactionElements[0]
            .children,
        ).find(
          (child) =>
            child.localName ===
            "OrgnlTxRef",
        )
      : undefined;

  const creditorReference =
    firstTxRef
      ? firstTextAlongPath(
          firstTxRef,
          [
            "CdtrSchmeId",
            "Id",
            "PrvtId",
            "Othr",
            "Id",
          ],
        )
      : "";

  const creditorName =
    firstTxRef
      ? firstTextAlongPath(
          firstTxRef,
          [
            "Cdtr",
            "Pty",
            "Nm",
          ],
        )
      : "";

  const creditorIban =
    firstTxRef
      ? firstTextAlongPath(
          firstTxRef,
          [
            "CdtrAcct",
            "Id",
            "IBAN",
          ],
        )
      : "";

  const settlementDate =
    firstTxRef
      ? firstDirectDescendantText(
          firstTxRef,
          "ReqdColltnDt",
        )
      : "";

  const accepted =
    movements.filter(
      (movement) =>
        movement.reason_code === "0000",
    );

  const rejected =
    movements.filter(
      (movement) =>
        movement.reason_code !== "0000",
    );

  return {
    report_date:
      formatBankDate(
        reportDateRaw,
      ),
    file_identification:
      fileIdentification,
    file_total_amount:
      fileTotalAmount,
    file_total_records:
      fileTotalRecords ||
      movements.length,
    return_date:
      formatBankDate(
        reportDateRaw,
      ),
    creditor_reference:
      creditorReference,
    return_type:
      getReturnTypeFromXml(xml),
    creditor_name:
      creditorName,
    creditor_iban:
      creditorIban,
    settlement_date:
      formatBankDate(
        settlementDate,
      ),
    lot_identification:
      lotIdentification ||
      fileIdentification,
    accepted_count:
      accepted.length,
    accepted_amount:
      accepted.reduce(
        (sum, movement) =>
          sum + movement.amount,
        0,
      ),
    rejected_count:
      rejected.length,
    rejected_amount:
      rejected.reduce(
        (sum, movement) =>
          sum + movement.amount,
        0,
      ),
    movements,
  };
}


function paginateBankMovements(
  movements: BankPdfMovement[],
): BankPdfMovement[][] {
  if (movements.length === 0) {
    return [[]];
  }

  const pages: BankPdfMovement[][] = [];
  let index = 0;

  /*
   * O PDF real do banco usa uma primeira página
   * com cabeçalho completo e cerca de 12 movimentos.
   * As páginas seguintes usam praticamente toda a
   * folha e apresentam cerca de 27 movimentos.
   */
  pages.push(
    movements.slice(
      index,
      index + 12,
    ),
  );
  index += 12;

  while (index < movements.length) {
    pages.push(
      movements.slice(
        index,
        index + 27,
      ),
    );
    index += 27;
  }

  return pages;
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
        "Devolução identificada no Ficheiro 1 (F1)",
      description:
        "A cobrança já constava como devolvida no Ficheiro 1.",
    };
  }

  return {
    label:
      "Devolução identificada no Ficheiro 2 (F2)",
    description:
      "A devolução foi registada no Ficheiro 2 após a tentativa de recuperação.",
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


  const [
    printReady,
    setPrintReady,
  ] = useState(false);


  const [
    reportGeneratedAt,
    setReportGeneratedAt,
  ] = useState<Date | null>(null);

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
      setPrintReady(false);
      setReportGeneratedAt(null);
      return;
    }

    setShowOnlyUnpaid(false);
    setRecoveryResults(null);
    setPrintReady(false);
    setReportGeneratedAt(null);

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
      const uniqueMovements =
        new Map<string, ApiBankMovement>();

      for (const item of fileStates) {
        if (!item.data) {
          continue;
        }

        for (
          const movement
          of item.data.movements
        ) {
          /*
           * Evita contar duas vezes o mesmo movimento
           * quando o banco envia o mesmo lote em PDF + XML.
           * Mantemos os dados originais do movimento.
           */
          const key = [
            movement.original_member_reference || "",
            movement.name || "",
            String(movement.amount || ""),
            movement.reason_code || "",
            movement.collection_date || "",
          ].join("|");

          if (!uniqueMovements.has(key)) {
            uniqueMovements.set(
              key,
              movement,
            );
          }
        }
      }

      const movements =
        Array.from(
          uniqueMovements.values(),
        );

      const accepted =
        movements.filter(
          isAcceptedMovement,
        );

      const rejected =
        movements.filter(
          (movement) =>
            !isAcceptedMovement(
              movement,
            ),
        );

      const amount =
        movements.reduce(
          (total, movement) =>
            total +
            Number(
              movement.amount || 0,
            ),
          0,
        );

      const acceptedAmount =
        accepted.reduce(
          (total, movement) =>
            total +
            Number(
              movement.amount || 0,
            ),
          0,
        );

      const rejectedAmount =
        rejected.reduce(
          (total, movement) =>
            total +
            Number(
              movement.amount || 0,
            ),
          0,
        );

      return {
        movements: movements.length,
        amount,
        accepted: accepted.length,
        acceptedAmount,
        rejected: rejected.length,
        rejectedAmount,
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

  const unpaidRecoveryResults =
    recoveryResults?.filter(
      (movement) =>
        movement.recovery_status ===
        "NAO_PAGA",
    ) ?? [];

  const recoveredCount =
    recoveryResults?.filter(
      (movement) =>
        movement.recovery_status ===
        "RECUPERADA",
    ).length ?? 0;

  const unpaidCount =
    unpaidRecoveryResults.length;

  const unpaidAmount =
    unpaidRecoveryResults.reduce(
      (total, movement) =>
        total + Number(movement.amount),
      0,
    );


  async function handleGenerateBankPdf(
    state: ProcessingFileState,
  ) {
    if (
      !state.data ||
      state.file.type !== "xml"
    ) {
      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1000,height=760",
      );

    if (!printWindow) {
      window.alert(
        "O navegador bloqueou a janela do PDF. Permita pop-ups para o EPIC Payments e tente novamente.",
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>A preparar PDF bancário...</title>
          <style>
            body {
              margin: 0;
              display: grid;
              min-height: 100vh;
              place-items: center;
              background: #f4f4f4;
              font-family: Arial, Helvetica, sans-serif;
              color: #111;
            }
            .loading {
              padding: 24px 30px;
              border: 1px solid #ddd;
              border-radius: 10px;
              background: white;
              font-size: 14px;
              font-weight: 700;
              box-shadow: 0 12px 30px rgba(0,0,0,.08);
            }
          </style>
        </head>
        <body>
          <div class="loading">
            A preparar o PDF no formato bancário...
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ??
        "http://localhost:8000";

      const response =
        await fetch(
          `${apiUrl}/files/${state.file.id}/download`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Não foi possível obter o XML original.",
        );
      }

      const xmlText =
        await response.text();

      const report =
        buildBankPdfReport(
          xmlText,
          state.data,
        );

      const pages =
        paginateBankMovements(
          report.movements,
        );

      const totalPages =
        pages.length;

      const tableHeader = `
        <thead>
          <tr>
            <th class="col-ref">
              Referência da<br />Cobrança
            </th>
            <th class="col-adc">
              Referência da<br />ADC
            </th>
            <th class="col-name">
              Nome do Devedor
            </th>
            <th class="col-iban">
              IBAN do Devedor
            </th>
            <th class="col-amount">
              Montante
            </th>
            <th class="col-code">
              Código de retorno
            </th>
          </tr>
        </thead>
      `;

      const renderRows = (
        rows: BankPdfMovement[],
      ) =>
        rows.map(
          (movement) => `
            <tr>
              <td class="center">
                ${escapeHtml(
                  movement.collection_reference,
                )}
              </td>
              <td>
                ${escapeHtml(
                  movement.adc_reference,
                )}
              </td>
              <td>
                ${escapeHtml(
                  movement.debtor_name,
                )}
              </td>
              <td class="iban">
                ${escapeHtml(
                  movement.debtor_iban,
                )}
              </td>
              <td class="amount">
                ${escapeHtml(
                  formatBankTableEuro(
                    movement.amount,
                  ),
                )}
              </td>
              <td class="return-code">
                ${escapeHtml(
                  movement.reason_code,
                )}
                -
                ${escapeHtml(
                  movement.reason_description,
                )}
              </td>
            </tr>
          `,
        ).join("");

      const renderPage = (
        rows: BankPdfMovement[],
        pageNumber: number,
      ) => {
        const firstPage =
          pageNumber === 1;

        return `
          <section class="bank-page">
            ${
              firstPage
                ? `
                  <div class="report-date">
                    Data de Emissão do Relatório:&nbsp;
                    ${escapeHtml(
                      report.report_date,
                    )}
                  </div>

                  <div class="epic-logo-wrap">
                    <img
                      src="${window.location.origin}/branding/logo-epic-payments-dark.png"
                      alt="EPIC Payments"
                    />
                  </div>

                  <h1>
                    Detalhe do Retorno do Ficheiro de Cobranças
                  </h1>

                  <div class="first-info">
                    <div>
                      Identificação do Ficheiro:<strong>${escapeHtml(
                        report.file_identification,
                      )}</strong>
                    </div>
                    <div>
                      Nº Total de Registos de Ficheiro:<strong>${report.file_total_records}</strong>
                    </div>
                    <div>
                      Montante Total do Ficheiro:<strong>${escapeHtml(
                        formatBankEuro(
                          report.file_total_amount,
                        ),
                      )}</strong>
                    </div>
                    <div>
                      Data de Emissão do Retorno:<strong>${escapeHtml(
                        report.return_date,
                      )}</strong>
                    </div>
                  </div>

                  <div class="bank-rule"></div>

                  <div class="second-info">
                    <div>
                      Tipo de Retorno:
                      <strong>${escapeHtml(
                        report.return_type,
                      )}</strong>
                    </div>
                    <div>
                      Referência da Entidade Credora:
                      <strong>${escapeHtml(
                        report.creditor_reference,
                      )}</strong>
                    </div>
                    <div>
                      Nome do Credor:
                      <strong>${escapeHtml(
                        report.creditor_name,
                      )}</strong>
                    </div>
                    <div>
                      IBAN do Credor:
                      <strong>${escapeHtml(
                        report.creditor_iban,
                      )}</strong>
                    </div>
                    <div>
                      Identificação do Lote:
                      <strong>${escapeHtml(
                        report.lot_identification,
                      )}</strong>
                    </div>
                    <div>
                      Data de Liquidação:
                      <strong>${escapeHtml(
                        report.settlement_date,
                      )}</strong>
                    </div>
                    <div>
                      Nº Total de Registos:
                      <strong>${report.movements.length}</strong>
                    </div>
                    <div>
                      Montante Total do Lote:
                      <strong>${escapeHtml(
                        formatBankEuro(
                          report.file_total_amount,
                        ),
                      )}</strong>
                    </div>
                    <div>
                      Cobranças Aceites*:
                      <strong>${report.accepted_count}</strong>
                    </div>
                    <div>
                      Montante de Cobranças Aceites:
                      <strong>${escapeHtml(
                        formatBankEuro(
                          report.accepted_amount,
                        ),
                      )}</strong>
                    </div>
                    <div>
                      Total de Cobranças Rejeitadas:
                      <strong>${report.rejected_count}</strong>
                    </div>
                    <div>
                      Montante de Cobranças Rejeitadas:
                      <strong>${escapeHtml(
                        formatBankEuro(
                          report.rejected_amount,
                        ),
                      )}</strong>
                    </div>
                  </div>

                  <div class="bank-note">
                    *Podem ocorrer devoluções/reembolsos de cobranças nas 8 semanas seguintes à data de liquidação.
                  </div>
                `
                : ""
            }

            <table
              class="${
                firstPage
                  ? "bank-table first-page-table"
                  : "bank-table"
              }"
            >
              ${tableHeader}
              <tbody>
                ${renderRows(rows)}
              </tbody>
            </table>

            <div class="page-number">
              Pág. ${pageNumber} de ${totalPages}
            </div>
          </section>
        `;
      };

      const pagesHtml =
        pages.map(
          (rows, index) =>
            renderPage(
              rows,
              index + 1,
            ),
        ).join("");

      const html = `
        <!doctype html>
        <html lang="pt">
          <head>
            <meta charset="utf-8" />
            <title>
              Detalhe do Retorno - ${escapeHtml(
                report.file_identification,
              )}
            </title>

            <style>
              * {
                box-sizing: border-box;
              }

              @page {
                size: A4 portrait;
                margin: 0;
              }

              html,
              body {
                margin: 0;
                padding: 0;
                background: #d9d9d9;
                color: #000;
                font-family: Arial, Helvetica, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              .toolbar {
                position: sticky;
                top: 0;
                z-index: 50;
                display: flex;
                justify-content: center;
                gap: 10px;
                padding: 12px;
                border-bottom: 1px solid #c5c5c5;
                background: rgba(245,245,245,.97);
              }

              .toolbar button {
                min-height: 38px;
                border: 1px solid #222;
                border-radius: 6px;
                background: #111;
                padding: 0 17px;
                color: #fff;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
              }

              .document {
                padding: 16px 0 24px;
              }

              .bank-page {
                position: relative;
                width: 210mm;
                height: 297mm;
                margin: 0 auto 14px;
                overflow: hidden;
                background: #fff;
                padding: 0;
                box-shadow:
                  0 3px 18px
                  rgba(0,0,0,.16);
                page-break-after: always;
                break-after: page;
              }

              .bank-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }

              /*
               * Medidas afinadas contra o PDF real do banco.
               * A única diferença pretendida é o logótipo EPIC Payments.
               */
              /*
               * Cabeçalho alinhado pelo PDF original do banco.
               * O conteúdo bancário mantém a posição original;
               * o logótipo EPIC é acrescentado apenas na margem
               * superior direita, sem empurrar o restante layout.
               */
              .report-date {
                position: absolute;
                top: 3.1mm;
                right: 47mm;
                margin: 0;
                text-align: right;
                font-size: 6.85pt;
                line-height: 1;
                font-weight: 400;
                white-space: nowrap;
              }

              .epic-logo-wrap {
                position: absolute;
                top: 3.1mm;
                right: 8.5mm;
                width: 34mm;
                height: 12mm;
                display: flex;
                align-items: flex-start;
                justify-content: flex-end;
                margin: 0;
                pointer-events: none;
              }

              .epic-logo-wrap img {
                width: 34mm;
                height: auto;
                max-height: 12mm;
                object-fit: contain;
                object-position: right top;
              }

              h1 {
                position: absolute;
                top: 12.8mm;
                left: 0;
                right: 0;
                margin: 0;
                text-align: center;
                font-size: 15.8pt;
                line-height: 1.04;
                font-weight: 400;
              }

              .first-info {
                position: absolute;
                top: 27.0mm;
                left: 0;
                right: 0;
                margin: 0;
                text-align: center;
                font-size: 7.65pt;
                line-height: 1.34;
                font-weight: 400;
              }

              .first-info strong,
              .second-info strong {
                font-weight: 400;
              }

              .bank-rule {
                position: absolute;
                top: 53.2mm;
                left: 8.9mm;
                width: 192mm;
                height: 0;
                margin: 0;
                border-top:
                  0.22mm solid
                  #202020;
              }

              .second-info {
                position: absolute;
                top: 60.3mm;
                left: 0;
                right: 0;
                margin: 0;
                text-align: center;
                font-size: 7.85pt;
                line-height: 1.50;
                font-weight: 400;
              }

              .bank-note {
                position: absolute;
                top: 124.9mm;
                left: 8.8mm;
                right: 2mm;
                margin: 0;
                text-align: left;
                font-size: 7.15pt;
                line-height: 1.08;
                font-weight: 400;
                white-space: nowrap;
              }

              .bank-table {
                position: absolute;
                top: 7.0mm;
                left: 7.0mm;
                width: 201mm;
                table-layout: fixed;
                border-collapse: collapse;
                font-size: 6.55pt;
                line-height: 1.06;
              }

              .first-page-table {
                top: 136.0mm;
              }

              .bank-table th,
              .bank-table td {
                border:
                  0.20mm solid
                  #202020;
              }

              .bank-table th {
                height: 10.58mm;
                background: #b9d8ea;
                padding: 0.65mm 0.8mm;
                text-align: center;
                vertical-align: middle;
                font-size: 6.65pt;
                line-height: 1.04;
                font-weight: 400;
              }

              .bank-table td {
                height: 9.43mm;
                padding: 0.52mm 1.15mm;
                vertical-align: top;
                font-size: 6.45pt;
                line-height: 1.04;
                font-weight: 400;
                overflow: hidden;
              }

              .bank-table .col-ref {
                width: 14.00%;
              }

              .bank-table .col-adc {
                width: 12.32%;
              }

              .bank-table .col-name {
                width: 19.26%;
              }

              .bank-table .col-iban {
                width: 24.63%;
              }

              .bank-table .col-amount {
                width: 8.74%;
              }

              .bank-table .col-code {
                width: 21.05%;
              }

              .bank-table .center {
                text-align: center;
              }

              .bank-table .iban {
                font-size: 6.15pt;
                line-height: 1.04;
                white-space: nowrap;
              }

              .bank-table .amount {
                text-align: right;
                white-space: nowrap;
              }

              .bank-table .return-code {
                padding-left: 1.2mm;
                padding-right: 0.9mm;
                font-size: 6.20pt;
                line-height: 1.03;
                font-weight: 400;
              }

              .page-number {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 15.8mm;
                text-align: center;
                font-size: 7.35pt;
                line-height: 1;
                font-weight: 400;
              }

              @media print {
                html,
                body {
                  background: #fff;
                }

                .toolbar {
                  display: none !important;
                }

                .document {
                  padding: 0;
                }

                .bank-page {
                  margin: 0;
                  box-shadow: none;
                }
              }
            </style>
          </head>

          <body>
            <div class="toolbar">
              <button
                type="button"
                onclick="window.print()"
              >
                Guardar / Imprimir PDF
              </button>
            </div>

            <main class="document">
              ${pagesHtml}
            </main>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF.";

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Erro ao gerar PDF</title>
            <style>
              body {
                margin: 0;
                display: grid;
                min-height: 100vh;
                place-items: center;
                background: #f5f5f5;
                font-family: Arial, Helvetica, sans-serif;
              }
              .error {
                max-width: 620px;
                border: 1px solid #e0aeb2;
                border-radius: 10px;
                background: #fff;
                padding: 24px;
                color: #b4232f;
                font-weight: 700;
              }
            </style>
          </head>
          <body>
            <div class="error">
              ${escapeHtml(message)}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }


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
    setPrintReady(false);
    setReportGeneratedAt(null);
  }


  function getRecoveryReportBaseName() {
    const f1Name =
      f1State?.file.name || "Recuperacao";

    const cleanName =
      f1Name
        .replace(/\.xml\.pdf$/i, "")
        .replace(/\.pdf$/i, "")
        .replace(/\.xml$/i, "")
        .replace(/[^\p{L}\p{N}]+/gu, "_")
        .replace(/^_+|_+$/g, "");

    const year =
      String(
        selection.date || "",
      ).slice(0, 4);

    const dateMatch =
      cleanName.match(/^(\d{2})(\d{2})/);

    let documentId = cleanName;

    if (
      dateMatch &&
      year.length === 4 &&
      !cleanName.startsWith(
        `${dateMatch[1]}${dateMatch[2]}${year}`,
      )
    ) {
      documentId =
        cleanName.replace(
          /^(\d{2})(\d{2})/,
          `${dateMatch[1]}${dateMatch[2]}${year}`,
        );
    }

    return (
      `Recuperacao_${documentId}_Resultado_Final`
    );
  }


  function handlePreparePrint() {
    if (
      !f1State?.data ||
      !f2State?.data
    ) {
      return;
    }

    const results =
      recoveryResults ||
      buildRecoveryResults(
        f1State.data,
        f2State.data,
      );

    setRecoveryResults(results);

    const generatedAt =
      new Date();

    setReportGeneratedAt(
      generatedAt,
    );
    setPrintReady(true);

    const recovered =
      results.filter(
        (movement) =>
          movement.recovery_status ===
          "RECUPERADA",
      );

    const unpaid =
      results.filter(
        (movement) =>
          movement.recovery_status ===
          "NAO_PAGA",
      );

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1050,height=780",
      );

    if (!printWindow) {
      window.alert(
        "O navegador bloqueou a janela do relatório. Permita pop-ups para o EPIC Payments e tente novamente.",
      );
      return;
    }

    const fileNames =
      selection.files
        .map(
          (file) => file.name,
        )
        .join(" + ");

    const reportName =
      getRecoveryReportBaseName();

    const escape = (
      value:
        | string
        | number
        | null
        | undefined,
    ) =>
      String(value ?? "—")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const pageSizeRecovered = 18;
    const pageSizeUnpaid = 11;

    const chunk = <T,>(
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

      return chunks.length > 0
        ? chunks
        : [[]];
    };

    const recoveredPages =
      chunk(
        recovered,
        pageSizeRecovered,
      );

    const unpaidPages =
      chunk(
        unpaid,
        pageSizeUnpaid,
      );

    const allPages = [
      ...recoveredPages.map(
        (rows, index) => ({
          type: "recovered" as const,
          rows,
          continuation:
            index > 0,
        }),
      ),
      ...unpaidPages.map(
        (rows, index) => ({
          type: "unpaid" as const,
          rows,
          continuation:
            index > 0,
        }),
      ),
    ];

    const totalPages =
      allPages.length;

    const renderHeader = (
      title: string,
      subtitle: string,
      compact = false,
    ) => `
      <header class="report-header ${
        compact
          ? "report-header-compact"
          : ""
      }">
        <img
          src="${window.location.origin}/branding/logo-epic-payments-dark.png"
          alt="EPIC Payments"
        />

        <div>
          <h1>${escape(title)}</h1>
          <p>${escape(subtitle)}</p>
        </div>
      </header>
    `;

    const renderMetadata = () => `
      <div class="metadata-grid">
        <div>
          <span>Data de criação</span>
          <strong>${escape(
            formatDateTime(
              generatedAt,
            ),
          )}</strong>
        </div>

        <div>
          <span>Gerado por</span>
          <strong>${escape(
            generatedBy,
          )}</strong>
        </div>

        <div class="metadata-files">
          <span>Ficheiros processados</span>
          <strong>${escape(
            fileNames,
          )}</strong>
        </div>

        <div>
          <span>Recuperadas</span>
          <strong>${recovered.length}</strong>
        </div>

        <div>
          <span>Não recuperadas</span>
          <strong>${unpaid.length}</strong>
        </div>
      </div>
    `;

    const renderRecoveredRows = (
      rows: RecoveryResult[],
    ) =>
      rows.map(
        (movement) => `
          <tr>
            <td>${escape(
              movement.bank_reference ||
              "—",
            )}</td>
            <td>${escape(
              movement.member_number ||
              "—",
            )}</td>
            <td>${escape(
              movement.name ||
              "—",
            )}</td>
            <td class="money">${escape(
              formatCurrency(
                movement.amount,
              ),
            )}</td>
            <td>${escape(
              movement.final_reason_code,
            )}</td>
            <td>RECUPERADA</td>
          </tr>
        `,
      ).join("");

    const renderUnpaidRows = (
      rows: RecoveryResult[],
    ) =>
      rows.map(
        (movement) => {
          const origin =
            getReturnOrigin(
              movement,
            );

          return `
            <tr>
              <td>${escape(
                movement.bank_reference ||
                "—",
              )}</td>
              <td>${escape(
                movement.member_number ||
                "—",
              )}</td>
              <td>${escape(
                movement.name ||
                "—",
              )}</td>
              <td class="money">${escape(
                formatCurrency(
                  movement.amount,
                ),
              )}</td>
              <td>
                <strong>${escape(
                  movement.final_reason_code,
                )}</strong>
                <span class="small-line">
                  ${escape(
                    movement.final_reason_description,
                  )}
                </span>
              </td>
              <td>
                ${escape(
                  origin.label,
                )}
                <span class="small-line">
                  ${escape(
                    origin.description,
                  )}
                </span>
              </td>
            </tr>
          `;
        },
      ).join("");

    const pagesHtml =
      allPages.map(
        (
          page,
          pageIndex,
        ) => {
          const isRecovered =
            page.type ===
            "recovered";

          const title =
            isRecovered
              ? "Relatório de Recuperação"
              : "Relatório de Recuperação";

          const subtitle =
            isRecovered
              ? page.continuation
                ? "Cobranças recuperadas — continuação"
                : "Resultado final da conciliação F1 + F2"
              : page.continuation
                ? "Cobranças não recuperadas — continuação"
                : "Cobranças não recuperadas";

          const sectionTitle =
            isRecovered
              ? "Cobranças recuperadas"
              : "Cobranças não recuperadas";

          const sectionCount =
            isRecovered
              ? recovered.length
              : unpaid.length;

          const tableHead =
            isRecovered
              ? `
                <tr>
                  <th>Ref.</th>
                  <th>Nº Sócio</th>
                  <th>Nome</th>
                  <th>Valor</th>
                  <th>Código</th>
                  <th>Resultado</th>
                </tr>
              `
              : `
                <tr>
                  <th>Ref.</th>
                  <th>Nº Sócio</th>
                  <th>Nome</th>
                  <th>Valor</th>
                  <th>Código / Motivo</th>
                  <th>Origem</th>
                </tr>
              `;

          const tableBody =
            isRecovered
              ? renderRecoveredRows(
                  page.rows,
                )
              : renderUnpaidRows(
                  page.rows,
                );

          return `
            <section class="report-page">
              ${renderHeader(
                title,
                subtitle,
                page.continuation,
              )}

              ${
                pageIndex === 0
                  ? renderMetadata()
                  : ""
              }

              <div class="section-heading">
                <div>
                  <strong>
                    ${escape(
                      sectionTitle,
                    )}
                  </strong>
                  <span>
                    ${sectionCount}
                    cobrança${
                      sectionCount === 1
                        ? ""
                        : "s"
                    }
                  </span>
                </div>

                ${
                  !page.continuation
                    ? `
                      <small>
                        ${
                          isRecovered
                            ? "Referências com código 0000 no F1 que não surgiram devolvidas no F2."
                            : "Inclui rejeições do F1 e referências inicialmente aceites no F1 que surgiram devolvidas no F2."
                        }
                      </small>
                    `
                    : ""
                }
              </div>

              <table>
                <thead>
                  ${tableHead}
                </thead>
                <tbody>
                  ${tableBody}
                </tbody>
              </table>

              <footer>
                <span>
                  EPIC Payments · Documento interno
                </span>
                <span>
                  Página ${pageIndex + 1} de ${totalPages}
                </span>
              </footer>
            </section>
          `;
        },
      ).join("");

    const html = `
      <!doctype html>
      <html lang="pt">
        <head>
          <meta charset="utf-8" />
          <title>${escape(
            reportName,
          )}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            @page {
              size: A4 portrait;
              margin: 0;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #dddddd;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              color: #111111;
              -webkit-print-color-adjust:
                exact;
              print-color-adjust:
                exact;
            }

            .toolbar {
              position: sticky;
              top: 0;
              z-index: 20;
              display: flex;
              justify-content: center;
              padding: 12px;
              background: #f4f4f4;
              border-bottom:
                1px solid #cccccc;
            }

            .toolbar button {
              height: 40px;
              padding: 0 18px;
              border: 0;
              border-radius: 8px;
              background: #111111;
              color: #ffffff;
              font-weight: 800;
              cursor: pointer;
            }

            .document {
              padding:
                16px 0
                26px;
            }

            .report-page {
              position: relative;
              width: 210mm;
              height: 297mm;
              margin:
                0 auto
                14px;
              overflow: hidden;
              background: #ffffff;
              padding:
                12mm
                10mm
                19mm;
              page-break-after:
                always;
              break-after:
                page;
              box-shadow:
                0 5px 22px
                rgba(0,0,0,.14);
            }

            .report-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            .report-header {
              display: flex;
              align-items: flex-start;
              justify-content:
                space-between;
              gap: 12mm;
              padding-bottom: 5mm;
              border-bottom:
                .45mm solid
                #111111;
            }

            .report-header img {
              width: 34mm;
              height: auto;
              object-fit: contain;
            }

            .report-header > div {
              flex: 1;
              text-align: right;
            }

            .report-header h1 {
              margin: 0;
              font-size: 20pt;
              line-height: 1.05;
              text-transform: uppercase;
            }

            .report-header p {
              margin:
                2.3mm 0 0;
              font-size: 9pt;
              font-weight: 700;
            }

            .report-header-compact {
              padding-bottom: 3.5mm;
            }

            .report-header-compact img {
              width: 27mm;
            }

            .report-header-compact h1 {
              font-size: 16pt;
            }

            .metadata-grid {
              display: grid;
              grid-template-columns:
                .95fr
                .8fr
                1.65fr
                .7fr
                .8fr;
              gap: 2.5mm;
              margin-top: 5mm;
            }

            .metadata-grid > div {
              min-height: 17mm;
              padding:
                3mm
                3.2mm;
              border:
                .25mm solid
                #cccccc;
              border-radius:
                2.2mm;
            }

            .metadata-grid span {
              display: block;
              margin-bottom:
                1.4mm;
              font-size: 6.8pt;
              font-weight: 800;
              text-transform:
                uppercase;
            }

            .metadata-grid strong {
              display: block;
              font-size: 8.3pt;
              line-height: 1.25;
              overflow-wrap:
                anywhere;
            }

            .section-heading {
              display: flex;
              align-items: flex-end;
              justify-content:
                space-between;
              gap: 6mm;
              margin:
                6mm 0
                3mm;
            }

            .section-heading div {
              display: flex;
              align-items: baseline;
              gap: 3mm;
            }

            .section-heading strong {
              font-size: 12pt;
              text-transform:
                uppercase;
            }

            .section-heading span,
            .section-heading small {
              font-size: 7pt;
              line-height: 1.25;
            }

            .section-heading small {
              max-width: 80mm;
              text-align: right;
            }

            table {
              width: 100%;
              border-collapse:
                collapse;
              table-layout: fixed;
              font-size: 7.2pt;
            }

            th,
            td {
              border:
                .22mm solid
                #c8c8c8;
              padding:
                1.9mm
                2.2mm;
              vertical-align: top;
            }

            th {
              background: #f2f2f2;
              text-align: left;
              font-size: 6.7pt;
              text-transform:
                uppercase;
            }

            th:nth-child(1),
            td:nth-child(1) {
              width: 8%;
            }

            th:nth-child(2),
            td:nth-child(2) {
              width: 13%;
            }

            th:nth-child(3),
            td:nth-child(3) {
              width: 27%;
            }

            th:nth-child(4),
            td:nth-child(4) {
              width: 12%;
            }

            th:nth-child(5),
            td:nth-child(5) {
              width: 17%;
            }

            th:nth-child(6),
            td:nth-child(6) {
              width: 23%;
            }

            td.money {
              font-weight: 700;
              white-space: nowrap;
            }

            .small-line {
              display: block;
              margin-top: 1mm;
              color: #4f4f4f;
              font-size: 6.2pt;
              line-height: 1.12;
            }

            footer {
              position: absolute;
              left: 10mm;
              right: 10mm;
              bottom: 7mm;
              display: flex;
              justify-content:
                space-between;
              padding-top: 2.2mm;
              border-top:
                .22mm solid
                #bbbbbb;
              font-size: 6.7pt;
              color: #555555;
            }

            @media print {
              html,
              body {
                background: #ffffff;
              }

              .toolbar {
                display: none;
              }

              .document {
                padding: 0;
              }

              .report-page {
                margin: 0;
                box-shadow: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="toolbar">
            <button
              type="button"
              onclick="window.print()"
            >
              Guardar / Imprimir PDF
            </button>
          </div>

          <main class="document">
            ${pagesHtml}
          </main>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(
      html,
    );
    printWindow.document.close();
    printWindow.focus();
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
        {isRecoverySelection ? (
          <section className="recovery-top-actions">
            <div className="recovery-top-actions-copy">
              <span className="section-label">
                Recuperação
              </span>

              <h2>
                Conciliação F1 + F2
              </h2>

              <p>
                Pode consultar a conciliação no ecrã ou gerar diretamente o relatório final.
              </p>
            </div>

            <div className="recovery-top-actions-grid">
              <button
                type="button"
                className={[
                  "recovery-top-action-card",
                  recoveryResults
                    ? "recovery-top-action-card-complete"
                    : "",
                ].join(" ")}
                disabled={
                  !recoveryPairReady
                }
                onClick={
                  handleRecoveryFilter
                }
              >
                <span className="recovery-top-action-icon">
                  <SearchCheck
                    size={23}
                  />
                </span>

                <span className="recovery-top-action-text">
                  <strong>
                    Conciliar F1 + F2
                  </strong>

                  <small>
                    Ler os dois ficheiros e apresentar o resultado final da conciliação.
                  </small>
                </span>

                {recoveryResults ? (
                  <CheckCircle2
                    className="recovery-top-action-check"
                    size={18}
                  />
                ) : null}
              </button>

              <button
                type="button"
                className={[
                  "recovery-top-action-card",
                  "recovery-top-action-card-pdf",
                  printReady
                    ? "recovery-top-action-card-complete"
                    : "",
                ].join(" ")}
                disabled={
                  !recoveryPairReady
                }
                onClick={
                  handlePreparePrint
                }
              >
                <span className="recovery-top-action-icon">
                  <Printer
                    size={23}
                  />
                </span>

                <span className="recovery-top-action-text">
                  <strong>
                    Gerar PDF
                  </strong>

                  <small>
                    Conciliar automaticamente F1 + F2 e preparar o relatório final para guardar ou imprimir.
                  </small>
                </span>
              </button>
            </div>
          </section>
        ) : null}
        <section className="processing-summary-grid">
          <article className="processing-summary-card processing-summary-card-files">
            <span>
              Ficheiros selecionados
            </span>

            <strong>
              {selection.files.length}
            </strong>

            <div className="processing-selected-file-types">
              {pdfCount > 0 ? (
                <span className="processing-file-count-badge processing-file-count-pdf">
                  PDF {pdfCount}
                </span>
              ) : null}

              {xmlCount > 0 ? (
                <span className="processing-file-count-badge processing-file-count-xml">
                  XML {xmlCount}
                </span>
              ) : null}

              {recoveryFiles.length > 0 ? (
                <span className="processing-file-count-badge processing-file-count-recovery">
                  REC {recoveryFiles.length}
                </span>
              ) : null}
            </div>
          </article>

          <article className="processing-summary-card processing-summary-card-accepted">
            <span>
              Total de aceites
            </span>

            <strong>
              {totals.accepted}
            </strong>

            <small>
              {hasLoadedMovements
                ? formatCurrency(
                    totals.acceptedAmount,
                  )
                : "A aguardar leitura"}
            </small>
          </article>

          <article className="processing-summary-card processing-summary-card-rejected">
            <span>
              Total de rejeitados
            </span>

            <strong>
              {totals.rejected}
            </strong>

            <small>
              {hasLoadedMovements
                ? formatCurrency(
                    totals.rejectedAmount,
                  )
                : "A aguardar leitura"}
            </small>
          </article>

          <article className="processing-summary-card processing-summary-card-movements">
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

                                      {isImportantRejectedCode(
                                        movement,
                                      ) ? (
                                        <span
                                          className="processing-important-code-alert"
                                          title={`Código ${movement.reason_code}: ${movement.reason_description || "rejeição que requer verificação"}`}
                                          aria-label={`Alerta para código ${movement.reason_code}`}
                                        >
                                          <AlertTriangle
                                            size={17}
                                            strokeWidth={2.5}
                                          />
                                        </span>
                                      ) : null}
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

                                      {isImportantRejectedCode(
                                        movement,
                                      ) ? (
                                        <span
                                          className="processing-important-code-alert"
                                          title={`Código ${movement.reason_code}: ${movement.reason_description || "rejeição que requer verificação"}`}
                                          aria-label={`Alerta para código ${movement.reason_code}`}
                                        >
                                          <AlertTriangle
                                            size={17}
                                            strokeWidth={2.5}
                                          />
                                        </span>
                                      ) : null}
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


        {!isRecoverySelection ? (
          <section className="bank-pdf-generation-section">
            <div className="bank-pdf-generation-heading">
              <span className="section-label">
                Documento bancário
              </span>

              <h2>
                Gerar PDF a partir do XML
              </h2>

              <p>
                Recria o relatório no formato do ficheiro PDF enviado pelo banco, utilizando os dados originais do XML processado.
              </p>
            </div>

            <div className="bank-pdf-generation-grid">
              {fileStates
                .filter(
                  (state) =>
                    state.file.type ===
                      "xml" &&
                    !isRecoveryFile(
                      state.file,
                    ),
                )
                .map((state) => (
                  <article
                    key={`bank-pdf-${state.file.id}`}
                    className="bank-pdf-generation-card"
                  >
                    <span className="bank-pdf-generation-icon">
                      <FileDown size={24} />
                    </span>

                    <div className="bank-pdf-generation-copy">
                      <strong>
                        Relatório bancário
                      </strong>

                      <small>
                        {state.file.name}
                      </small>
                    </div>

                    <button
                      type="button"
                      disabled={
                        state.loading ||
                        Boolean(state.error) ||
                        !state.data
                      }
                      onClick={() =>
                        handleGenerateBankPdf(
                          state,
                        )
                      }
                    >
                      Gerar PDF
                    </button>
                  </article>
                ))}
            </div>
          </section>
        ) : null}


        {isRecoverySelection ? (
          <>
            {recoveryResults ? (
              <section
                id="recovery-filter-result"
                className="recovery-result-card"
              >
                <header className="recovery-result-header">
                  <div>
                    <span className="section-label">
                      Resultado da conciliação
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
