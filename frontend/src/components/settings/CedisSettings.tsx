"use client";

import {
  AlertTriangle,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  downloadCedisFile,
  getActiveCedisFile,
  getCedisHistory,
  getCedisPreview,
  uploadCedisFile,
  type ApiCedisFile,
  type ApiCedisPreviewResponse,
} from "@/services/cedis";


function formatFileSize(
  size: number | null,
): string {
  if (!size) {
    return "—";
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}


function formatDateTime(
  value: string,
): string {
  const date =
    new Date(value);

  return new Intl.DateTimeFormat(
    "pt-PT",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}


export default function CedisSettings() {
  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    activeFile,
    setActiveFile,
  ] = useState<ApiCedisFile | null>(
    null,
  );

  const [
    history,
    setHistory,
  ] = useState<ApiCedisFile[]>(
    [],
  );

  const [
    preview,
    setPreview,
  ] = useState<ApiCedisPreviewResponse | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    isPreviewOpen,
    setIsPreviewOpen,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );


  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [
        active,
        versions,
      ] = await Promise.all([
        getActiveCedisFile(),
        getCedisHistory(),
      ]);

      setActiveFile(
        active,
      );

      setHistory(
        versions,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar a Base CEDIS.",
      );
    } finally {
      setIsLoading(
        false,
      );
    }
  }


  useEffect(() => {
    void loadData();
  }, []);


  async function handlePreview() {
    if (!activeFile) {
      return;
    }

    setError(null);

    try {
      const data =
        await getCedisPreview(
          activeFile.id,
          100,
        );

      setPreview(
        data,
      );

      setIsPreviewOpen(
        true,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível visualizar a base.",
      );
    }
  }


  async function handleDownload() {
    if (!activeFile) {
      return;
    }

    try {
      await downloadCedisFile(
        activeFile,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível descarregar a base.",
      );
    }
  }


  async function handleUpload(
    file: File,
  ) {
    setIsUploading(
      true,
    );

    setError(null);

    try {
      await uploadCedisFile(
        file,
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível substituir a Base CEDIS.",
      );
    } finally {
      setIsUploading(
        false,
      );

      if (inputRef.current) {
        inputRef.current.value =
          "";
      }
    }
  }


  return (
    <section className="cedis-settings">
      <div className="cedis-settings-header">
        <div>
          <span className="section-label">
            Base de Dados CEDIS
          </span>

          <h2>
            Gestão da base de sócios
          </h2>

          <p>
            Consulte, descarregue ou substitua a Base CEDIS
            utilizada pelo EPIC Payments.
          </p>
        </div>
      </div>

      {error ? (
        <div className="cedis-error">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="cedis-loading-card">
          A carregar Base CEDIS...
        </div>
      ) : null}

      {!isLoading &&
      activeFile ? (
        <article className="cedis-active-card">
          <div className="cedis-active-main">
            <span className="cedis-file-icon">
              <FileSpreadsheet size={25} />
            </span>

            <div>
              <div className="cedis-active-title-row">
                <h3>
                  {activeFile.original_filename}
                </h3>

                <span className="cedis-active-badge">
                  Base ativa
                </span>
              </div>

              <p>
                Ficheiro atualmente utilizado pelo sistema.
              </p>
            </div>
          </div>

          <div className="cedis-info-grid">
            <div>
              <span>
                Última atualização
              </span>

              <strong>
                {formatDateTime(
                  activeFile.uploaded_at,
                )}
              </strong>
            </div>

            <div>
              <span>
                Tamanho
              </span>

              <strong>
                {formatFileSize(
                  activeFile.file_size,
                )}
              </strong>
            </div>

            <div>
              <span>
                Versão
              </span>

              <strong>
                #{activeFile.id}
              </strong>
            </div>

            <div>
              <span>
                Estado
              </span>

              <strong className="cedis-status-active">
                Online
              </strong>
            </div>
          </div>

          <div className="cedis-actions">
            <button
              type="button"
              onClick={() =>
                void handlePreview()
              }
            >
              <Eye size={17} />
              Visualizar base
            </button>

            <button
              type="button"
              onClick={() =>
                void handleDownload()
              }
            >
              <Download size={17} />
              Descarregar
            </button>

            <button
              type="button"
              className="cedis-primary-action"
              onClick={() =>
                inputRef.current?.click()
              }
              disabled={isUploading}
            >
              <Upload size={17} />

              {isUploading
                ? "A carregar..."
                : "Substituir base"}
            </button>

            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".xls,.xlsx"
              onChange={(event) => {
                const file =
                  event.target.files?.[0];

                if (file) {
                  void handleUpload(
                    file,
                  );
                }
              }}
            />
          </div>
        </article>
      ) : null}

      {!isLoading &&
      !activeFile ? (
        <article className="cedis-empty-card">
          <Database size={32} />

          <h3>
            Nenhuma Base CEDIS ativa
          </h3>

          <p>
            Carregue o ficheiro RadGridExport.xls para começar.
          </p>

          <button
            type="button"
            className="cedis-primary-action"
            onClick={() =>
              inputRef.current?.click()
            }
          >
            <Upload size={17} />
            Carregar Base CEDIS
          </button>

          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".xls,.xlsx"
            onChange={(event) => {
              const file =
                event.target.files?.[0];

              if (file) {
                void handleUpload(
                  file,
                );
              }
            }}
          />
        </article>
      ) : null}

      <section className="cedis-history-section">
        <div className="cedis-history-header">
          <div>
            <History size={18} />

            <h3>
              Histórico de versões
            </h3>
          </div>

          <span>
            {history.length}
          </span>
        </div>

        {history.length ? (
          <div className="cedis-history-list">
            {history.map(
              (file) => (
                <div
                  key={file.id}
                  className="cedis-history-row"
                >
                  <div>
                    <strong>
                      {file.original_filename}
                    </strong>

                    <span>
                      {formatDateTime(
                        file.uploaded_at,
                      )}
                    </span>
                  </div>

                  <div className="cedis-history-meta">
                    <span>
                      {formatFileSize(
                        file.file_size,
                      )}
                    </span>

                    {file.is_active ? (
                      <span className="cedis-history-active">
                        Ativa
                      </span>
                    ) : (
                      <span>
                        Anterior
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="cedis-history-empty">
            Ainda não existem versões anteriores.
          </div>
        )}
      </section>

      {isPreviewOpen &&
      preview ? (
        <div
          className="cedis-preview-backdrop"
          onMouseDown={() =>
            setIsPreviewOpen(
              false,
            )
          }
        >
          <div
            className="cedis-preview-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="cedis-preview-header">
              <div>
                <span className="section-label">
                  Visualização
                </span>

                <h2>
                  {preview.file.original_filename}
                </h2>

                <p>
                  {preview.total_rows} registos encontrados
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsPreviewOpen(
                    false,
                  )
                }
              >
                Fechar
              </button>
            </div>

            <div className="cedis-preview-table-wrapper">
              <table className="cedis-preview-table">
                <thead>
                  <tr>
                    <th>
                      Nº Sócio
                    </th>

                    <th>
                      Nome
                    </th>

                    <th>
                      Telemóvel
                    </th>

                    <th>
                      Email
                    </th>

                    <th>
                      Ano Nascimento
                    </th>

                    <th>
                      Idade
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {preview.preview_rows.map(
                    (
                      row,
                      index,
                    ) => {
                      const isMinor =
                        typeof row.age ===
                          "number" &&
                        row.age < 18;

                      return (
                        <tr
                          key={`${row.member_number}-${index}`}
                          style={
                            isMinor
                              ? {
                                  background:
                                    "rgba(255, 32, 45, 0.055)",
                                }
                              : undefined
                          }
                        >
                          <td>
                            {row.member_number ??
                              "—"}
                          </td>

                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: "8px",
                              }}
                            >
                              <span>
                                {row.name ??
                                  "—"}
                              </span>

                              {isMinor ? (
                                <span
                                  title="Sócio menor de 18 anos"
                                  style={{
                                    display:
                                      "inline-flex",
                                    alignItems:
                                      "center",
                                    gap: "4px",
                                    border:
                                      "1px solid rgba(255, 32, 45, 0.28)",
                                    borderRadius:
                                      "999px",
                                    background:
                                      "rgba(255, 32, 45, 0.09)",
                                    padding:
                                      "3px 7px",
                                    color:
                                      "#c51824",
                                    fontSize:
                                      "8px",
                                    fontWeight:
                                      900,
                                    whiteSpace:
                                      "nowrap",
                                  }}
                                >
                                  <AlertTriangle
                                    size={10}
                                  />

                                  MENOR
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td>
                            {row.phone ??
                              "—"}
                          </td>

                          <td>
                            {row.email ??
                              "—"}
                          </td>

                          <td>
                            {row.birth_year ??
                              "—"}
                          </td>

                          <td>
                            {isMinor ? (
                              <span
                                style={{
                                  display:
                                    "inline-flex",
                                  alignItems:
                                    "center",
                                  gap: "5px",
                                  borderRadius:
                                    "999px",
                                  background:
                                    "#ff202d",
                                  padding:
                                    "4px 8px",
                                  color:
                                    "#ffffff",
                                  fontWeight:
                                    900,
                                }}
                              >
                                <AlertTriangle
                                  size={10}
                                />

                                {row.age} anos
                              </span>
                            ) : (
                              row.age ??
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}