"use client";

import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";

import type { CalendarDayData, CalendarFile } from "./calendar-types";

type DayDrawerProps = {
  isOpen: boolean;
  selectedDate: string | null;
  data?: CalendarDayData;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onAddFile: () => void;
  onDownload: (file: CalendarFile) => void;
  onDelete: (file: CalendarFile) => void;
};

const formatter = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

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
  onClose,
  onAddFile,
  onDownload,
  onDelete,
}: DayDrawerProps) {
  if (!isOpen || !selectedDate) {
    return null;
  }

  const formattedDate = formatter.format(
    new Date(`${selectedDate}T12:00:00`),
  );

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
            <span className="section-label">Dia selecionado</span>
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
            <span>{data?.files.length ?? 0}</span>
          </div>

          {isLoading ? (
            <div className="drawer-empty-state">
              <strong>A carregar ficheiros...</strong>
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="drawer-error-state">
              <strong>Não foi possível carregar</strong>
              <span>{error}</span>
            </div>
          ) : null}

          {!isLoading && !error && data?.files.length ? (
            <div className="drawer-file-list">
              {data.files.map((file) => {
                const Icon = getFileIcon(file.type);

                return (
                  <article
                    key={file.id}
                    className="drawer-file-card"
                  >
                    <div className="drawer-file-main">
                      <span className="drawer-file-icon">
                        <Icon size={21} />
                      </span>

                      <div>
                        <strong>{file.name}</strong>
                        <small>
                          {file.type.toUpperCase()}
                          {file.size ? ` · ${file.size}` : ""}
                        </small>
                      </div>
                    </div>

                    <div className="drawer-file-actions">
                      <button
                        type="button"
                        title="Download"
                        aria-label={`Descarregar ${file.name}`}
                        onClick={() => onDownload(file)}
                      >
                        <Download size={17} />
                      </button>

                      <button
                        type="button"
                        title="Eliminar"
                        aria-label={`Eliminar ${file.name}`}
                        onClick={() => onDelete(file)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!isLoading && !error && !data?.files.length ? (
            <div className="drawer-empty-state">
              <FileText size={27} />
              <strong>Sem ficheiros</strong>
              <span>
                Ainda não existem ficheiros associados a este dia.
              </span>
            </div>
          ) : null}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-header">
            <h3>Processamento</h3>
          </div>

          <button
            type="button"
            className="drawer-action-card"
            disabled={!data?.files.length}
          >
            <span className="drawer-action-icon">
              <Users size={22} />
            </span>

            <span>
              <strong>Filtrar sócios</strong>
              <small>
                Mostrar apenas os sócios cuja mensalidade não foi paga.
              </small>
            </span>
          </button>
        </div>

        <div className="day-drawer-footer">
          <Button
            icon={<Plus size={18} />}
            onClick={onAddFile}
          >
            Adicionar ficheiro
          </Button>
        </div>
      </aside>
    </>
  );
}