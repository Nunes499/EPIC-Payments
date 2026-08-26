"use client";

import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
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

type FileGroupKind =
  | "pdf"
  | "xml"
  | "recovery"
  | "report";

type FileGroupDefinition = {
  kind: FileGroupKind;
  title: string;
  files: CalendarFile[];
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

function getFileIcon(
  kind: FileGroupKind,
) {
  if (kind === "report") {
    return FileSpreadsheet;
  }

  if (kind === "recovery") {
    return RefreshCw;
  }

  return FileText;
}

function getFileSecondaryLabel(
  file: CalendarFile,
  kind: FileGroupKind,
) {
  if (kind === "recovery") {
    const partLabel =
      file.recoveryPart === 1
        ? "FICHEIRO 1"
        : file.recoveryPart === 2
          ? "FICHEIRO 2"
          : "FICHEIRO";

    return [
      "RECUPERAÇÃO",
      partLabel,
      file.size,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (kind === "report") {
    return [
      "RELATÓRIO",
      "PDF",
      file.size,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    file.type.toUpperCase(),
    file.size,
  ]
    .filter(Boolean)
    .join(" · ");
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
    new Date(
      `${selectedDate}T12:00:00`,
    ),
  );

  const allFiles =
    data?.files ??
    [];

  const recoveryFiles =
    allFiles.filter(
      (file) =>
        file.fileCategory ===
        "recovery",
    );

  const pdfFiles =
    allFiles.filter(
      (file) =>
        file.fileCategory !==
          "recovery" &&
        file.type ===
          "pdf",
    );

  const xmlFiles =
    allFiles.filter(
      (file) =>
        file.fileCategory !==
          "recovery" &&
        file.type ===
          "xml",
    );

  const reportFiles =
    allFiles.filter(
      (file) =>
        file.type ===
        "report",
    );

  const groups: FileGroupDefinition[] = [
    {
      kind: "pdf",
      title: "PDF do banco",
      files: pdfFiles,
    },
    {
      kind: "xml",
      title: "XML do banco",
      files: xmlFiles,
    },
    {
      kind: "recovery",
      title: "Recuperação",
      files: recoveryFiles,
    },
    {
      kind: "report",
      title: "Relatórios",
      files: reportFiles,
    },
  ];

  const processableFiles =
    allFiles.filter(
      (file) =>
        file.type === "pdf" ||
        file.type === "xml",
    );

  const selectedCount =
    processableFiles.filter(
      (file) =>
        selectedFileIds.includes(
          file.id,
        ),
    ).length;

  const allSelected =
    processableFiles.length > 0 &&
    selectedCount ===
      processableFiles.length;

  function renderFileGroup(
    group: FileGroupDefinition,
  ) {
    if (
      group.files.length ===
      0
    ) {
      return null;
    }

    const Icon =
      getFileIcon(
        group.kind,
      );

    return (
      <section
        key={group.kind}
        className={[
          "drawer-file-group",
          `drawer-file-group-${group.kind}`,
        ].join(" ")}
      >
        <div className="drawer-file-group-header">
          <div className="drawer-file-group-title">
            <span
              className={[
                "drawer-file-group-marker",
                `drawer-file-group-marker-${group.kind}`,
              ].join(" ")}
            />

            <h4>
              {group.title}
            </h4>
          </div>

          <span className="drawer-file-group-count">
            {group.files.length}
          </span>
        </div>

        <div className="drawer-file-list">
          {group.files.map(
            (file) => {
              const isProcessable =
                file.type ===
                  "pdf" ||
                file.type ===
                  "xml";

              const isSelected =
                selectedFileIds.includes(
                  file.id,
                );

              return (
                <article
                  key={file.id}
                  className={[
                    "drawer-file-card",
                    `drawer-file-card-${group.kind}`,
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
                        checked={
                          isSelected
                        }
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
                    <span
                      className={[
                        "drawer-file-icon",
                        `drawer-file-icon-${group.kind}`,
                      ].join(" ")}
                    >
                      <Icon
                        size={21}
                      />
                    </span>

                    <div>
                      <strong>
                        {file.name}
                      </strong>

                      <small>
                        {getFileSecondaryLabel(
                          file,
                          group.kind,
                        )}
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
                        onPreview(
                          file,
                        )
                      }
                    >
                      <Eye
                        size={17}
                      />
                    </button>

                    <button
                      type="button"
                      className="file-action-download"
                      title="Descarregar"
                      aria-label={`Descarregar ${file.name}`}
                      onClick={() =>
                        onDownload(
                          file,
                        )
                      }
                    >
                      <Download
                        size={17}
                      />
                    </button>

                    <button
                      type="button"
                      className="file-action-delete"
                      title="Eliminar"
                      aria-label={`Eliminar ${file.name}`}
                      onClick={() =>
                        onDelete(
                          file,
                        )
                      }
                    >
                      <Trash2
                        size={17}
                      />
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      </section>
    );
  }

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

            <h2>
              {formattedDate}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X
              size={21}
            />
          </button>
        </div>

        <div className="drawer-section">
          <div className="drawer-section-header">
            <h3>
              Ficheiros
            </h3>

            <span>
              {allFiles.length}
            </span>
          </div>

          {processableFiles.length >
            0 &&
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

          {!isLoading &&
          error ? (
            <div className="drawer-error-state">
              <strong>
                Não foi possível carregar
              </strong>

              <span>
                {error}
              </span>
            </div>
          ) : null}

          {!isLoading &&
          !error &&
          allFiles.length >
            0 ? (
            <div className="drawer-file-groups">
              {groups.map(
                renderFileGroup,
              )}
            </div>
          ) : null}

          {!isLoading &&
          !error &&
          allFiles.length ===
            0 ? (
            <div className="drawer-empty-state">
              <FileText
                size={27}
              />

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
            <h3>
              Processamento
            </h3>
          </div>

          <div className="processing-selection-summary">
            <span>
              PDF, XML e Recuperação selecionados
            </span>

            <strong>
              {selectedCount}
            </strong>
          </div>

          <button
            type="button"
            className="drawer-action-card"
            disabled={
              selectedCount ===
              0
            }
            onClick={
              onOpenProcessing
            }
          >
            <span className="drawer-action-icon">
              <FolderOpen
                size={22}
              />
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

            {selectedCount >
            0 ? (
              <span className="drawer-action-count">
                {selectedCount}
              </span>
            ) : null}
          </button>

          {processableFiles.length ===
            0 &&
          allFiles.length >
            0 ? (
            <p className="processing-selection-help">
              Os relatórios não podem ser
              selecionados para processamento.
            </p>
          ) : null}
        </div>

        <div className="day-drawer-footer">
          <Button
            icon={
              <Plus
                size={18}
              />
            }
            onClick={
              onAddFile
            }
          >
            Adicionar ficheiros
          </Button>
        </div>
      </aside>
    </>
  );
}
