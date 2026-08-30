"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type BankCandidate = {
  candidate_id: string;
  searched_reference: string | null;
  bank_reference_code: string;
  holder_name: string;
  iban: string | null;
  match_type: string;
  match_score: number;
  movement_count: number;
  last_movement_date: string | null;
};

type BankSearchResponse = {
  query: string;
  candidates: BankCandidate[];
};

type BankDocument = {
  file_id: number;
  filename: string;
  file_type: string;
  file_category: string;
  download_url: string;
};

type BankHistoryEvent = {
  event_id: string;
  event_date: string;
  event_type: string;
  bank_reference_code: string;
  holder_name: string;
  iban: string | null;
  amount: string;
  reason_code: string;
  reason_description: string;
  collection_reference: string | null;
  message_id: string | null;
  original_message_id: string | null;
  recovery_part: number | null;
  related_file_id: number | null;
  documents: BankDocument[];
};

type BankHistoryResponse = {
  candidate_id: string;
  bank_reference_code: string;
  holder_name: string;
  iban: string | null;
  months: number;
  start_date: string;
  end_date: string;
  events: BankHistoryEvent[];
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatAmount(value: string) {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return `${value} €`;
  }

  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function eventTypeLabel(event: BankHistoryEvent) {
  if (event.event_type === "returned") {
    return "Devolução";
  }

  if (event.event_type === "recovery") {
    if (event.recovery_part === 2) {
      return "Retorno da recuperação";
    }

    return "Recuperação";
  }

  return "Cobrança normal";
}

function eventTypeColors(event: BankHistoryEvent) {
  if (event.event_type === "returned") {
    return {
      background: "#fff0f1",
      color: "#c90d18",
      border: "#f2c4c7",
    };
  }

  if (event.event_type === "recovery") {
    return {
      background: "#fff8df",
      color: "#8b6500",
      border: "#ead798",
    };
  }

  return {
    background: "#eef8f1",
    color: "#217a3d",
    border: "#c7e7d0",
  };
}

function statusColors(reasonCode: string) {
  if (reasonCode === "0000") {
    return {
      background: "#eaf8ee",
      color: "#24723d",
      border: "#bfe1c9",
    };
  }

  return {
    background: "#fff0f1",
    color: "#c90d18",
    border: "#f2c4c7",
  };
}

function documentLabel(document: BankDocument) {
  const type = document.file_type.toUpperCase();

  if (type === "PDF") return "Abrir PDF";
  if (type === "XML") return "Abrir XML";

  return "Abrir ficheiro";
}

function uniqueDocumentsByType(documents: BankDocument[]) {
  const unique = new Map<string, BankDocument>();

  documents.forEach((document) => {
    const type = document.file_type.trim().toLowerCase();
    const key = type || `file-${document.file_id}`;

    if (!unique.has(key)) {
      unique.set(key, document);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    const order: Record<string, number> = {
      pdf: 1,
      xml: 2,
    };

    return (
      (order[a.file_type.toLowerCase()] ?? 99) -
      (order[b.file_type.toLowerCase()] ?? 99)
    );
  });
}

function getInitialHistoryMonths(candidate: BankCandidate) {
  if (!candidate.last_movement_date) {
    return 3;
  }

  const movementDate = new Date(
    `${candidate.last_movement_date}T12:00:00`,
  );

  if (Number.isNaN(movementDate.getTime())) {
    return 3;
  }

  const today = new Date();

  const allowedPeriods = [3, 6, 12, 24, 36];

  for (const period of allowedPeriods) {
    const cutoff = new Date(
      today.getFullYear(),
      today.getMonth() - period,
      today.getDate(),
      0,
      0,
      0,
      0,
    );

    if (movementDate >= cutoff) {
      return period;
    }
  }

  return 36;
}

export default function PesquisaBancariaPage() {
  const [query, setQuery] = useState("");
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<BankCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<BankCandidate | null>(null);
  const [history, setHistory] = useState<BankHistoryResponse | null>(null);
  const [months, setMonths] = useState(3);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  const groupedEvents = useMemo(() => {
    if (!history) return [];

    const grouped = new Map<
      string,
      BankHistoryEvent[]
    >();

    history.events.forEach((event) => {
      const key = event.event_date.slice(0, 7);

      const current = grouped.get(key) || [];
      current.push(event);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries());
  }, [history]);

  async function loadHistory(
    candidate: BankCandidate,
    selectedMonths: number,
    searchQuery: string,
  ) {
    setIsLoadingHistory(true);
    setError("");

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        candidate_id: candidate.candidate_id,
        months: String(selectedMonths),
      });

      const response = await fetch(
        `${API_URL}/files/bank-history?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.detail ||
            "Não foi possível carregar o histórico bancário.",
        );
      }

      const data: BankHistoryResponse = await response.json();

      setHistory(data);
      setSelectedCandidate(candidate);
    } catch (err) {
      setHistory(null);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o histórico bancário.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleSearch(event?: FormEvent) {
    event?.preventDefault();

    const cleanedQuery = query.trim();

    if (cleanedQuery.length < 2) {
      setError(
        "Introduza pelo menos 2 caracteres para efetuar a pesquisa.",
      );
      return;
    }

    setIsSearching(true);
    setError("");
    setCandidates([]);
    setSelectedCandidate(null);
    setHistory(null);
    setMonths(3);

    try {
      const params = new URLSearchParams({
        q: cleanedQuery,
      });

      const response = await fetch(
        `${API_URL}/files/bank-search?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
          body?.detail ||
            "Não foi possível efetuar a pesquisa bancária.",
        );
      }

      const data: BankSearchResponse = await response.json();

      setLastSearchQuery(cleanedQuery);
      setCandidates(data.candidates);

      if (data.candidates.length === 0) {
        setError(
          "Não foram encontrados resultados para a pesquisa efetuada.",
        );
        return;
      }

      if (data.candidates.length === 1) {
        const initialMonths = getInitialHistoryMonths(
          data.candidates[0],
        );

        setMonths(initialMonths);

        await loadHistory(
          data.candidates[0],
          initialMonths,
          cleanedQuery,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível efetuar a pesquisa bancária.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCandidateSelection(
    candidate: BankCandidate,
  ) {
    const initialMonths = getInitialHistoryMonths(candidate);

    setMonths(initialMonths);

    await loadHistory(
      candidate,
      initialMonths,
      lastSearchQuery,
    );
  }

  async function handlePeriodChange(
    selectedMonths: number,
  ) {
    setMonths(selectedMonths);

    if (!selectedCandidate) return;

    await loadHistory(
      selectedCandidate,
      selectedMonths,
      lastSearchQuery,
    );
  }

  function openDocument(document: BankDocument) {
    const url = document.download_url.startsWith("http")
      ? document.download_url
      : `${API_URL}${document.download_url}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }


  function printHistory() {
    if (!history || !selectedCandidate) return;

    const printWindow = window.open(
      "",
      "_blank",
      "width=980,height=760",
    );

    if (!printWindow) {
      setError(
        "O navegador bloqueou a janela de impressão. Permita pop-ups para o EPIC Payments e tente novamente.",
      );
      return;
    }

    const generatedAt = new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());

    const monthFormatter = new Intl.DateTimeFormat("pt-PT", {
      month: "long",
      year: "numeric",
    });

    const grouped = new Map<string, BankHistoryEvent[]>();

    history.events.forEach((event) => {
      const key = event.event_date.slice(0, 7);
      const current = grouped.get(key) || [];
      current.push(event);
      grouped.set(key, current);
    });

    const escapeHtml = (value: string | null | undefined) =>
      String(value ?? "—")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const eventsHtml = Array.from(grouped.entries())
      .map(([monthKey, events]) => {
        const monthDate = new Date(`${monthKey}-01T12:00:00`);
        const monthLabel = monthFormatter.format(monthDate);

        const cards = events
          .map((event) => {
            return `
              <article class="movement">
                <div class="movement-top">
                  <div>
                    <div class="badges">
                      <span class="badge">${escapeHtml(
                        eventTypeLabel(event),
                      )}</span>
                      <span class="badge">${escapeHtml(
                        event.reason_code,
                      )}</span>
                    </div>
                    <div class="movement-date">
                      ${escapeHtml(formatDate(event.event_date))}
                    </div>
                  </div>

                  <div class="amount">
                    ${escapeHtml(formatAmount(event.amount))}
                  </div>
                </div>

                <div class="movement-grid">
                  <div>
                    <span class="label">Referência cobrança</span>
                    <strong>${escapeHtml(
                      event.collection_reference || "—",
                    )}</strong>
                  </div>
                  <div>
                    <span class="label">Código de envio</span>
                    <strong>${escapeHtml(
                      event.bank_reference_code,
                    )}</strong>
                  </div>
                </div>

                <div class="reason">
                  ${escapeHtml(event.reason_description)}
                </div>

                <div class="movement-grid">
                  <div>
                    <span class="label">Nome do titular</span>
                    <strong>${escapeHtml(event.holder_name)}</strong>
                  </div>
                  <div>
                    <span class="label">IBAN enviado</span>
                    <strong>${escapeHtml(event.iban || "—")}</strong>
                  </div>
                </div>

              </article>
            `;
          })
          .join("");

        return `
          <section class="month">
            <div class="month-title">${escapeHtml(monthLabel)}</div>
            ${cards}
          </section>
        `;
      })
      .join("");

    const reportHtml = `
      <!doctype html>
      <html lang="pt">
        <head>
          <meta charset="utf-8" />
          <title>Histórico Bancário - ${escapeHtml(
            selectedCandidate.holder_name,
          )}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            @page {
              size: A4;
              margin: 9mm 10mm 11mm;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              font-size: 9.4pt;
              line-height: 1.26;
            }

            .screen-actions {
              position: sticky;
              top: 0;
              z-index: 10;
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              padding: 12px;
              background: #f2f2f2;
              border-bottom: 1px solid #cfcfcf;
            }

            .screen-actions button {
              height: 38px;
              padding: 0 16px;
              border: 1px solid #111111;
              border-radius: 6px;
              background: #111111;
              color: #ffffff;
              font-weight: 700;
              cursor: pointer;
            }

            .report {
              max-width: 190mm;
              margin: 0 auto;
            }

            .header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 18px;
              padding-bottom: 8px;
              border-bottom: 2px solid #000000;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .brand img {
              width: 44mm;
              max-height: 19mm;
              object-fit: contain;
              object-position: left center;
              filter: grayscale(1) contrast(1.15);
            }

            .doc-meta {
              text-align: right;
              font-size: 8.5pt;
              color: #333333;
            }

            h1 {
              margin: 10px 0 2px;
              font-size: 19pt;
              letter-spacing: -0.4px;
            }

            .subtitle {
              margin: 0 0 9px;
              color: #333333;
              font-size: 8.7pt;
            }

            .holder {
              border: 1.5px solid #000000;
              border-radius: 8px;
              padding: 9px 10px;
              margin-bottom: 9px;
            }

            .holder-name {
              margin: 0 0 7px;
              font-size: 14.5pt;
              font-weight: 800;
            }

            .summary-grid,
            .movement-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
            }

            .summary-grid > div,
            .movement-grid > div,
            .documents {
              border: 1px solid #bdbdbd;
              border-radius: 5px;
              padding: 8px 9px;
              overflow-wrap: anywhere;
            }

            .label {
              display: block;
              margin-bottom: 2px;
              color: #555555;
              font-size: 7.5pt;
              font-weight: 700;
              letter-spacing: 0.25px;
              text-transform: uppercase;
            }

            .period-line {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              margin: 0 0 9px;
              padding: 5px 0;
              border-bottom: 1px solid #9a9a9a;
              font-size: 9pt;
            }

            .month {
              margin-top: 9px;
            }

            .month-title {
              padding: 4px 0;
              border-bottom: 1.5px solid #000000;
              font-size: 10.8pt;
              font-weight: 800;
              text-transform: capitalize;
            }

            .month {
              break-inside: auto;
              page-break-inside: auto;
            }

            .month-title {
              break-after: avoid-page;
              page-break-after: avoid;
            }

            .month-title + .movement {
              break-before: avoid-page;
              page-break-before: avoid;
            }

            .movement {
              orphans: 3;
              widows: 3;
            }

            .movement {
              margin-top: 6px;
              padding: 8px 9px;
              border: 1px solid #9e9e9e;
              border-left: 4px solid #000000;
              border-radius: 6px;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .movement-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 5px;
            }

            .badges {
              display: flex;
              gap: 5px;
              flex-wrap: wrap;
              margin-bottom: 5px;
            }

            .badge {
              display: inline-block;
              padding: 2px 7px;
              border: 1px solid #000000;
              border-radius: 999px;
              background: #ffffff;
              color: #000000;
              font-size: 7.5pt;
              font-weight: 800;
              text-transform: uppercase;
            }

            .movement-date {
              font-size: 12pt;
              font-weight: 800;
            }

            .amount {
              font-size: 12.5pt;
              font-weight: 800;
              white-space: nowrap;
            }

            .reason {
              margin: 6px 0;
              padding: 6px 7px;
              border: 1px solid #c8c8c8;
              border-radius: 5px;
              background: #f5f5f5;
            }

            .documents {
              margin-top: 8px;
            }

            .footer {
              margin-top: 10px;
              padding-top: 6px;
              border-top: 1px solid #8f8f8f;
              color: #444444;
              font-size: 7.8pt;
            }

            .footer strong {
              color: #000000;
            }

            @media print {
              .screen-actions {
                display: none !important;
              }

              .report {
                max-width: none;
              }

              a {
                color: #000000 !important;
                text-decoration: none !important;
              }
            }
          </style>
        </head>

        <body>
          <div class="screen-actions">
            <button onclick="window.print()">
              Imprimir / Guardar PDF
            </button>
          </div>

          <main class="report">
            <header class="header">
              <div class="brand">
                <img
                  src="${window.location.origin}/branding/logo-epic-payments-dark.png"
                  alt="EPIC Payments"
                />
              </div>

              <div class="doc-meta">
                <strong>HISTÓRICO BANCÁRIO</strong><br />
                Emitido em ${escapeHtml(generatedAt)}
              </div>
            </header>

            <h1>Histórico Bancário</h1>
            <p class="subtitle">
              Registo documental dos movimentos bancários existentes no EPIC Payments.
            </p>

            <section class="holder">
              <div class="holder-name">
                ${escapeHtml(selectedCandidate.holder_name)}
              </div>

              <div class="summary-grid">
                <div>
                  <span class="label">Código de envio</span>
                  <strong>${escapeHtml(
                    selectedCandidate.bank_reference_code,
                  )}</strong>
                </div>

                <div>
                  <span class="label">IBAN enviado</span>
                  <strong>${escapeHtml(
                    selectedCandidate.iban || "—",
                  )}</strong>
                </div>
              </div>
            </section>

            <div class="period-line">
              <span>
                <strong>Período:</strong>
                ${escapeHtml(formatDate(history.start_date))}
                a
                ${escapeHtml(formatDate(history.end_date))}
              </span>

              <span>
                <strong>${history.events.length}</strong>
                movimento${history.events.length === 1 ? "" : "s"}
              </span>
            </div>

            ${eventsHtml}

            <footer class="footer">
              <strong>EPIC Payments · Documento interno</strong><br />
              Este relatório apresenta exclusivamente os movimentos bancários
              encontrados nos ficheiros processados no sistema. Não determina,
              por si só, se existe mensalidade paga, dívida ou regularização.
            </footer>
          </main>

          <script>
            window.addEventListener("load", function () {
              setTimeout(function () {
                window.focus();
              }, 150);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
  }

  return (
    <AppLayout>
      <main
        style={{
          padding: "28px 34px 42px",
        }}
      >
        <section
          style={{
            position: "relative",
            minHeight: "calc(100vh - 205px)",
            overflow: "hidden",
            background: "#ffffff",
            border: "1px solid #e7e7e7",
            borderRadius: "22px",
            boxShadow: "0 12px 38px rgba(0, 0, 0, 0.06)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-210px",
              left: "-180px",
              width: "650px",
              height: "390px",
              border: "42px solid rgba(239, 16, 28, 0.05)",
              borderRadius: "50%",
              transform: "rotate(-18deg)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: "-210px",
              bottom: "-320px",
              width: "760px",
              height: "500px",
              border: "55px solid rgba(239, 16, 28, 0.035)",
              borderRadius: "50%",
              transform: "rotate(-14deg)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: "1000px",
              margin: "0 auto",
              padding: "50px 34px 70px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "18px",
              }}
            >
              <Image
                src="/branding/logo-epic-payments-dark.png"
                alt="EPIC Payments"
                width={245}
                height={115}
                priority
                style={{
                  width: "245px",
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            </div>

            <div
              style={{
                textAlign: "center",
              }}
            >
              <h1
                style={{
                  margin: 0,
                  color: "#151515",
                  fontSize: "42px",
                  lineHeight: 1.1,
                  fontWeight: 850,
                  letterSpacing: "-1.3px",
                }}
              >
                Pesquisa Bancária
              </h1>

              <p
                style={{
                  maxWidth: "680px",
                  margin: "13px auto 0",
                  color: "#687080",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                Consulte o histórico de movimentos através do número de
                referência ou nome do titular.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              style={{
                position: "relative",
                marginTop: "78px",
                padding: "27px 28px 24px",
                background:
                  "linear-gradient(135deg, #ffffff 0%, #ffffff 68%, #fff5f6 100%)",
                border: "1px solid #efc9cc",
                borderRadius: "20px",
                boxShadow: "0 14px 38px rgba(0, 0, 0, 0.055)",
              }}
            >
              <div
                style={{
                  marginBottom: "11px",
                  color: "#2b2b2b",
                  fontSize: "12px",
                  fontWeight: 850,
                  letterSpacing: "1.1px",
                  textTransform: "uppercase",
                }}
              >
                Pesquisar
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <input
                  type="text"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Número de referência ou nome do titular..."
                  aria-label="Número de referência ou nome do titular"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "60px",
                    padding: "0 22px",
                    background: "#ffffff",
                    border: "1px solid #d5d8dd",
                    borderRadius: "15px",
                    outline: "none",
                    color: "#202020",
                    fontSize: "15px",
                    boxSizing: "border-box",
                  }}
                />

                <button
                  type="submit"
                  disabled={isSearching}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    flexShrink: 0,
                    minWidth: "165px",
                    height: "60px",
                    padding: "0 27px",
                    border: "none",
                    borderRadius: "15px",
                    background:
                      "linear-gradient(135deg, #ff171f 0%, #e9000b 100%)",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 850,
                    cursor: isSearching
                      ? "wait"
                      : "pointer",
                    opacity: isSearching ? 0.78 : 1,
                    boxShadow:
                      "0 11px 25px rgba(239, 16, 28, 0.22)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "9px",
                    }}
                  >
                    <Search
                      size={18}
                      strokeWidth={2.4}
                      aria-hidden="true"
                    />
                    {isSearching
                      ? "A pesquisar..."
                      : "Pesquisar"}
                  </span>
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "11px",
                  marginTop: "17px",
                  padding: "14px 17px",
                  background: "#f7f7f8",
                  borderRadius: "13px",
                  color: "#777d87",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#ef101c",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 900,
                    fontStyle: "italic",
                  }}
                >
                  i
                </span>

                <span>
                  A pesquisa utiliza exclusivamente os dados existentes nos
                  ficheiros bancários processados no EPIC Payments.
                </span>
              </div>
            </form>

            {error && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "15px 18px",
                  border: "1px solid #f1c3c6",
                  background: "#fff4f5",
                  borderRadius: "14px",
                  color: "#b00d17",
                  fontSize: "13px",
                  fontWeight: 650,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {candidates.length > 1 && !selectedCandidate && (
              <div
                style={{
                  marginTop: "30px",
                }}
              >
                <div
                  style={{
                    marginBottom: "14px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "21px",
                      color: "#181818",
                      fontWeight: 850,
                      letterSpacing: "-0.4px",
                    }}
                  >
                    Selecione o titular
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#777d87",
                      fontSize: "13px",
                    }}
                  >
                    Encontrámos mais do que um resultado compatível com a
                    pesquisa.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.candidate_id}
                      type="button"
                      onClick={() =>
                        handleCandidateSelection(candidate)
                      }
                      style={{
                        textAlign: "left",
                        padding: "19px",
                        background: "#ffffff",
                        border: "1px solid #e2e4e8",
                        borderRadius: "16px",
                        cursor: "pointer",
                        boxShadow:
                          "0 8px 22px rgba(0, 0, 0, 0.045)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: "#111111",
                              fontSize: "16px",
                              fontWeight: 850,
                            }}
                          >
                            {candidate.holder_name}
                          </div>

                          <div
                            style={{
                              marginTop: "6px",
                              color: "#777d87",
                              fontSize: "12px",
                            }}
                          >
                            Código de envio
                          </div>

                          <div
                            style={{
                              marginTop: "2px",
                              color: "#262626",
                              fontSize: "14px",
                              fontWeight: 800,
                            }}
                          >
                            {candidate.bank_reference_code}
                          </div>
                        </div>

                        <span
                          style={{
                            padding: "6px 9px",
                            background: "#fff0f1",
                            border: "1px solid #f3ced0",
                            borderRadius: "999px",
                            color: "#d40d18",
                            fontSize: "11px",
                            fontWeight: 850,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {candidate.movement_count} movimentos
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          paddingTop: "13px",
                          borderTop: "1px solid #ededee",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            color: "#777d87",
                            fontSize: "12px",
                          }}
                        >
                          <span>IBAN enviado</span>
                          <span
                            style={{
                              color: "#333333",
                              fontWeight: 700,
                              textAlign: "right",
                              wordBreak: "break-all",
                            }}
                          >
                            {candidate.iban || "—"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            color: "#777d87",
                            fontSize: "12px",
                          }}
                        >
                          <span>Último movimento</span>
                          <span
                            style={{
                              color: "#333333",
                              fontWeight: 700,
                            }}
                          >
                            {formatDate(
                              candidate.last_movement_date,
                            )}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(selectedCandidate || isLoadingHistory) && (
              <div
                style={{
                  marginTop: "30px",
                }}
              >
                {selectedCandidate && (
                  <div
                    style={{
                      padding: "22px 24px",
                      background:
                        "linear-gradient(135deg, #181818 0%, #2d2d2d 100%)",
                      borderRadius: "18px",
                      color: "#ffffff",
                      boxShadow:
                        "0 12px 30px rgba(0, 0, 0, 0.12)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "22px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#ff4249",
                            fontSize: "11px",
                            fontWeight: 900,
                            letterSpacing: "1px",
                            textTransform: "uppercase",
                          }}
                        >
                          Histórico Bancário
                        </div>

                        <h2
                          style={{
                            margin: "7px 0 0",
                            fontSize: "24px",
                            lineHeight: 1.15,
                            fontWeight: 850,
                          }}
                        >
                          {selectedCandidate.holder_name}
                        </h2>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={printHistory}
                          disabled={!history || history.events.length === 0}
                          style={{
                            height: "38px",
                            padding: "0 15px",
                            background: "#ffffff",
                            color: "#181818",
                            border: "1px solid #ffffff",
                            borderRadius: "10px",
                            cursor:
                              !history || history.events.length === 0
                                ? "not-allowed"
                                : "pointer",
                            opacity:
                              !history || history.events.length === 0
                                ? 0.55
                                : 1,
                            fontWeight: 850,
                            fontSize: "12px",
                          }}
                        >
                          Imprimir histórico
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCandidate(null);
                            setHistory(null);
                          }}
                          style={{
                            height: "38px",
                            padding: "0 15px",
                            background: "rgba(255,255,255,0.08)",
                            color: "#ffffff",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontWeight: 750,
                            fontSize: "12px",
                          }}
                        >
                          Alterar titular
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(190px, 1fr))",
                        gap: "12px",
                        marginTop: "19px",
                      }}
                    >
                      <div
                        style={{
                          padding: "13px 14px",
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "12px",
                        }}
                      >
                        <div
                          style={{
                            color: "#aeb2ba",
                            fontSize: "11px",
                          }}
                        >
                          Código de envio
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontWeight: 850,
                            fontSize: "14px",
                          }}
                        >
                          {selectedCandidate.bank_reference_code}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "13px 14px",
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: "12px",
                        }}
                      >
                        <div
                          style={{
                            color: "#aeb2ba",
                            fontSize: "11px",
                          }}
                        >
                          IBAN enviado
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontWeight: 750,
                            fontSize: "13px",
                            wordBreak: "break-all",
                          }}
                        >
                          {selectedCandidate.iban || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    marginTop: "20px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#222222",
                        fontSize: "16px",
                        fontWeight: 850,
                      }}
                    >
                      Período do histórico
                    </div>

                    {history && (
                      <div
                        style={{
                          marginTop: "3px",
                          color: "#858a93",
                          fontSize: "12px",
                        }}
                      >
                        {formatDate(history.start_date)} até{" "}
                        {formatDate(history.end_date)}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "7px",
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      [3, "3 meses"],
                      [6, "6 meses"],
                      [12, "1 ano"],
                      [24, "2 anos"],
                      [36, "3 anos"],
                    ].map(([value, label]) => {
                      const selected =
                        months === Number(value);

                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={isLoadingHistory}
                          onClick={() =>
                            handlePeriodChange(
                              Number(value),
                            )
                          }
                          style={{
                            height: "38px",
                            padding: "0 13px",
                            borderRadius: "10px",
                            border: selected
                              ? "1px solid #ef101c"
                              : "1px solid #dfe1e5",
                            background: selected
                              ? "#ef101c"
                              : "#ffffff",
                            color: selected
                              ? "#ffffff"
                              : "#454951",
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: isLoadingHistory
                              ? "wait"
                              : "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isLoadingHistory && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "28px",
                      textAlign: "center",
                      background: "#fafafa",
                      border: "1px solid #ececee",
                      borderRadius: "16px",
                      color: "#727780",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    A carregar histórico bancário...
                  </div>
                )}

                {!isLoadingHistory &&
                  history &&
                  history.events.length === 0 && (
                    <div
                      style={{
                        marginTop: "18px",
                        padding: "28px",
                        textAlign: "center",
                        background: "#fafafa",
                        border: "1px solid #ececee",
                        borderRadius: "16px",
                        color: "#727780",
                        fontSize: "13px",
                      }}
                    >
                      Não existem movimentos bancários para este
                      titular no período selecionado.
                    </div>
                  )}

                {!isLoadingHistory &&
                  groupedEvents.map(([monthKey, events]) => {
                    const firstDate = new Date(
                      `${monthKey}-01T12:00:00`,
                    );

                    const monthLabel =
                      new Intl.DateTimeFormat("pt-PT", {
                        month: "long",
                        year: "numeric",
                      }).format(firstDate);

                    return (
                      <div
                        key={monthKey}
                        style={{
                          marginTop: "24px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "11px",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#ef101c",
                            }}
                          />

                          <h3
                            style={{
                              margin: 0,
                              color: "#262626",
                              fontSize: "15px",
                              fontWeight: 900,
                              textTransform: "capitalize",
                            }}
                          >
                            {monthLabel}
                          </h3>

                          <div
                            style={{
                              flex: 1,
                              height: "1px",
                              background: "#e6e6e8",
                            }}
                          />
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: "12px",
                          }}
                        >
                          {events.map((event) => {
                            const typeColors =
                              eventTypeColors(event);
                            const status =
                              statusColors(
                                event.reason_code,
                              );

                            return (
                              <article
                                key={event.event_id}
                                style={{
                                  padding: "19px 20px",
                                  background: "#ffffff",
                                  border: "1px solid #e4e5e8",
                                  borderRadius: "16px",
                                  boxShadow:
                                    "0 7px 20px rgba(0, 0, 0, 0.035)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent:
                                      "space-between",
                                    gap: "18px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems:
                                          "center",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        style={{
                                          padding:
                                            "5px 9px",
                                          borderRadius:
                                            "999px",
                                          background:
                                            typeColors.background,
                                          color:
                                            typeColors.color,
                                          border: `1px solid ${typeColors.border}`,
                                          fontSize:
                                            "10px",
                                          fontWeight:
                                            900,
                                          textTransform:
                                            "uppercase",
                                          letterSpacing:
                                            "0.5px",
                                        }}
                                      >
                                        {eventTypeLabel(
                                          event,
                                        )}
                                      </span>

                                      <span
                                        style={{
                                          padding:
                                            "5px 9px",
                                          borderRadius:
                                            "999px",
                                          background:
                                            status.background,
                                          color:
                                            status.color,
                                          border: `1px solid ${status.border}`,
                                          fontSize:
                                            "10px",
                                          fontWeight:
                                            900,
                                        }}
                                      >
                                        {
                                          event.reason_code
                                        }
                                      </span>
                                    </div>

                                    <div
                                      style={{
                                        marginTop:
                                          "10px",
                                        display: "flex",
                                        alignItems:
                                          "baseline",
                                        gap: "11px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <strong
                                        style={{
                                          color:
                                            "#181818",
                                          fontSize:
                                            "19px",
                                        }}
                                      >
                                        {formatDate(
                                          event.event_date,
                                        )}
                                      </strong>

                                      <span
                                        style={{
                                          color:
                                            "#777d87",
                                          fontSize:
                                            "12px",
                                        }}
                                      >
                                        Ref. cobrança{" "}
                                        <strong
                                          style={{
                                            color:
                                              "#303030",
                                          }}
                                        >
                                          {event.collection_reference ||
                                            "—"}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      textAlign: "right",
                                    }}
                                  >
                                    <div
                                      style={{
                                        color:
                                          "#181818",
                                        fontSize:
                                          "20px",
                                        fontWeight:
                                          900,
                                      }}
                                    >
                                      {formatAmount(
                                        event.amount,
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        marginTop:
                                          "3px",
                                        color:
                                          "#8a8f97",
                                        fontSize:
                                          "11px",
                                      }}
                                    >
                                      Código de envio{" "}
                                      {
                                        event.bank_reference_code
                                      }
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    marginTop: "14px",
                                    padding:
                                      "12px 14px",
                                    background:
                                      event.reason_code === "0000"
                                        ? "#eaf8ee"
                                        : "#fff0f1",
                                    border:
                                      event.reason_code === "0000"
                                        ? "1px solid #bfe1c9"
                                        : "1px solid #f2c4c7",
                                    borderRadius:
                                      "11px",
                                    color:
                                      event.reason_code === "0000"
                                        ? "#24723d"
                                        : "#c90d18",
                                    fontSize:
                                      "12px",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {
                                    event.reason_description
                                  }
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: "9px",
                                    marginTop: "13px",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding:
                                        "10px 12px",
                                      border:
                                        "1px solid #ececef",
                                      borderRadius:
                                        "10px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        color:
                                          "#969aa2",
                                        fontSize:
                                          "10px",
                                        textTransform:
                                          "uppercase",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      Nome do titular
                                    </div>
                                    <div
                                      style={{
                                        marginTop:
                                          "4px",
                                        color:
                                          "#303030",
                                        fontSize:
                                          "12px",
                                        fontWeight:
                                          750,
                                      }}
                                    >
                                      {
                                        event.holder_name
                                      }
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      padding:
                                        "10px 12px",
                                      border:
                                        "1px solid #ececef",
                                      borderRadius:
                                        "10px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        color:
                                          "#969aa2",
                                        fontSize:
                                          "10px",
                                        textTransform:
                                          "uppercase",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      IBAN enviado
                                    </div>
                                    <div
                                      style={{
                                        marginTop:
                                          "4px",
                                        color:
                                          "#303030",
                                        fontSize:
                                          "12px",
                                        fontWeight:
                                          700,
                                        wordBreak:
                                          "break-all",
                                      }}
                                    >
                                      {event.iban ||
                                        "—"}
                                    </div>
                                  </div>
                                </div>

                                {event.documents.length >
                                  0 && (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems:
                                        "center",
                                      gap: "8px",
                                      marginTop:
                                        "15px",
                                      flexWrap:
                                        "wrap",
                                    }}
                                  >
                                    <span
                                      style={{
                                        marginRight:
                                          "2px",
                                        color:
                                          "#8a8f97",
                                        fontSize:
                                          "11px",
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      Documentos:
                                    </span>

                                    {uniqueDocumentsByType(
                                      event.documents,
                                    ).map(
                                      (document) => (
                                        <button
                                          key={`${event.event_id}-${document.file_id}`}
                                          type="button"
                                          onClick={() =>
                                            openDocument(
                                              document,
                                            )
                                          }
                                          style={{
                                            height:
                                              "34px",
                                            padding:
                                              "0 11px",
                                            border:
                                              "1px solid #dedfe3",
                                            borderRadius:
                                              "9px",
                                            background:
                                              "#ffffff",
                                            color:
                                              "#33363b",
                                            fontSize:
                                              "11px",
                                            fontWeight:
                                              800,
                                            cursor:
                                              "pointer",
                                          }}
                                          title={
                                            document.filename
                                          }
                                        >
                                          {documentLabel(
                                            document,
                                          )}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
