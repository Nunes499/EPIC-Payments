"use client";

import {
  memo,
  useCallback,
} from "react";

import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";

import type {
  CalendarDayData,
} from "./calendar-types";


type DayCellProps = {
  dayNumber: number;

  date: string;

  isToday: boolean;

  data?: CalendarDayData;

  onClick: (
    date: string,
  ) => void;
};


function DayCell({
  dayNumber,
  date,
  isToday,
  data,
  onClick,
}: DayCellProps) {
  const pdfCount =
    data?.pdfCount ?? 0;

  const xmlCount =
    data?.xmlCount ?? 0;

  const recoveryCount =
    data?.recoveryCount ?? 0;

  const reportCount =
    data?.reportCount ?? 0;

  const pendingMembers =
    data?.pendingMembers ?? 0;


  const hasContent =
    (data?.totalFiles ?? 0) >
      0 ||
    pdfCount > 0 ||
    xmlCount > 0 ||
    recoveryCount > 0 ||
    reportCount > 0 ||
    pendingMembers > 0;


  const handleClick =
    useCallback(
      () => {
        onClick(
          date,
        );
      },
      [
        date,
        onClick,
      ],
    );


  return (
    <button
      type="button"
      className={[
        "calendar-day",

        isToday
          ? "calendar-day-today"
          : "",

        hasContent
          ? "calendar-day-has-content"
          : "",

        data?.status
          ? `calendar-day-${data.status}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={
        handleClick
      }
      aria-label={
        `Abrir dia ${date}`
      }
    >
      <span className="calendar-day-number">
        {dayNumber}
      </span>


      <div className="calendar-day-badges">
        {pdfCount > 0 ? (
          <span className="day-badge day-badge-pdf">
            <FileText
              size={11}
            />

            PDF {pdfCount}
          </span>
        ) : null}


        {xmlCount > 0 ? (
          <span className="day-badge day-badge-xml">
            <FileText
              size={11}
            />

            XML {xmlCount}
          </span>
        ) : null}


        {recoveryCount > 0 ? (
          <span className="day-badge day-badge-recovery">
            <RefreshCw
              size={11}
            />

            REC {recoveryCount}
          </span>
        ) : null}


        {reportCount > 0 ? (
          <span className="day-badge day-badge-report">
            <FileSpreadsheet
              size={11}
            />

            REL {reportCount}
          </span>
        ) : null}


        {pendingMembers >
        0 ? (
          <span className="day-badge day-badge-members">
            <Users
              size={11}
            />

            {
              pendingMembers
            }
          </span>
        ) : null}


        {data?.status ===
        "processed" ? (
          <span
            className="day-processed-icon"
            title="Processado"
          >
            <CheckCircle2
              size={14}
            />
          </span>
        ) : null}
      </div>
    </button>
  );
}


export default memo(
  DayCell,
  (
    previous,
    next,
  ) => {
    if (
      previous.dayNumber !==
        next.dayNumber ||
      previous.date !==
        next.date ||
      previous.isToday !==
        next.isToday ||
      previous.onClick !==
        next.onClick
    ) {
      return false;
    }

    const previousData =
      previous.data;

    const nextData =
      next.data;

    if (
      previousData ===
      nextData
    ) {
      return true;
    }

    return (
      (previousData
        ?.totalFiles ??
        0) ===
        (nextData
          ?.totalFiles ??
          0) &&
      (previousData
        ?.pdfCount ??
        0) ===
        (nextData
          ?.pdfCount ??
          0) &&
      (previousData
        ?.xmlCount ??
        0) ===
        (nextData
          ?.xmlCount ??
          0) &&
      (previousData
        ?.recoveryCount ??
        0) ===
        (nextData
          ?.recoveryCount ??
          0) &&
      (previousData
        ?.reportCount ??
        0) ===
        (nextData
          ?.reportCount ??
          0) &&
      (previousData
        ?.pendingMembers ??
        0) ===
        (nextData
          ?.pendingMembers ??
          0) &&
      previousData
        ?.status ===
        nextData
          ?.status
    );
  },
);
