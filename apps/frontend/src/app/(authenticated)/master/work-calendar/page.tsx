"use client";

/**
 * @file master/work-calendar/page.tsx
 * @description 생산월력관리 메인 페이지 — 근무 캘린더 CRUD + 교대 패턴 관리
 *
 * 초보자 가이드:
 * 1. 좌측: 연도 필터 + 캘린더 목록 (클릭 선택)
 * 2. 우측 상단: CalendarFormPanel (캘린더 정보 표시/저장/생성/복사/확정)
 * 3. 우측 하단: CalendarGrid (월별 달력 — 날짜 클릭 시 DayEditModal)
 * 4. 교대패턴 탭: ShiftPatternTab (교대 코드/시간/휴게 CRUD)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, RefreshCw, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import api from "@/services/api";
import CalendarGrid from "./components/CalendarGrid";
import DayEditModal from "./components/DayEditModal";
import CalendarFormPanel from "./components/CalendarFormPanel";
import ShiftPatternTab from "./components/ShiftPatternTab";
import AddCalendarModal from "./components/AddCalendarModal";
import type { AddCalendarForm } from "./components/AddCalendarModal";
import type { WorkCalendarDay, ShiftPatternItem } from "./components/CalendarGrid";

interface CalendarItem {
  calendarId: string;
  calendarYear: string;
  processCd: string | null;
  processName: string | null;
  defaultShiftCount: number;
  status: string;
  remark: string | null;
}

interface CalendarDetail {
  calendarId: string;
  calendarYear: string;
  processCd: string | null;
  defaultShiftCount: number;
  defaultShifts: string | null;
  status: string;
  remark: string | null;
}

interface ProcessOption { processCode: string; processName: string }

export default function WorkCalendarPage() {
  const { t } = useTranslation();

  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState(() => String(new Date().getFullYear()));
  const [calendarDetail, setCalendarDetail] = useState<CalendarDetail | null>(null);
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPatternItem[]>([]);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [activeTab, setActiveTab] = useState<"calendar" | "shift">("calendar");
  const [editingDay, setEditingDay] = useState<{ date: string; data: WorkCalendarDay | null } | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  /* ── API 호출 ── */
  const fetchCalendars = useCallback(async () => {
    setLoading(true);
    try { setCalendars((await api.get("/master/work-calendars?limit=1000")).data?.data ?? []); }
    catch { /* interceptor */ } finally { setLoading(false); }
  }, []);

  const fetchShiftPatterns = useCallback(async () => {
    try { setShiftPatterns((await api.get("/master/shift-patterns")).data?.data ?? []); }
    catch { /* interceptor */ }
  }, []);

  const fetchProcesses = useCallback(async () => {
    try { setProcesses((await api.get("/master/processes?limit=1000")).data?.data ?? []); }
    catch { /* interceptor */ }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    try { setCalendarDetail((await api.get(`/master/work-calendars/${id}`)).data?.data ?? null); }
    catch { setCalendarDetail(null); }
  }, []);

  const fetchDays = useCallback(async (id: string, month: string) => {
    try { setDays((await api.get(`/master/work-calendars/${id}/days?month=${month}`)).data?.data ?? []); }
    catch { setDays([]); }
  }, []);

  useEffect(() => { fetchCalendars(); fetchProcesses(); fetchShiftPatterns(); },
    [fetchCalendars, fetchProcesses, fetchShiftPatterns]);

  useEffect(() => {
    if (!selectedId) { setCalendarDetail(null); setDays([]); return; }
    fetchDetail(selectedId); fetchDays(selectedId, currentMonth);
  }, [selectedId, fetchDetail, fetchDays, currentMonth]);

  /* ── 콜백 ── */
  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    if (!selectedId) return;
    try { await api.put(`/master/work-calendars/${selectedId}`, data); await fetchDetail(selectedId); await fetchCalendars(); }
    catch { /* interceptor */ }
  }, [selectedId, fetchDetail, fetchCalendars]);

  const handleGenerate = useCallback(async () => {
    if (!selectedId) return;
    try { await api.post(`/master/work-calendars/${selectedId}/generate`); await fetchDays(selectedId, currentMonth); }
    catch { /* interceptor */ }
  }, [selectedId, currentMonth, fetchDays]);

  const handleCopyFrom = useCallback(async (sourceId: string) => {
    if (!selectedId) return;
    try { await api.post(`/master/work-calendars/${selectedId}/copy-from/${sourceId}`); await fetchDays(selectedId, currentMonth); }
    catch { /* interceptor */ }
  }, [selectedId, currentMonth, fetchDays]);

  const handleConfirm = useCallback(async () => {
    if (!selectedId) return;
    try { await api.post(`/master/work-calendars/${selectedId}/confirm`); await fetchDetail(selectedId); await fetchCalendars(); }
    catch { /* interceptor */ }
  }, [selectedId, fetchDetail, fetchCalendars]);

  const handleUnconfirm = useCallback(async () => {
    if (!selectedId) return;
    try { await api.post(`/master/work-calendars/${selectedId}/unconfirm`); await fetchDetail(selectedId); await fetchCalendars(); }
    catch { /* interceptor */ }
  }, [selectedId, fetchDetail, fetchCalendars]);

  const handleDaySave = useCallback(async (data: Partial<WorkCalendarDay>) => {
    if (!selectedId) return;
    try { await api.put(`/master/work-calendars/${selectedId}/days/bulk`, { days: [data] }); await fetchDays(selectedId, currentMonth); }
    catch { /* interceptor */ }
  }, [selectedId, currentMonth, fetchDays]);

  const handleAddCalendar = useCallback(async (form: AddCalendarForm) => {
    try {
      await api.post("/master/work-calendars", {
        calendarId: form.calendarId, calendarYear: form.calendarYear,
        processCd: form.processCd || null, defaultShiftCount: form.defaultShiftCount,
        defaultShifts: form.defaultShifts || null, remark: form.remark || null,
      });
      setIsAddOpen(false); await fetchCalendars();
    } catch { /* interceptor */ }
  }, [fetchCalendars]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/work-calendars/${deleteTarget}`);
      if (selectedId === deleteTarget) { setSelectedId(""); setCalendarDetail(null); setDays([]); }
      setDeleteTarget(null); await fetchCalendars();
    } catch { /* interceptor */ }
  }, [deleteTarget, selectedId, fetchCalendars]);

  const filtered = yearFilter ? calendars.filter((c) => c.calendarYear === yearFilter) : calendars;

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-gray-100 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-primary" />
            {t("master.workCalendar.title")}
          </h1>
          <p className="text-text-muted dark:text-gray-400 mt-1">{t("master.workCalendar.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { fetchCalendars(); fetchShiftPatterns(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
          {activeTab === "calendar" && (
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />{t("common.add")}
            </Button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 flex-shrink-0">
        {(["calendar", "shift"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors
              ${activeTab === tab
                ? "bg-white dark:bg-slate-800 text-primary border-b-2 border-primary"
                : "text-text-muted dark:text-gray-400 hover:text-text dark:hover:text-gray-200"}`}>
            {tab === "calendar" ? t("master.workCalendar.calendarManagement") : t("master.workCalendar.shiftPatternTab")}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === "calendar" ? (
        <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
          {/* 좌측: 캘린더 목록 */}
          <div className="col-span-4 flex flex-col min-h-0">
            <Card padding="none" className="flex-1 flex flex-col min-h-0">
              <CardContent className="flex-1 flex flex-col min-h-0 p-3">
                <div className="flex gap-2 mb-3 shrink-0">
                  <Input value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
                    placeholder={t("master.workCalendar.calendarYear")} maxLength={4} fullWidth />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                  {loading ? (
                    <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 text-primary animate-spin" /></div>
                  ) : filtered.length === 0 ? (
                    <p className="text-center text-text-muted dark:text-gray-400 text-sm py-8">{t("common.noData")}</p>
                  ) : filtered.map((cal) => (
                    <button key={cal.calendarId} onClick={() => setSelectedId(cal.calendarId)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border
                        ${selectedId === cal.calendarId
                          ? "bg-primary/10 dark:bg-primary/20 border-primary text-primary"
                          : "bg-white dark:bg-slate-800 border-border dark:border-gray-700 hover:border-primary/50"}`}>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {cal.calendarYear}
                        </span>
                        <span className="text-sm font-medium text-text dark:text-gray-200 truncate">{cal.calendarId}</span>
                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                            ${cal.status === "CONFIRMED"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
                            {cal.status}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(cal.calendarId); }}
                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-text-muted dark:text-gray-400 mt-0.5 truncate">
                        {cal.processName ?? t("master.workCalendar.allProcesses")}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 우측: 폼 + 그리드 */}
          <div className="col-span-8 flex flex-col min-h-0 gap-4">
            <div className="shrink-0">
              <CalendarFormPanel calendar={calendarDetail} processes={processes}
                calendars={calendars.map((c) => ({ calendarId: c.calendarId, calendarYear: c.calendarYear }))}
                onSave={handleSave} onGenerate={handleGenerate} onCopyFrom={handleCopyFrom}
                onConfirm={handleConfirm} onUnconfirm={handleUnconfirm} />
            </div>
            {calendarDetail && (
              <Card padding="none" className="flex-1 flex flex-col min-h-0">
                <CardContent className="flex-1 flex flex-col min-h-0 p-4 overflow-y-auto">
                  <CalendarGrid calendarId={selectedId} month={currentMonth} days={days}
                    onDayClick={(date, day) => setEditingDay({ date, data: day })}
                    onMonthChange={setCurrentMonth} isConfirmed={calendarDetail.status === "CONFIRMED"} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ShiftPatternTab shifts={shiftPatterns} onRefresh={fetchShiftPatterns} />
        </div>
      )}

      <DayEditModal isOpen={editingDay !== null} onClose={() => setEditingDay(null)}
        selectedDate={editingDay?.date ?? null} currentData={editingDay?.data ?? null}
        shiftPatterns={shiftPatterns} onSave={handleDaySave} />
      <AddCalendarModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)}
        onSave={handleAddCalendar} processes={processes} />
      <ConfirmModal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} title={t("common.delete")} message={t("master.workCalendar.deleteCalendarMsg")} />
    </div>
  );
}
