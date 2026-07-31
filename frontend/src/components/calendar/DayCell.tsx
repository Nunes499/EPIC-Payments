"use client";

import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Users,
} from "lucide-react";

import type { CalendarDayData } from "./calendar-types";

type DayCellProps = {
  dayNumber: number;
  date: string;
  isToday: boolean;
  data?: CalendarDayData;
  onClick: (date: string) => void;
};

export default function DayCell({
  dayNumber,
  date,
  isToday,
  data,
  onClick,
}: DayCellProps) {
  const pdfCount =
    data?.files.filter((file) => file.type === "pdf").length ?? 0;

  const xmlCount =
    data?.files.filter((file) => file.type === "xml").length ?? 0;

  const reportCount =
    data?.files.filter((file) => file.type === "report").length ?? 0;

  const hasContent =
    pdfCount > 0 ||
    xmlCount > 0 ||
    reportCount > 0 ||
    (data?.pendingMembers ?? 0) > 0;

  return (
    <button
      type="button"
      className={[
        "calendar-day",
        isToday ? "calendar-day-today" : "",
        hasContent ? "calendar-day-has-content" : "",
        data?.status ? `calendar-day-${data.status}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onClick(date)}
      aria-label={`Abrir dia ${date}`}
    >
      <span className="calendar-day-number">{dayNumber}</span>

      <div className="calendar-day-badges">
        {pdfCount > 0 ? (
          <span className="day-badge day-badge-pdf">
            <FileText size={11} />
            PDF {pdfCount}
          </span>
        ) : null}

        {xmlCount > 0 ? (
          <span className="day-badge day-badge-xml">
            <FileText size={11} />
            XML {xmlCount}
          </span>
        ) : null}

        {reportCount > 0 ? (
          <span className="day-badge day-badge-report">
            <FileSpreadsheet size={11} />
            REL
          </span>
        ) : null}

        {(data?.pendingMembers ?? 0) > 0 ? (
          <span className="day-badge day-badge-members">
            <Users size={11} />
            {data?.pendingMembers}
          </span>
        ) : null}

        {data?.status === "processed" ? (
          <span className="day-processed-icon" title="Processado">
            <CheckCircle2 size={14} />
          </span>
        ) : null}
      </div>
    </button>
  );
}