"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import Button from "@/components/ui/Button";

import {
  deleteCalendarFile,
  downloadCalendarFile,
  listCalendarFiles,
  listYearSummary,
  previewCalendarFile,
  uploadCalendarFile,
  type ApiCalendarFile,
} from "@/services/calendarFiles";

import DayDrawer from "./DayDrawer";
import MonthCard from "./MonthCard";
import UploadFileDialog from "./UploadFileDialog";
import ProcessingWorkspace from "./ProcessingWorkspace";

import type {
  CalendarDayData,
  CalendarFile,
  ProcessingSelection,
  UploadFilePayload,
} from "./calendar-types";


const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];


type AnnualCalendarProps = {
  initialYear?: number;
};


function formatFileSize(
  size: number | null,
): string | undefined {
  if (!size) {
    return undefined;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}


function mapApiFile(
  file: ApiCalendarFile,
): CalendarFile {
  return {
    id: file.id,
    name: file.original_filename,
    type: file.file_type,
    size: formatFileSize(
      file.file_size,
    ),
    mimeType: file.mime_type,
    uploadedAt: file.uploaded_at,

    fileCategory:
      file.file_category,

    recoveryPart:
      file.recovery_part,

    relatedFileId:
      file.related_file_id,
  };
}


function countFileTypes(
  files: ApiCalendarFile[],
) {
  const recoveryFiles =
    files.filter(
      (file) =>
        file.file_category ===
        "recovery",
    );

  const normalPdfFiles =
    files.filter(
      (file) =>
        file.file_type === "pdf" &&
        file.file_category !==
          "recovery",
    );

  const normalXmlFiles =
    files.filter(
      (file) =>
        file.file_type === "xml" &&
        file.file_category !==
          "recovery",
    );

  return {
    totalFiles:
      files.length,

    pdfCount:
      normalPdfFiles.length,

    xmlCount:
      normalXmlFiles.length,

    recoveryCount:
      recoveryFiles.length,

    reportCount:
      files.filter(
        (file) =>
          file.file_type ===
          "report",
      ).length,
  };
}


export default function AnnualCalendar({
  initialYear =
    new Date().getFullYear(),
}: AnnualCalendarProps) {
  const [
    year,
    setYear,
  ] = useState(
    initialYear,
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<string | null>(
    null,
  );

  const [
    daysData,
    setDaysData,
  ] = useState<
    Record<
      string,
      CalendarDayData
    >
  >({});

  const [
    isUploadOpen,
    setIsUploadOpen,
  ] = useState(false);

  const [
    isLoadingFiles,
    setIsLoadingFiles,
  ] = useState(false);

  const [
    drawerError,
    setDrawerError,
  ] = useState<string | null>(
    null,
  );

  const [
    selectedFileIds,
    setSelectedFileIds,
  ] = useState<number[]>([]);

  const [
    processingSelection,
    setProcessingSelection,
  ] = useState<
    ProcessingSelection | null
  >(
    null,
  );


  const selectedDayData =
    selectedDate
      ? daysData[
          selectedDate
        ]
      : undefined;


  const dataForCurrentYear =
    useMemo(() => {
      return Object.fromEntries(
        Object.entries(
          daysData,
        ).filter(
          ([date]) =>
            date.startsWith(
              `${year}-`,
            ),
        ),
      );
    }, [
      daysData,
      year,
    ]);


  async function loadYearData(
    targetYear: number,
  ) {
    try {
      const summary =
        await listYearSummary(
          targetYear,
        );

      setDaysData(
        (current) => {
          const updated = {
            ...current,
          };

          const summaryDates =
            new Set(
              summary.map(
                (item) =>
                  item.calendar_date,
              ),
            );

          for (
            const date
            of Object.keys(
              updated,
            )
          ) {
            if (
              date.startsWith(
                `${targetYear}-`,
              ) &&
              !summaryDates.has(
                date,
              )
            ) {
              delete updated[
                date
              ];
            }
          }

          for (
            const item
            of summary
          ) {
            const existing =
              current[
                item.calendar_date
              ];

            updated[
              item.calendar_date
            ] = {
              date:
                item.calendar_date,

              files:
                existing?.files ??
                [],

              totalFiles:
                item.total_files,

              pdfCount:
                item.pdf_count,

              xmlCount:
                item.xml_count,

              recoveryCount:
                item.recovery_count,

              reportCount:
                item.report_count,

              pendingMembers:
                existing
                  ?.pendingMembers ??
                0,

              status:
                item.total_files >
                0
                  ? "uploaded"
                  : "empty",
            };
          }

          return updated;
        },
      );
    } catch (error) {
      console.error(
        "Erro ao carregar resumo anual:",
        error,
      );
    }
  }


  useEffect(() => {
    void loadYearData(
      year,
    );
  }, [year]);


  async function loadFilesForDate(
    date: string,
  ) {
    setIsLoadingFiles(
      true,
    );

    setDrawerError(
      null,
    );

    try {
      const files =
        await listCalendarFiles(
          date,
        );

      const counts =
        countFileTypes(
          files,
        );

      const mappedFiles =
        files.map(
          mapApiFile,
        );

      setDaysData(
        (current) => ({
          ...current,

          [date]: {
            date,

            files:
              mappedFiles,

            totalFiles:
              counts.totalFiles,

            pdfCount:
              counts.pdfCount,

            xmlCount:
              counts.xmlCount,

            recoveryCount:
              counts.recoveryCount,

            reportCount:
              counts.reportCount,

            pendingMembers:
              current[
                date
              ]
                ?.pendingMembers ??
              0,

            status:
              files.length > 0
                ? "uploaded"
                : "empty",
          },
        }),
      );

      const validProcessableIds =
        new Set(
          mappedFiles
            .filter(
              (file) =>
                file.type ===
                  "pdf" ||
                file.type ===
                  "xml",
            )
            .map(
              (file) =>
                file.id,
            ),
        );

      setSelectedFileIds(
        (current) =>
          current.filter(
            (fileId) =>
              validProcessableIds.has(
                fileId,
              ),
          ),
      );
    } catch (error) {
      setDrawerError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar ficheiros.",
      );
    } finally {
      setIsLoadingFiles(
        false,
      );
    }
  }


  async function handleSelectDay(
    date: string,
  ) {
    setSelectedFileIds(
      [],
    );

    setSelectedDate(
      date,
    );

    await loadFilesForDate(
      date,
    );
  }


  function openCurrentDay() {
    const today =
      new Date();

    const date = [
      today.getFullYear(),
      String(
        today.getMonth() +
        1,
      ).padStart(
        2,
        "0",
      ),
      String(
        today.getDate(),
      ).padStart(
        2,
        "0",
      ),
    ].join("-");

    setYear(
      today.getFullYear(),
    );

    void handleSelectDay(
      date,
    );
  }


  function openUploadForSelectedDate() {
    if (!selectedDate) {
      openCurrentDay();

      window.setTimeout(
        () => {
          setIsUploadOpen(
            true,
          );
        },
        0,
      );

      return;
    }

    setIsUploadOpen(
      true,
    );
  }


  function handleToggleFile(
    fileId: number,
  ) {
    setSelectedFileIds(
      (current) =>
        current.includes(
          fileId,
        )
          ? current.filter(
              (id) =>
                id !==
                fileId,
            )
          : [
              ...current,
              fileId,
            ],
    );
  }


  function handleSelectAllFiles() {
    if (!selectedDayData) {
      return;
    }

    const ids =
      selectedDayData.files
        .filter(
          (file) =>
            file.type ===
              "pdf" ||
            file.type ===
              "xml",
        )
        .map(
          (file) =>
            file.id,
        );

    setSelectedFileIds(
      ids,
    );
  }


  function handleClearSelection() {
    setSelectedFileIds(
      [],
    );
  }


  async function handleUpload(
    payload: UploadFilePayload,
  ) {
    try {
      if (
        payload.mode ===
        "recovery"
      ) {
        const recoveryFile1 =
          await uploadCalendarFile(
            payload.date,
            payload.recoveryFile1,
            {
              fileCategory:
                "recovery",

              recoveryPart:
                1,
            },
          );

        await uploadCalendarFile(
          payload.date,
          payload.recoveryFile2,
          {
            fileCategory:
              "recovery",

            recoveryPart:
              2,

            relatedFileId:
              recoveryFile1.id,
          },
        );
      } else {
        for (
          const file
          of payload.files
        ) {
          await uploadCalendarFile(
            payload.date,
            file,
            {
              fileCategory:
                payload.fileCategory,
            },
          );
        }
      }

      await loadFilesForDate(
        payload.date,
      );

      const uploadYear =
        Number(
          payload.date.slice(
            0,
            4,
          ),
        );

      await loadYearData(
        uploadYear,
      );

      setSelectedDate(
        payload.date,
      );
    } catch (error) {
      setDrawerError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar os ficheiros.",
      );
    }
  }


  async function handlePreview(
    file: CalendarFile,
  ) {
    try {
      await previewCalendarFile(
        {
          id:
            file.id,

          calendar_date:
            selectedDate ??
            "",

          original_filename:
            file.name,

          stored_filename:
            "",

          file_type:
            file.type,

          file_category:
            file.fileCategory ??
            "normal",

          recovery_part:
            file.recoveryPart ??
            null,

          related_file_id:
            file.relatedFileId ??
            null,

          mime_type:
            file.mimeType ??
            null,

          file_size:
            null,

          file_path:
            "",

          uploaded_at:
            file.uploadedAt ??
            "",
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível pré-visualizar o ficheiro.";

      window.alert(
        message,
      );
    }
  }


  async function handleDownload(
    file: CalendarFile,
  ) {
    try {
      await downloadCalendarFile(
        {
          id:
            file.id,

          calendar_date:
            selectedDate ??
            "",

          original_filename:
            file.name,

          stored_filename:
            "",

          file_type:
            file.type,

          file_category:
            file.fileCategory ??
            "normal",

          recovery_part:
            file.recoveryPart ??
            null,

          related_file_id:
            file.relatedFileId ??
            null,

          mime_type:
            file.mimeType ??
            null,

          file_size:
            null,

          file_path:
            "",

          uploaded_at:
            file.uploadedAt ??
            "",
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível descarregar o ficheiro.";

      window.alert(
        message,
      );
    }
  }


  async function handleDelete(
    file: CalendarFile,
  ) {
    const confirmed =
      window.confirm(
        `Pretende eliminar o ficheiro "${file.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteCalendarFile(
        file.id,
      );

      if (
        selectedDate
      ) {
        await loadFilesForDate(
          selectedDate,
        );

        await loadYearData(
          Number(
            selectedDate.slice(
              0,
              4,
            ),
          ),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível eliminar o ficheiro.";

      window.alert(
        message,
      );
    }
  }


  function handleOpenProcessing() {
    if (
      !selectedDate ||
      !selectedDayData
    ) {
      return;
    }

    const selectedFiles =
      selectedDayData.files.filter(
        (file) =>
          selectedFileIds.includes(
            file.id,
          ) &&
          (
            file.type ===
              "pdf" ||
            file.type ===
              "xml"
          ),
      );

    if (
      selectedFiles.length ===
      0
    ) {
      window.alert(
        "Selecione pelo menos um ficheiro PDF, XML ou de Recuperação.",
      );

      return;
    }

    setProcessingSelection({
      date:
        selectedDate,

      files:
        selectedFiles,
    });
  }


  function handleCloseProcessing() {
    setProcessingSelection(
      null,
    );
  }


  function handleCloseDrawer() {
    setSelectedDate(
      null,
    );

    setSelectedFileIds(
      [],
    );

    setDrawerError(
      null,
    );
  }


  return (
    <>
      <section className="annual-calendar">
        <div className="annual-calendar-header">
          <div>
            <span className="section-label">
              Calendário bancário
            </span>

            <h2>
              {year}
            </h2>

            <p>
              Selecione um dia para consultar ou adicionar ficheiros.
            </p>
          </div>

          <div className="annual-calendar-actions">
            <Button
              variant="secondary"
              onClick={() =>
                setYear(
                  (current) =>
                    current - 1,
                )
              }
              aria-label="Ano anterior"
            >
              <ChevronLeft
                size={18}
              />
            </Button>

            <Button
              variant="secondary"
              onClick={
                openCurrentDay
              }
            >
              Hoje
            </Button>

            <Button
              variant="secondary"
              onClick={() =>
                setYear(
                  (current) =>
                    current + 1,
                )
              }
              aria-label="Ano seguinte"
            >
              <ChevronRight
                size={18}
              />
            </Button>

            <Button
              icon={
                <Plus
                  size={18}
                />
              }
              onClick={
                openUploadForSelectedDate
              }
            >
              Adicionar ficheiros
            </Button>
          </div>
        </div>


        <div className="annual-calendar-grid">
          {monthNames.map(
            (
              monthName,
              monthIndex,
            ) => (
              <MonthCard
                key={`${year}-${monthIndex}`}
                year={
                  year
                }
                month={
                  monthIndex
                }
                monthName={
                  monthName
                }
                daysData={
                  dataForCurrentYear
                }
                onSelectDay={
                  handleSelectDay
                }
              />
            ),
          )}
        </div>
      </section>


      <DayDrawer
        isOpen={
          Boolean(
            selectedDate,
          )
        }
        selectedDate={
          selectedDate
        }
        data={
          selectedDayData
        }
        isLoading={
          isLoadingFiles
        }
        error={
          drawerError
        }
        selectedFileIds={
          selectedFileIds
        }
        onClose={
          handleCloseDrawer
        }
        onAddFile={() =>
          setIsUploadOpen(
            true,
          )
        }
        onToggleFile={
          handleToggleFile
        }
        onSelectAllFiles={
          handleSelectAllFiles
        }
        onClearSelection={
          handleClearSelection
        }
        onOpenProcessing={
          handleOpenProcessing
        }
        onPreview={
          handlePreview
        }
        onDownload={
          handleDownload
        }
        onDelete={
          handleDelete
        }
      />


      <ProcessingWorkspace
        selection={
          processingSelection
        }
        onClose={
          handleCloseProcessing
        }
      />


      <UploadFileDialog
        isOpen={
          isUploadOpen
        }
        selectedDate={
          selectedDate ??
          `${year}-01-01`
        }
        onClose={() =>
          setIsUploadOpen(
            false,
          )
        }
        onUpload={
          handleUpload
        }
      />
    </>
  );
}