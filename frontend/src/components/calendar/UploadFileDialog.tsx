"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Upload,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";

import type {
  CalendarFileType,
  UploadFilePayload,
} from "./calendar-types";

type UploadFileDialogProps = {
  isOpen: boolean;
  selectedDate: string;
  onClose: () => void;
  onUpload: (payload: UploadFilePayload) => void;
};

const fileTypes: {
  type: CalendarFileType;
  label: string;
  description: string;
  accept: string;
  icon: typeof FileText;
}[] = [
  {
    type: "pdf",
    label: "PDF do banco",
    description: "Documentos bancários em formato PDF.",
    accept: ".pdf,application/pdf",
    icon: FileText,
  },
  {
    type: "xml",
    label: "XML do banco",
    description: "Ficheiros bancários em formato XML.",
    accept: ".xml,text/xml,application/xml",
    icon: FileText,
  },
  {
    type: "report",
    label: "Relatório Excel",
    description: "Relatórios em formato Excel.",
    accept:
      ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    icon: FileSpreadsheet,
  },
];

export default function UploadFileDialog({
  isOpen,
  selectedDate,
  onClose,
  onUpload,
}: UploadFileDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedType, setSelectedType] =
    useState<CalendarFileType>("pdf");

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setSelectedType("pdf");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const currentType = fileTypes.find(
    (item) => item.type === selectedType,
  );

  function handleSubmit() {
    if (selectedFiles.length === 0) {
      inputRef.current?.click();
      return;
    }

    onUpload({
      date: selectedDate,
      type: selectedType,
      files: selectedFiles,
    });

    onClose();
  }

  function handleFilesChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(
      event.target.files ?? [],
    );

    setSelectedFiles(files);
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="dialog-header">
          <div>
            <span className="section-label">
              Novos ficheiros
            </span>

            <h2 id="upload-dialog-title">
              Adicionar ficheiros
            </h2>

            <p>{selectedDate}</p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="file-type-options">
          {fileTypes.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.type}
                type="button"
                className={[
                  "file-type-option",
                  selectedType === item.type
                    ? "file-type-option-active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setSelectedType(item.type);
                  setSelectedFiles([]);

                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                }}
              >
                <span className="file-type-icon">
                  <Icon size={22} />
                </span>

                <span>
                  <strong>{item.label}</strong>

                  <small>
                    {item.description}
                  </small>
                </span>
              </button>
            );
          })}
        </div>

        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={currentType?.accept}
          onChange={handleFilesChange}
        />

        <button
          type="button"
          className="file-drop-area"
          onClick={() =>
            inputRef.current?.click()
          }
        >
          <Upload size={25} />

          {selectedFiles.length > 0 ? (
            <>
              <strong>
                {selectedFiles.length === 1
                  ? "1 ficheiro selecionado"
                  : `${selectedFiles.length} ficheiros selecionados`}
              </strong>

              <span>
                Clique para alterar a seleção
              </span>
            </>
          ) : (
            <>
              <strong>
                Selecionar ficheiros
              </strong>

              <span>
                Pode selecionar vários ficheiros de uma só vez
              </span>
            </>
          )}
        </button>

        {selectedFiles.length > 0 ? (
          <div className="selected-files-list">
            {selectedFiles.map(
              (file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="selected-file-row"
                >
                  <FileText size={16} />

                  <span className="selected-file-name">
                    {file.name}
                  </span>

                  <span className="selected-file-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ),
            )}
          </div>
        ) : null}

        <div className="dialog-actions">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            icon={<Upload size={17} />}
            onClick={handleSubmit}
          >
            {selectedFiles.length > 0
              ? `Adicionar ${
                  selectedFiles.length
                } ${
                  selectedFiles.length === 1
                    ? "ficheiro"
                    : "ficheiros"
                }`
              : "Escolher ficheiros"}
          </Button>
        </div>
      </div>
    </div>
  );
}