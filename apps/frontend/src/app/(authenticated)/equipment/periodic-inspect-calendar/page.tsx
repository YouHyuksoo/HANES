"use client";

/**
 * @file src/app/(authenticated)/equipment/periodic-inspect-calendar/page.tsx
 * @description 설비 정기점검 캘린더 페이지 - 마스터 매핑 기준 월별 스케줄 생성/조회
 *
 * 초보자 가이드:
 * 1. **구조**: 일상점검 캘린더와 동일한 레이아웃 (캘린더 + 상세패널 + 모달)
 * 2. **API**: /equipment/periodic-inspect/calendar, /equipment/periodic-inspect/calendar/day
 * 3. **inspectType**: PERIODIC 고정 (일상점검은 DAILY)
 * 4. **컴포넌트 재사용**: InspectCalendar, DaySchedulePanel, InspectExecuteModal 공유
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays, CheckCircle, XCircle, RefreshCw,
  CalendarPlus, CalendarRange, AlertTriangle,
} from "lucide-react";
import { Button, Select, StatCard } from "@/components/ui";
import InspectCalendar from "../inspect-calendar/components/InspectCalendar";
import type { CalendarDaySummary } from "../inspect-calendar/components/InspectCalendar";
import DaySchedulePanel from "../inspect-calendar/components/DaySchedulePanel";
import type { DayScheduleEquip } from "../inspect-calendar/components/DaySchedulePanel";
import InspectExecuteModal from "../inspect-calendar/components/InspectExecuteModal";
import api from "@/services/api";

interface LineOption { value: string; label: string; }

export default function PeriodicInspectCalendarPage() {
  const { t } = useTranslation();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [lineCode, setLineCode] = useState("");
  const [calendarData, setCalendarData] = useState<CalendarDaySummary[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);
  const [dayData, setDayData] = useState<DayScheduleEquip[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [modalEquip, setModalEquip] = useState<DayScheduleEquip | null>(null);
  const [lineOptions, setLineOptions] = useState<LineOption[]>([
    { value: "", label: t("equipment.inspectCalendar.allLines") },
  ]);

  /** 라인 목록을 생산라인 마스터에서 동적 조회 */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/master/prod-lines", { params: { limit: 200 } });
        const lines = res.data?.data ?? [];
        setLineOptions([
          { value: "", label: t("equipment.inspectCalendar.allLines") },
          ...lines.map((l: { lineCode: string; lineName: string }) => ({
            value: l.lineCode,
            label: `${l.lineCode} ${l.lineName || ""}`.trim(),
          })),
        ]);
      } catch { /* keep default */ }
    })();
  }, [t]);

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    setCalendarLoading(true);
    try {
      const params: Record<string, string | number> = { year: y, month: m };
      if (lineCode) params.lineCode = lineCode;
      const res = await api.get("/equipment/periodic-inspect/calendar", { params });
      setCalendarData(res.data?.data ?? []);
    } catch {
      setCalendarData([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [lineCode]);

  const fetchDaySchedule = useCallback(async (date: string) => {
    setDayLoading(true);
    try {
      const params: Record<string, string> = { date };
      if (lineCode) params.lineCode = lineCode;
      const res = await api.get("/equipment/periodic-inspect/calendar/day", { params });
      setDayData(res.data?.data ?? []);
    } catch {
      setDayData([]);
    } finally {
      setDayLoading(false);
    }
  }, [lineCode]);

  useEffect(() => { fetchCalendar(year, month); }, [year, month, fetchCalendar]);
  useEffect(() => { fetchDaySchedule(selectedDate); }, [selectedDate, fetchDaySchedule]);

  const handleCurrentMonth = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(now.toISOString().split("T")[0]);
  }, []);

  const handleNextMonth = useCallback(() => {
    const now = new Date();
    const nextM = now.getMonth() + 2;
    const y = nextM > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const m = nextM > 12 ? 1 : nextM;
    setYear(y);
    setMonth(m);
    setSelectedDate(`${y}-${String(m).padStart(2, "0")}-01`);
  }, []);

  const handlePrevMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 1) { setYear((y) => y - 1); return 12; }
      return prev - 1;
    });
  }, []);

  const handleNextMonthNav = useCallback(() => {
    setMonth((prev) => {
      if (prev === 12) { setYear((y) => y + 1); return 1; }
      return prev + 1;
    });
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleInspectSaved = useCallback(() => {
    fetchCalendar(year, month);
    fetchDaySchedule(selectedDate);
  }, [fetchCalendar, fetchDaySchedule, year, month, selectedDate]);

  const monthlyStats = useMemo(() => {
    let totalScheduled = 0;
    let totalCompleted = 0;
    let totalFail = 0;
    let overdueCount = 0;
    for (const d of calendarData) {
      totalScheduled += d.total;
      totalCompleted += d.completed;
      totalFail += d.fail;
      if (d.status === "OVERDUE") overdueCount++;
    }
    return { totalScheduled, totalCompleted, totalFail, overdueCount };
  }, [calendarData]);

  const monthLabel = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    if (year === curY && month === curM) return t("equipment.inspectCalendar.currentMonth");
    const nextM = curM + 1 > 12 ? 1 : curM + 1;
    const nextY = curM + 1 > 12 ? curY + 1 : curY;
    if (year === nextY && month === nextM) return t("equipment.inspectCalendar.nextMonth");
    return null;
  }, [year, month, t]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            {t("equipment.periodicInspectCalendar.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.periodicInspectCalendar.description")}</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-28">
            <Select options={lineOptions} value={lineCode} onChange={setLineCode} fullWidth />
          </div>
          <Button size="sm" onClick={handleCurrentMonth}>
            <CalendarPlus className="w-4 h-4 mr-1" />
            {t("equipment.inspectCalendar.generateCurrent")}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleNextMonth}>
            <CalendarRange className="w-4 h-4 mr-1" />
            {t("equipment.inspectCalendar.generateNext")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fetchCalendar(year, month)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label={`${month}${t("equipment.inspectCalendar.monthUnit")} ${t("equipment.inspectCalendar.totalScheduled")}`}
          value={monthlyStats.totalScheduled}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          label={t("equipment.inspectCalendar.completed")}
          value={monthlyStats.totalCompleted}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label={t("equipment.inspectCalendar.failCount")}
          value={monthlyStats.totalFail}
          icon={XCircle}
          color="red"
        />
        <StatCard
          label={t("equipment.inspectCalendar.overdueCount")}
          value={monthlyStats.overdueCount}
          icon={AlertTriangle}
          color="orange"
        />
      </div>

      {/* Calendar + Day Schedule */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7">
          <InspectCalendar
            year={year}
            month={month}
            data={calendarData}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonthNav}
            monthLabel={monthLabel}
            loading={calendarLoading}
          />
        </div>
        <div className="col-span-5">
          <DaySchedulePanel
            date={selectedDate}
            data={dayData}
            loading={dayLoading}
            onExecuteInspect={setModalEquip}
            inspectTitleKey="equipment.periodicInspectCalendar.inspectTitle"
          />
        </div>
      </div>

      {/* Execute Modal */}
      <InspectExecuteModal
        isOpen={!!modalEquip}
        onClose={() => setModalEquip(null)}
        equip={modalEquip}
        date={selectedDate}
        onSaved={handleInspectSaved}
        inspectType="PERIODIC"
        apiBasePath="/equipment/periodic-inspect"
        inspectTitleKey="equipment.periodicInspectCalendar.inspectTitle"
      />
    </div>
  );
}
