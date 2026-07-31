"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import Button from "@/components/ui/Button";

import DayDrawer from "./DayDrawer";
import MonthCard from "./MonthCard";
import UploadFileDialog from "./UploadFileDialog";

import type {
  CalendarDayData,
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

const initialDemoData: Record<string, CalendarDayData> = {
  "2026-07-01": {
    date: "2026-07-01",
    pendingMembers: 18,
    status: "pending",
    files: [
      {
        id: 1,
        name: "Retornos_01-07-2026.pdf",
        type: "pdf",
        size: "245 KB",
      },
      {
        id: 2,
        name: "Debitos_01-07-2026.xml",
        type: "xml",
        size: "82 KB",
      },
    ],
  },
  "2026-07-25": {
    date: "2026-07-25",
    pendingMembers: 0,
    status: "processed",
    files: [
      {
        id: 3,
        name: "Retornos_25-07-2026.pdf",
        type: "pdf",
        size: "311 KB",
      },
      {
        id: 4,
        name: "Relatorio_25-07-2026.xlsx",
        type: "report",
        size: "48 KB",
      },
    ],
  },
  "2026-08-01": {
    date: "2026-08-01",
    pendingMembers: 9,
    status: "uploaded",
    files: [
      {
        id: 5,
        name: "Banco_01-08-2026.xml",
        type: "xml",
        size: "64 KB",
      },
    ],
  },
};

type AnnualCalendarProps = {
  initialYear?: number;
};

export default function AnnualCalendar({
  initialYear = new Date().getFullYear(),
}: AnnualCalendarProps) {
  const [year, setYear] = useState(initialYear);

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const [daysData, setDaysData] =
    useState<Record<string, CalendarDayData>>(
      initialYear === 2026 ? initialDemoData : {},
    );

  const [isUploadOpen, setIsUploadOpen] =
    useState(false);

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

  function openCurrentDay() {
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    setYear(today.getFullYear());
    setSelectedDate(date);
  }

  function handleUpload(payload: UploadFilePayload) {
    const newFileId = Date.now();

    setDaysData((current) => {
      const existing = current[payload.date];

      const newFile = {
        id: newFileId,
        name: payload.file.name,
        type: payload.type,
        size: `${(payload.file.size / 1024).toFixed(1)} KB`,
      };

      return {
        ...current,
        [payload.date]: {
          date: payload.date,
          pendingMembers: existing?.pendingMembers ?? 0,
          status: "uploaded",
          files: [...(existing?.files ?? []), newFile],
        },
      };
    });

    setSelectedDate(payload.date);
  }

  function openUploadForToday() {
    const today = new Date();

    const date = [
      year,
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    setSelectedDate(date);
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
              onClick={() => setYear((current) => current - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeft size={18} />
            </Button>

            <Button
              variant="secondary"
              onClick={openCurrentDay}
            >
              Hoje
            </Button>

            <Button
              variant="secondary"
              onClick={() => setYear((current) => current + 1)}
              aria-label="Ano seguinte"
            >
              <ChevronRight size={18} />
            </Button>

            <Button
              icon={<Plus size={18} />}
              onClick={openUploadForToday}
            >
              Novo ficheiro
            </Button>
          </div>
        </div>

        <div className="annual-calendar-grid">
          {monthNames.map((monthName, monthIndex) => (
            <MonthCard
              key={`${year}-${monthIndex}`}
              year={year}
              month={monthIndex}
              monthName={monthName}
              daysData={dataForCurrentYear}
              onSelectDay={setSelectedDate}
            />
          ))}
        </div>
      </section>

      <DayDrawer
        isOpen={Boolean(selectedDate)}
        selectedDate={selectedDate}
        data={selectedDayData}
        onClose={() => setSelectedDate(null)}
        onAddFile={() => setIsUploadOpen(true)}
      />

      <UploadFileDialog
        isOpen={isUploadOpen}
        selectedDate={
          selectedDate ??
          `${year}-01-01`
        }
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
      />
    </>
  );
}