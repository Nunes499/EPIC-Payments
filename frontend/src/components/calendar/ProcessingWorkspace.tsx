"use client";

import {
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers3,
} from "lucide-react";

import type {
  CalendarFile,
  ProcessingSelection,
} from "./calendar-types";

import "./processing.css";


type ProcessingWorkspaceProps = {
  selection: ProcessingSelection | null;
  onClose: () => void;
};


function getFileIcon(
  file: CalendarFile,
) {
  if (file.type === "report") {
    return FileSpreadsheet;
  }

  return FileText;
}


export default function ProcessingWorkspace({
  selection,
  onClose,
}: ProcessingWorkspaceProps) {
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
              {selection.date}
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

          <article className="processing-summary-card processing-summary-card-muted">
            <span>
              Movimentos
            </span>

            <strong>
              —
            </strong>

            <small>
              Disponível após leitura
            </small>
          </article>
        </section>

        <section className="processing-toolbar">
          <div>
            <span className="section-label">
              Ficheiros em processamento
            </span>

            <h2>
              Todos os movimentos serão apresentados por ficheiro
            </h2>

            <p>
              Nesta primeira versão estamos a preparar a interface.
              No próximo passo ligaremos a leitura real do XML e PDF.
            </p>
          </div>

          <button
            type="button"
            className="processing-filter-button"
            disabled
            title="Disponível depois de carregar os movimentos"
          >
            <Filter size={17} />
            Filtrar sócios
          </button>
        </section>

        <div className="processing-file-groups">
          {selection.files.map(
            (file, index) => {
              const Icon =
                getFileIcon(file);

              return (
                <section
                  key={file.id}
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
                          {file.name}
                        </h3>

                        <p>
                          {file.type.toUpperCase()}
                          {file.size
                            ? ` · ${file.size}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <span className="processing-file-state">
                      A aguardar leitura
                    </span>
                  </header>

                  <div className="processing-table-shell">
                    <div className="processing-table-head">
                      <span>
                        Nº Sócio
                      </span>

                      <span>
                        Nome
                      </span>

                      <span>
                        Valor
                      </span>

                      <span>
                        Motivo
                      </span>

                      <span>
                        Telemóvel
                      </span>

                      <span>
                        Email
                      </span>

                      <span>
                        Nascimento
                      </span>
                    </div>

                    <div className="processing-empty-table">
                      <AlertTriangle
                        size={23}
                      />

                      <strong>
                        Leitura ainda não ligada
                      </strong>

                      <span>
                        No próximo passo vamos extrair os movimentos deste ficheiro
                        e apresentar aqui todos os sócios, incluindo os pagamentos aceites.
                      </span>
                    </div>
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
