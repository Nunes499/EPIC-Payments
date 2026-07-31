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
    description: "Documento bancário em formato PDF.",
    accept: ".pdf,application/pdf",
    icon: FileText,
  },
  {
    type: "xml",
    label: "XML do banco",
    description: "Ficheiro bancário em formato XML.",
    accept: ".xml,text/xml,application/xml",
    icon: FileText,
  },
  {
    type: "report",
    label: "Relatório Excel",
    description: "Relatório em formato Excel.",
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

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
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
    if (!selectedFile) {
      inputRef.current?.click();
      return;
    }

    onUpload({
      date: selectedDate,
      type: selectedType,
      file: selectedFile,
    });

    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <span className="section-label">Novo ficheiro</span>
            <h2 id="upload-dialog-title">
              Adicionar ficheiro
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
                  setSelectedFile(null);
                }}
              >
                <span className="file-type-icon">
                  <Icon size={22} />
                </span>

                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </div>

        <input
          ref={inputRef}
          type="file"
          hidden
          accept={currentType?.accept}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
          }}
        />

        <button
          type="button"
          className="file-drop-area"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={25} />

          {selectedFile ? (
            <>
              <strong>{selectedFile.name}</strong>
              <span>
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </>
          ) : (
            <>
              <strong>Selecionar ficheiro</strong>
              <span>
                Clique para escolher um ficheiro do computador
              </span>
            </>
          )}
        </button>

        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            icon={<Upload size={17} />}
            onClick={handleSubmit}
          >
            {selectedFile
              ? "Adicionar ficheiro"
              : "Escolher ficheiro"}
          </Button>
        </div>
      </div>
    </div>
  );
}