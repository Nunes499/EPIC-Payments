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
  uploadCalendarFile,
  type ApiCalendarFile,
} from "@/services/calendarFiles";

import DayDrawer from "./DayDrawer";
import MonthCard from "./MonthCard";
import UploadFileDialog from "./UploadFileDialog";

import type {
  CalendarDayData,
  CalendarFile,
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
    size: formatFileSize(file.file_size),
    mimeType: file.mime_type,
    uploadedAt: file.uploaded_at,
  };
}

function countFileTypes(
  files: ApiCalendarFile[],
) {
  return {
    totalFiles: files.length,

    pdfCount: files.filter(
      (file) => file.file_type === "pdf",
    ).length,

    xmlCount: files.filter(
      (file) => file.file_type === "xml",
    ).length,

    reportCount: files.filter(
      (file) => file.file_type === "report",
    ).length,
  };
}

export default function AnnualCalendar({
  initialYear = new Date().getFullYear(),
}: AnnualCalendarProps) {
  const [year, setYear] =
    useState(initialYear);

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const [daysData, setDaysData] =
    useState<Record<string, CalendarDayData>>({});

  const [isUploadOpen, setIsUploadOpen] =
    useState(false);

  const [isLoadingFiles, setIsLoadingFiles] =
    useState(false);

  const [drawerError, setDrawerError] =
    useState<string | null>(null);

  const selectedDayData = selectedDate
    ? daysData[selectedDate]
    : undefined;

  const dataForCurrentYear = useMemo(() => {
    return Object.fromEntries(
      Object.entries(daysData).filter(([date]) =>
        date.startsWith(`${year}-`),
      ),
    );
  }, [daysData, year]);

  async function loadYearData(
    targetYear: number,
  ) {
    try {
      const summary =
        await listYearSummary(targetYear);

      setDaysData((current) => {
        const updated = { ...current };

        // Remove os dados-resumo antigos desse ano.
        for (const date of Object.keys(updated)) {
          if (
            date.startsWith(`${targetYear}-`)
          ) {
            delete updated[date];
          }
        }

        for (const item of summary) {
          updated[item.calendar_date] = {
            date: item.calendar_date,

            files: [],

            totalFiles:
              item.total_files,

            pdfCount:
              item.pdf_count,

            xmlCount:
              item.xml_count,

            reportCount:
              item.report_count,

            pendingMembers: 0,

            status:
              item.total_files > 0
                ? "uploaded"
                : "empty",
          };
        }

        return updated;
      });
    } catch (error) {
      console.error(
        "Erro ao carregar resumo anual:",
        error,
      );
    }
  }

  useEffect(() => {
    void loadYearData(year);
  }, [year]);

  async function loadFilesForDate(
    date: string,
  ) {
    setIsLoadingFiles(true);
    setDrawerError(null);

    try {
      const files =
        await listCalendarFiles(date);

      const counts =
        countFileTypes(files);

      setDaysData((current) => ({
        ...current,

        [date]: {
          date,

          files:
            files.map(mapApiFile),

          totalFiles:
            counts.totalFiles,

          pdfCount:
            counts.pdfCount,

          xmlCount:
            counts.xmlCount,

          reportCount:
            counts.reportCount,

          pendingMembers:
            current[date]?.pendingMembers ??
            0,

          status:
            files.length > 0
              ? "uploaded"
              : "empty",
        },
      }));
    } catch (error) {
      setDrawerError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar ficheiros.",
      );
    } finally {
      setIsLoadingFiles(false);
    }
  }

  async function handleSelectDay(
    date: string,
  ) {
    setSelectedDate(date);

    await loadFilesForDate(date);
  }

  function openCurrentDay() {
    const today = new Date();

    const date = [
      today.getFullYear(),

      String(
        today.getMonth() + 1,
      ).padStart(2, "0"),

      String(
        today.getDate(),
      ).padStart(2, "0"),
    ].join("-");

    setYear(
      today.getFullYear(),
    );

    void handleSelectDay(date);
  }

  async function handleUpload(
    payload: UploadFilePayload,
  ) {
    try {
      await uploadCalendarFile(
        payload.date,
        payload.file,
      );

      await loadFilesForDate(
        payload.date,
      );

      const uploadYear =
        Number(
          payload.date.slice(0, 4),
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
          : "Não foi possível enviar o ficheiro.",
      );
    }
  }

  async function handleDownload(
    file: CalendarFile,
  ) {
    try {
      await downloadCalendarFile({
        id: file.id,

        calendar_date:
          selectedDate ?? "",

        original_filename:
          file.name,

        stored_filename: "",

        file_type:
          file.type,

        mime_type:
          file.mimeType ?? null,

        file_size: null,

        file_path: "",

        uploaded_at:
          file.uploadedAt ?? "",
      });
    } catch (error) {
      setDrawerError(
        error instanceof Error
          ? error.message
          : "Não foi possível descarregar o ficheiro.",
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

    if (
      !confirmed ||
      !selectedDate
    ) {
      return;
    }

    try {
      await deleteCalendarFile(
        file.id,
      );

      await loadFilesForDate(
        selectedDate,
      );

      const selectedYear =
        Number(
          selectedDate.slice(
            0,
            4,
          ),
        );

      await loadYearData(
        selectedYear,
      );
    } catch (error) {
      setDrawerError(
        error instanceof Error
          ? error.message
          : "Não foi possível eliminar o ficheiro.",
      );
    }
  }

  function openUploadForSelectedDate() {
    if (!selectedDate) {
      const today =
        new Date();

      const date = [
        year,

        String(
          today.getMonth() + 1,
        ).padStart(2, "0"),

        String(
          today.getDate(),
        ).padStart(2, "0"),
      ].join("-");

      setSelectedDate(date);
    }

    setIsUploadOpen(true);
  }

  return (
    <>
      <section className="annual-calendar">
        <div className="annual-calendar-header">
          <div>
            <span className="section-label">
              Calendário bancário
            </span>

            <h2>{year}</h2>

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
                <Plus size={18} />
              }
              onClick={
                openUploadForSelectedDate
              }
            >
              Novo ficheiro
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
                year={year}
                month={monthIndex}
                monthName={monthName}
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
        onClose={() => {
          setSelectedDate(null);
          setDrawerError(null);
        }}
        onAddFile={() =>
          setIsUploadOpen(true)
        }
        onDownload={
          handleDownload
        }
        onDelete={
          handleDelete
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
          setIsUploadOpen(false)
        }
        onUpload={
          handleUpload
        }
      />
    </>
  );
}