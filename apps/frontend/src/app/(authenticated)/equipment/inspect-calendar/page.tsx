"use client";

/**
 * @file src/app/(authenticated)/equipment/inspect-calendar/page.tsx
 * @description 설비 일상점검 캘린더 페이지 - 마스터 매핑 기준 월별 스케줄 생성/조회
 *
 * 초보자 가이드:
 * 1. **당월/차월 생성**: 설비별 점검항목 마스터 매핑(cycle) 기준으로 해당 월 스케줄을 계산
 * 2. **캘린더**: DAILY=매일, WEEKLY=매주 월요일, MONTHLY=매월 1일 자동 표시
 * 3. **날짜 클릭**: 우측 패널에 설비별 점검 목록 + 점검 실행
 * 4. API: GET /equipment/daily-inspect/calendar, GET /equipment/daily-inspect/calendar/day
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays, CheckCircle, XCircle, RefreshCw,
  CalendarPlus, CalendarRange, AlertTriangle,
} from "lucide-react";
import { Button, Select, StatCard } from "@/components/ui";
import InspectCalendar from "./components/InspectCalendar";
import type { CalendarDaySummary } from "./components/InspectCalendar";
import DaySchedulePanel from "./components/DaySchedulePanel";
import type { DayScheduleEquip } from "./components/DaySchedulePanel";
import InspectExecuteModal from "./components/InspectExecuteModal";
import api from "@/services/api";

interface LineOption { value: string; label: string; }

export default function InspectCalendarPage() {
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
      const res = await api.get("/equipment/daily-inspect/calendar", { params });
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
      const res = await api.get("/equipment/daily-inspect/calendar/day", { params });
      setDayData(res.data?.data ?? []);
    } catch {
      setDayData([]);
    } finally {
      setDayLoading(false);
    }
  }, [lineCode]);

  // 월 변경 시 자동 로드
  useEffect(() => { fetchCalendar(year, month); }, [year, month, fetchCalendar]);
  useEffect(() => { fetchDaySchedule(selectedDate); }, [selectedDate, fetchDaySchedule]);

  /** 당월 생성 */
  const handleCurrentMonth = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(now.toISOString().split("T")[0]);
  }, []);

  /** 차월 생성 */
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

  /** 월 전체 통계 */
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

  /** 현재 보고 있는 월이 당월/차월인지 표시 */
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
            {t("equipment.inspectCalendar.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.inspectCalendar.description")}</p>
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
      />
    </div>
  );
}
