"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Upload, X } from "lucide-react";

import Button from "@/components/ui/Button";

import type { UploadFilePayload } from "./calendar-types";

type UploadFileDialogProps = {
  isOpen: boolean;
  selectedDate: string;
  onClose: () => void;
  onUpload: (payload: UploadFilePayload) => void;
};

type UploadMode = "pdf" | "xml" | "recovery";

const standardFileTypes: {
  type: "pdf" | "xml";
  label: string;
  description: string;
  accept: string;
  icon: typeof FileText;
}[] = [
  {
    type: "pdf",
    label: "PDF do banco",
    description: "Documento bancário normal em formato PDF.",
    accept: ".pdf,application/pdf",
    icon: FileText,
  },
  {
    type: "xml",
    label: "XML do banco",
    description: "Ficheiro bancário normal em formato XML.",
    accept: ".xml,text/xml,application/xml",
    icon: FileText,
  },
];

export default function UploadFileDialog({
  isOpen,
  selectedDate,
  onClose,
  onUpload,
}: UploadFileDialogProps) {
  const standardInputRef = useRef<HTMLInputElement>(null);
  const recoveryFile1InputRef = useRef<HTMLInputElement>(null);
  const recoveryFile2InputRef = useRef<HTMLInputElement>(null);

  const [selectedMode, setSelectedMode] = useState<UploadMode>("pdf");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [recoveryFile1, setRecoveryFile1] = useState<File | null>(null);
  const [recoveryFile2, setRecoveryFile2] = useState<File | null>(null);

  function resetInputs() {
    setSelectedFiles([]);
    setRecoveryFile1(null);
    setRecoveryFile2(null);

    if (standardInputRef.current) standardInputRef.current.value = "";
    if (recoveryFile1InputRef.current) recoveryFile1InputRef.current.value = "";
    if (recoveryFile2InputRef.current) recoveryFile2InputRef.current.value = "";
  }

  useEffect(() => {
    if (!isOpen) {
      resetInputs();
      setSelectedMode("pdf");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStandardType = standardFileTypes.find(
    (item) => item.type === selectedMode,
  );

  function selectMode(mode: UploadMode) {
    setSelectedMode(mode);
    resetInputs();
  }

  function handleStandardFilesChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setSelectedFiles(Array.from(event.target.files ?? []));
  }

  function handleSubmit() {
    if (selectedMode === "recovery") {
      if (!recoveryFile1) {
        recoveryFile1InputRef.current?.click();
        return;
      }

      if (!recoveryFile2) {
        recoveryFile2InputRef.current?.click();
        return;
      }

      onUpload({
        mode: "recovery",
        date: selectedDate,
        recoveryFile1,
        recoveryFile2,
      });
      onClose();
      return;
    }

    if (selectedFiles.length === 0) {
      standardInputRef.current?.click();
      return;
    }

    onUpload({
      mode: "standard",
      date: selectedDate,
      type: selectedMode,
      files: selectedFiles,
      fileCategory: "normal",
    });
    onClose();
  }

  const recoveryReady = recoveryFile1 !== null && recoveryFile2 !== null;

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
            <span className="section-label">Novos ficheiros</span>
            <h2 id="upload-dialog-title">Adicionar ficheiros</h2>
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
          {standardFileTypes.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.type}
                type="button"
                className={[
                  "file-type-option",
                  selectedMode === item.type ? "file-type-option-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectMode(item.type)}
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

          <button
            type="button"
            className={[
              "file-type-option",
              selectedMode === "recovery" ? "file-type-option-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => selectMode("recovery")}
          >
            <span className="file-type-icon">
              <RefreshCw size={22} />
            </span>
            <span>
              <strong>Ficheiro de Recuperação</strong>
              <small>Carregue os 2 ficheiros PDF da recuperação.</small>
            </span>
          </button>
        </div>

        {selectedMode !== "recovery" ? (
          <>
            <input
              ref={standardInputRef}
              type="file"
              hidden
              multiple
              accept={currentStandardType?.accept}
              onChange={handleStandardFilesChange}
            />

            <button
              type="button"
              className="file-drop-area"
              onClick={() => standardInputRef.current?.click()}
            >
              <Upload size={25} />
              {selectedFiles.length > 0 ? (
                <>
                  <strong>
                    {selectedFiles.length === 1
                      ? "1 ficheiro selecionado"
                      : `${selectedFiles.length} ficheiros selecionados`}
                  </strong>
                  <span>Clique para alterar a seleção</span>
                </>
              ) : (
                <>
                  <strong>Selecionar ficheiros</strong>
                  <span>Pode selecionar vários ficheiros de uma só vez</span>
                </>
              )}
            </button>

            {selectedFiles.length > 0 ? (
              <div className="selected-files-list">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="selected-file-row"
                  >
                    <FileText size={16} />
                    <span className="selected-file-name">{file.name}</span>
                    <span className="selected-file-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <input
              ref={recoveryFile1InputRef}
              type="file"
              hidden
              accept=".pdf,application/pdf"
              onChange={(event) =>
                setRecoveryFile1(event.target.files?.[0] ?? null)
              }
            />
            <input
              ref={recoveryFile2InputRef}
              type="file"
              hidden
              accept=".pdf,application/pdf"
              onChange={(event) =>
                setRecoveryFile2(event.target.files?.[0] ?? null)
              }
            />

            <div className="selected-files-list">
              <button
                type="button"
                className="file-drop-area"
                onClick={() => recoveryFile1InputRef.current?.click()}
              >
                <Upload size={23} />
                <strong>Ficheiro 1</strong>
                <span>
                  {recoveryFile1
                    ? recoveryFile1.name
                    : "Selecionar o primeiro PDF da recuperação"}
                </span>
              </button>

              <button
                type="button"
                className="file-drop-area"
                onClick={() => recoveryFile2InputRef.current?.click()}
              >
                <Upload size={23} />
                <strong>Ficheiro 2</strong>
                <span>
                  {recoveryFile2
                    ? recoveryFile2.name
                    : "Selecionar o segundo PDF da recuperação"}
                </span>
              </button>
            </div>
          </>
        )}

        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>

          <Button icon={<Upload size={17} />} onClick={handleSubmit}>
            {selectedMode === "recovery"
              ? recoveryReady
                ? "Adicionar recuperação"
                : "Escolher ficheiros"
              : selectedFiles.length > 0
                ? `Adicionar ${selectedFiles.length} ${
                    selectedFiles.length === 1 ? "ficheiro" : "ficheiros"
                  }`
                : "Escolher ficheiros"}
          </Button>
        </div>
      </div>
    </div>
  );
}
