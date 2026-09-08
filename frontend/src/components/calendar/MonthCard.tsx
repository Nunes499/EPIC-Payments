"use client";

import {
  memo,
  useMemo,
} from "react";

import DayCell from "./DayCell";
import type {
  CalendarDayData,
} from "./calendar-types";

type MonthCardProps = {
  year: number;
  month: number;
  monthName: string;
  daysData: Record<
    string,
    CalendarDayData
  >;
  onSelectDay: (
    date: string,
  ) => void;
};

const weekDays = [
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
  "Dom",
];

function formatDate(
  year: number,
  month: number,
  day: number,
) {
  return `${year}-${String(
    month + 1,
  ).padStart(
    2,
    "0",
  )}-${String(
    day,
  ).padStart(
    2,
    "0",
  )}`;
}

function isSameDay(
  dateA: Date,
  dateB: Date,
) {
  return (
    dateA.getFullYear() ===
      dateB.getFullYear() &&
    dateA.getMonth() ===
      dateB.getMonth() &&
    dateA.getDate() ===
      dateB.getDate()
  );
}

function areMonthDataEqual(
  previous: Record<
    string,
    CalendarDayData
  >,
  next: Record<
    string,
    CalendarDayData
  >,
) {
  if (
    previous === next
  ) {
    return true;
  }

  const previousKeys =
    Object.keys(
      previous,
    );
  const nextKeys =
    Object.keys(
      next,
    );

  if (
    previousKeys.length !==
    nextKeys.length
  ) {
    return false;
  }

  for (
    const key
    of previousKeys
  ) {
    if (
      previous[key] !==
      next[key]
    ) {
      return false;
    }
  }

  return true;
}

function MonthCard({
  year,
  month,
  monthName,
  daysData,
  onSelectDay,
}: MonthCardProps) {
  const calendarMeta =
    useMemo(
      () => {
        const numberOfDays =
          new Date(
            year,
            month + 1,
            0,
          ).getDate();

        const firstDayOfMonth =
          new Date(
            year,
            month,
            1,
          ).getDay();

        const mondayBasedOffset =
          firstDayOfMonth === 0
            ? 6
            : firstDayOfMonth -
              1;

        const today =
          new Date();

        const days =
          Array.from(
            {
              length:
                numberOfDays,
            },
            (
              _,
              index,
            ) => {
              const dayNumber =
                index + 1;

              const date =
                formatDate(
                  year,
                  month,
                  dayNumber,
                );

              const currentDate =
                new Date(
                  year,
                  month,
                  dayNumber,
                );

              return {
                dayNumber,
                date,
                isToday:
                  isSameDay(
                    currentDate,
                    today,
                  ),
              };
            },
          );

        return {
          mondayBasedOffset,
          days,
        };
      },
      [
        year,
        month,
      ],
    );

  return (
    <article className="month-card">
      <header className="month-card-header">
        <h3>
          {monthName}
        </h3>

        <span>
          {year}
        </span>
      </header>

      <div className="month-weekdays">
        {weekDays.map(
          (day) => (
            <span
              key={
                day
              }
            >
              {day}
            </span>
          ),
        )}
      </div>

      <div className="month-days-grid">
        {Array.from({
          length:
            calendarMeta
              .mondayBasedOffset,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={`empty-${index}`}
              className="calendar-day-empty"
              aria-hidden="true"
            />
          ),
        )}

        {calendarMeta.days.map(
          ({
            dayNumber,
            date,
            isToday,
          }) => (
            <DayCell
              key={
                date
              }
              dayNumber={
                dayNumber
              }
              date={
                date
              }
              isToday={
                isToday
              }
              data={
                daysData[
                  date
                ]
              }
              onClick={
                onSelectDay
              }
            />
          ),
        )}
      </div>
    </article>
  );
}

export default memo(
  MonthCard,
  (
    previous,
    next,
  ) =>
    previous.year ===
      next.year &&
    previous.month ===
      next.month &&
    previous.monthName ===
      next.monthName &&
    previous.onSelectDay ===
      next.onSelectDay &&
    areMonthDataEqual(
      previous.daysData,
      next.daysData,
    ),
);
