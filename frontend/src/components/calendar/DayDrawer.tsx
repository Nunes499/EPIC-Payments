"use client";

import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";

import type {
  CalendarDayData,
  CalendarFile,
} from "./calendar-types";

type DayDrawerProps = {
  isOpen: boolean;
  selectedDate: string | null;
  data?: CalendarDayData;
  isLoading?: boolean;
  error?: string | null;

  selectedFileIds: number[];

  onClose: () => void;
  onAddFile: () => void;

  onToggleFile: (fileId: number) => void;
  onSelectAllFiles: () => void;
  onClearSelection: () => void;
  onOpenProcessing: () => void;

  onPreview: (file: CalendarFile) => void;
  onDownload: (file: CalendarFile) => void;
  onDelete: (file: CalendarFile) => void;
};

const formatter = new Intl.DateTimeFormat(
  "pt-PT",
  {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  },
);

function getFileIcon(type: string) {
  if (type === "report") {
    return FileSpreadsheet;
  }

  return FileText;
}

export default function DayDrawer({
  isOpen,
  selectedDate,
  data,
  isLoading = false,
  error = null,

  selectedFileIds,

  onClose,
  onAddFile,

  onToggleFile,
  onSelectAllFiles,
  onClearSelection,
  onOpenProcessing,

  onPreview,
  onDownload,
  onDelete,
}: DayDrawerProps) {
  if (!isOpen || !selectedDate) {
    return null;
  }

  const formattedDate = formatter.format(
    new Date(`${selectedDate}T12:00:00`),
  );

  const processableFiles =
    data?.files.filter(
      (file) =>
        file.type === "pdf" ||
        file.type === "xml",
    ) ?? [];

  const selectedCount =
    processableFiles.filter((file) =>
      selectedFileIds.includes(file.id),
    ).length;

  const allSelected =
    processableFiles.length > 0 &&
    selectedCount === processableFiles.length;

  return (
    <>
      <button
        type="button"
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Fechar painel"
      />

      <aside className="day-drawer">
        <div className="day-drawer-header">
          <div>
            <span className="section-label">
              Dia selecionado
            </span>

            <h2>{formattedDate}</h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={21} />
          </button>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-header">
            <h3>Ficheiros</h3>

            <span>
              {data?.files.length ?? 0}
            </span>
          </div>

          {processableFiles.length > 0 &&
          !isLoading &&
          !error ? (
            <div className="drawer-selection-toolbar">
              <div>
                <strong>
                  {selectedCount}
                </strong>{" "}
                selecionado
                {selectedCount === 1
                  ? ""
                  : "s"}
              </div>

              <div className="drawer-selection-actions">
                <button
                  type="button"
                  onClick={
                    allSelected
                      ? onClearSelection
                      : onSelectAllFiles
                  }
                >
                  {allSelected
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="drawer-empty-state">
              <strong>
                A carregar ficheiros...
              </strong>
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="drawer-error-state">
              <strong>
                Não foi possível carregar
              </strong>

              <span>{error}</span>
            </div>
          ) : null}

          {!isLoading &&
          !error &&
          data?.files.length ? (
            <div className="drawer-file-list">
              {data.files.map((file) => {
                const Icon =
                  getFileIcon(file.type);

                const isProcessable =
                  file.type === "pdf" ||
                  file.type === "xml";

                const isSelected =
                  selectedFileIds.includes(
                    file.id,
                  );

                return (
                  <article
                    key={file.id}
                    className={[
                      "drawer-file-card",
                      isSelected
                        ? "drawer-file-card-selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {isProcessable ? (
                      <label
                        className="drawer-file-checkbox"
                        title="Selecionar para processamento"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            onToggleFile(
                              file.id,
                            )
                          }
                        />

                        <span />
                      </label>
                    ) : (
                      <span className="drawer-file-checkbox-placeholder" />
                    )}

                    <div className="drawer-file-main">
                      <span className="drawer-file-icon">
                        <Icon size={21} />
                      </span>

                      <div>
                        <strong>
                          {file.name}
                        </strong>

                        <small>
                          {file.type.toUpperCase()}

                          {file.size
                            ? ` · ${file.size}`
                            : ""}
                        </small>
                      </div>
                    </div>

                    <div className="drawer-file-actions">
                      <button
                        type="button"
                        className="file-action-preview"
                        title="Pré-visualizar"
                        aria-label={`Pré-visualizar ${file.name}`}
                        onClick={() =>
                          onPreview(file)
                        }
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        type="button"
                        className="file-action-download"
                        title="Descarregar"
                        aria-label={`Descarregar ${file.name}`}
                        onClick={() =>
                          onDownload(file)
                        }
                      >
                        <Download size={17} />
                      </button>

                      <button
                        type="button"
                        className="file-action-delete"
                        title="Eliminar"
                        aria-label={`Eliminar ${file.name}`}
                        onClick={() =>
                          onDelete(file)
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!isLoading &&
          !error &&
          !data?.files.length ? (
            <div className="drawer-empty-state">
              <FileText size={27} />

              <strong>
                Sem ficheiros
              </strong>

              <span>
                Ainda não existem ficheiros
                associados a este dia.
              </span>
            </div>
          ) : null}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-header">
            <h3>Processamento</h3>
          </div>

          <div className="processing-selection-summary">
            <span>
              PDF e XML selecionados
            </span>

            <strong>
              {selectedCount}
            </strong>
          </div>

          <button
            type="button"
            className="drawer-action-card"
            disabled={selectedCount === 0}
            onClick={onOpenProcessing}
          >
            <span className="drawer-action-icon">
              <FolderOpen size={22} />
            </span>

            <span>
              <strong>
                Abrir processamento
              </strong>

              <small>
                Abrir os ficheiros selecionados
                e consultar todos os movimentos
                bancários.
              </small>
            </span>

            {selectedCount > 0 ? (
              <span className="drawer-action-count">
                {selectedCount}
              </span>
            ) : null}
          </button>

          {processableFiles.length === 0 &&
          data?.files.length ? (
            <p className="processing-selection-help">
              Os relatórios não podem ser
              selecionados para processamento.
            </p>
          ) : null}
        </div>

        <div className="day-drawer-footer">
          <Button
            icon={<Plus size={18} />}
            onClick={onAddFile}
          >
            Adicionar ficheiros
          </Button>
        </div>
      </aside>
    </>
  );
}