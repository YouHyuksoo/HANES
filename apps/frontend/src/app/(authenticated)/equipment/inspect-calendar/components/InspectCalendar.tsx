"use client";

/**
 * @file InspectCalendar.tsx
 * @description 월별 캘린더 그리드 - 설비점검항목 마스터 기준 스케줄 표시
 *
 * 초보자 가이드:
 * 1. **CalendarDaySummary**: 날짜별 점검 요약 (total, completed, pass, fail, status)
 * 2. **셀 색상**: ALL_PASS=초록, HAS_FAIL=빨강, IN_PROGRESS=노랑, OVERDUE=빨간테두리
 * 3. **진행바**: 완료/전체 비율을 미니바로 표시
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";

export interface CalendarDaySummary {
  date: string;
  total: number;
  completed: number;
  pass: number;
  fail: number;
  status: string;
}

interface InspectCalendarProps {
  year: number;
  month: number;
  data: CalendarDaySummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  monthLabel?: string | null;
  loading?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  ALL_PASS: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  HAS_FAIL: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
  IN_PROGRESS: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  NOT_STARTED: "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
  OVERDUE: "bg-gray-50 dark:bg-gray-800/50 border-red-400 dark:border-red-600 border-2",
  NONE: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800",
};

const STATUS_DOT: Record<string, string> = {
  ALL_PASS: "bg-green-500",
  HAS_FAIL: "bg-red-500",
  IN_PROGRESS: "bg-yellow-500",
  NOT_STARTED: "bg-gray-400",
  OVERDUE: "bg-red-500",
};

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export default function InspectCalendar({
  year, month, data, selectedDate, onSelectDate,
  onPrevMonth, onNextMonth, monthLabel, loading,
}: InspectCalendarProps) {
  const { t } = useTranslation();

  const dataMap = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    for (const d of data) map.set(d.date, d);
    return map;
  }, [data]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(firstDay).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [year, month]);

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={onPrevMonth}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-text">
            {year}{t("common.year", "년")} {month}{t("common.month", "월")}
          </h3>
          {monthLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {monthLabel}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onNextMonth}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />{t("equipment.inspectCalendar.legendAllPass")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />{t("equipment.inspectCalendar.legendInProgress")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />{t("equipment.inspectCalendar.legendFail")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" />{t("equipment.inspectCalendar.legendNotStarted")}</span>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS_KO.map((day, i) => (
          <div key={day} className={`text-center text-xs font-medium py-1 ${
            i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-text-muted"
          }`}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {calendarGrid.flat().map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-16" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const summary = dataMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const style = STATUS_STYLES[summary?.status || "NONE"];
            const dot = STATUS_DOT[summary?.status || ""];

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`h-16 rounded-md border p-1 text-left transition-all hover:shadow-sm
                  ${style}
                  ${isSelected ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-900" : ""}
                  ${isToday ? "font-bold" : ""}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-text"
                  } ${isToday ? "bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]" : ""}`}>
                    {day}
                  </span>
                  {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
                </div>
                {summary && summary.total > 0 && (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          summary.fail > 0 ? "bg-red-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.round((summary.completed / summary.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-text-muted mt-0.5">
                      {summary.completed}/{summary.total}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
