"use client";

/**
 * @file src/app/(authenticated)/equipment/pm-calendar/page.tsx
 * @description PM 캘린더 페이지 - Work Order 기반 예방보전 일정 관리
 *
 * 초보자 가이드:
 * 1. **캘린더**: WO의 scheduledDate 기준 월별 현황 표시
 * 2. **날짜 클릭**: 우측 패널에 해당일 WO 목록 (설비명 + plan items)
 * 3. **WO 일괄생성**: 당월 PM 계획의 nextDueAt 기준 WO 자동 발행
 * 4. **WO 실행**: 항목별 PASS/FAIL 입력 → 완료
 * 5. API: GET /equipment/pm-work-orders/calendar, POST /pm-work-orders/generate
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays, CheckCircle, XCircle, RefreshCw,
  AlertTriangle, Clock, Play, Wrench,
} from "lucide-react";
import { Button, StatCard } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import InspectCalendar from "../inspect-calendar/components/InspectCalendar";
import type { CalendarDaySummary } from "../inspect-calendar/components/InspectCalendar";
import PmWorkOrderPanel from "./components/PmWorkOrderPanel";
import type { WoScheduleItem } from "./components/PmWorkOrderPanel";
import PmExecuteModal from "./components/PmExecuteModal";
import api from "@/services/api";

export default function PmCalendarPage() {
  const { t } = useTranslation();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [lineCode, setLineCode] = useState("");
  const [equipType, setEquipType] = useState("");
  const [calendarData, setCalendarData] = useState<CalendarDaySummary[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);
  const [dayData, setDayData] = useState<WoScheduleItem[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executeTarget, setExecuteTarget] = useState<WoScheduleItem | null>(null);
  const [executeMode, setExecuteMode] = useState<"execute" | "view">("execute");

  const fetchCalendar = useCallback(async (y: number, m: number) => {
    setCalendarLoading(true);
    try {
      const params: Record<string, string | number> = { year: y, month: m };
      if (lineCode) params.lineCode = lineCode;
      if (equipType) params.equipType = equipType;
      const res = await api.get("/equipment/pm-work-orders/calendar", { params });
      setCalendarData(res.data?.data ?? []);
    } catch {
      setCalendarData([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [lineCode, equipType]);

  const fetchDaySchedule = useCallback(async (date: string) => {
    setDayLoading(true);
    try {
      const params: Record<string, string> = { date };
      if (lineCode) params.lineCode = lineCode;
      if (equipType) params.equipType = equipType;
      const res = await api.get("/equipment/pm-work-orders/calendar/day", { params });
      setDayData(res.data?.data ?? []);
    } catch {
      setDayData([]);
    } finally {
      setDayLoading(false);
    }
  }, [lineCode, equipType]);

  useEffect(() => { fetchCalendar(year, month); }, [year, month, fetchCalendar]);
  useEffect(() => { fetchDaySchedule(selectedDate); }, [selectedDate, fetchDaySchedule]);

  const handlePrevMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 1) { setYear((y) => y - 1); return 12; }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 12) { setYear((y) => y + 1); return 1; }
      return prev + 1;
    });
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleGenerateWo = useCallback(async () => {
    setGenerating(true);
    try {
      await api.post("/equipment/pm-work-orders/generate", { year, month });
      fetchCalendar(year, month);
      fetchDaySchedule(selectedDate);
    } catch (e) {
      console.error("Generate WO failed:", e);
    } finally {
      setGenerating(false);
    }
  }, [year, month, selectedDate, fetchCalendar, fetchDaySchedule]);

  const handleExecute = useCallback((wo: WoScheduleItem) => {
    setExecuteTarget(wo);
    setExecuteMode("execute");
    setExecuteModalOpen(true);
  }, []);

  const handleView = useCallback((wo: WoScheduleItem) => {
    setExecuteTarget(wo);
    setExecuteMode("view");
    setExecuteModalOpen(true);
  }, []);

  const handleExecuteSaved = useCallback(() => {
    fetchCalendar(year, month);
    fetchDaySchedule(selectedDate);
  }, [year, month, selectedDate, fetchCalendar, fetchDaySchedule]);

  const monthlyStats = useMemo(() => {
    let planned = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    for (const d of calendarData) {
      planned += d.total - d.completed;
      completed += d.completed;
      if (d.status === "OVERDUE") overdue += d.total;
    }
    return { planned, inProgress, completed, overdue };
  }, [calendarData]);

  const monthLabel = useMemo(() => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      return t("equipment.inspectCalendar.currentMonth");
    }
    return null;
  }, [year, month, t]);

  const handleReset = useCallback(() => {
    setLineCode("");
    setEquipType("");
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" />
            {t("equipment.pmCalendar.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.pmCalendar.woDescription")}</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-28">
            <ComCodeSelect
              groupCode="EQUIP_TYPE"
              value={equipType}
              onChange={setEquipType}
              fullWidth
            />
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleGenerateWo}
            disabled={generating}
          >
            <Play className="w-4 h-4 mr-1" />
            {generating ? t("common.loading") : t("equipment.pmCalendar.generateWo")}
          </Button>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label={t("equipment.pmCalendar.woPlanned")}
          value={monthlyStats.planned}
          icon={Clock}
          color="blue"
        />
        <StatCard
          label={t("equipment.pmCalendar.woInProgress")}
          value={monthlyStats.inProgress}
          icon={Wrench}
          color="yellow"
        />
        <StatCard
          label={t("equipment.pmCalendar.woCompleted")}
          value={monthlyStats.completed}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label={t("equipment.pmCalendar.woOverdue")}
          value={monthlyStats.overdue}
          icon={AlertTriangle}
          color="red"
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
            onNextMonth={handleNextMonth}
            monthLabel={monthLabel}
            loading={calendarLoading}
          />
        </div>
        <div className="col-span-5">
          <PmWorkOrderPanel
            date={selectedDate}
            data={dayData}
            loading={dayLoading}
            onExecute={handleExecute}
            onView={handleView}
          />
        </div>
      </div>

      {/* Execute Modal */}
      <PmExecuteModal
        isOpen={executeModalOpen}
        onClose={() => { setExecuteModalOpen(false); setExecuteTarget(null); setExecuteMode("execute"); }}
        workOrder={executeTarget}
        onSaved={handleExecuteSaved}
        mode={executeMode}
      />
    </div>
  );
}
