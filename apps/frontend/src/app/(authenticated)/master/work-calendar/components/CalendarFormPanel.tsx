"use client";

/**
 * @file master/work-calendar/components/CalendarFormPanel.tsx
 * @description 근무캘린더 헤더 폼 — 캘린더 정보 표시/저장/연간생성/복사/확정
 *
 * 초보자 가이드:
 * 1. 선택된 캘린더의 기본 정보(연도, 공정, 교대수 등)를 표시/편집
 * 2. CONFIRMED 상태면 편집/생성/복사 비활성
 * 3. ConfirmModal로 위험 동작(생성/확정/해제) 확인
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, CalendarPlus, Copy, Lock, Unlock } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";

interface CalendarInfo {
  calendarId: string;
  calendarYear: string;
  processCd: string | null;
  defaultShiftCount: number;
  defaultShifts: string | null;
  status: string;
  remark: string | null;
}

interface CalendarFormPanelProps {
  calendar: CalendarInfo | null;
  processes: Array<{ processCode: string; processName: string }>;
  calendars: Array<{ calendarId: string; calendarYear: string }>;
  onSave: (data: Record<string, unknown>) => void;
  onGenerate: () => void;
  onCopyFrom: (sourceId: string) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
}

export default function CalendarFormPanel({
  calendar,
  processes,
  calendars,
  onSave,
  onGenerate,
  onCopyFrom,
  onConfirm,
  onUnconfirm,
}: CalendarFormPanelProps) {
  const { t } = useTranslation();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [copySource, setCopySource] = useState("");

  if (!calendar) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-text-muted dark:text-gray-400 text-center py-4">
            {t("master.workCalendar.selectCalendar")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isConfirmed = calendar.status === "CONFIRMED";
  const statusColor = isConfirmed
    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";

  const handleConfirmAction = () => {
    if (confirmAction === "generate") onGenerate();
    else if (confirmAction === "confirm") onConfirm();
    else if (confirmAction === "unconfirm") onUnconfirm();
    else if (confirmAction === "copy" && copySource) onCopyFrom(copySource);
    setConfirmAction(null);
  };

  const processOptions = processes.map((p) => ({
    value: p.processCode,
    label: `${p.processCode} - ${p.processName}`,
  }));

  return (
    <>
      <Card>
        <CardContent>
          <div className="grid grid-cols-12 gap-4 items-end">
            {/* 캘린더 ID */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
                {t("master.workCalendar.calendarId")}
              </label>
              <Input value={calendar.calendarId} disabled fullWidth />
            </div>

            {/* 연도 */}
            <div className="col-span-1">
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
                {t("master.workCalendar.year")}
              </label>
              <Input value={calendar.calendarYear} disabled fullWidth />
            </div>

            {/* 공정 */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
                {t("master.workCalendar.process")}
              </label>
              <Select
                options={[{ value: "", label: `-- ${t("common.all")} --` }, ...processOptions]}
                value={calendar.processCd ?? ""}
                onChange={() => {}}
                disabled={isConfirmed}
                fullWidth
              />
            </div>

            {/* 기본교대수 */}
            <div className="col-span-1">
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
                {t("master.workCalendar.shiftCount")}
              </label>
              <Input type="number" value={calendar.defaultShiftCount} disabled={isConfirmed} fullWidth />
            </div>

            {/* 상태 */}
            <div className="col-span-1">
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
                {t("master.workCalendar.status")}
              </label>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${statusColor}`}>
                {calendar.status}
              </span>
            </div>

            {/* 액션 버튼 */}
            <div className="col-span-5 flex items-center gap-2 justify-end flex-wrap">
              <Button size="sm" disabled={isConfirmed} onClick={() => onSave({})}>
                <Save className="w-3.5 h-3.5 mr-1" />{t("common.save")}
              </Button>
              <Button size="sm" variant="secondary" disabled={isConfirmed} onClick={() => setConfirmAction("generate")}>
                <CalendarPlus className="w-3.5 h-3.5 mr-1" />{t("master.workCalendar.generateYear")}
              </Button>
              <Button size="sm" variant="secondary" disabled={isConfirmed} onClick={() => setConfirmAction("copy")}>
                <Copy className="w-3.5 h-3.5 mr-1" />{t("master.workCalendar.copyFrom")}
              </Button>
              {isConfirmed ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmAction("unconfirm")}>
                  <Unlock className="w-3.5 h-3.5 mr-1" />{t("master.workCalendar.unconfirm")}
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => setConfirmAction("confirm")}>
                  <Lock className="w-3.5 h-3.5 mr-1" />{t("master.workCalendar.confirm")}
                </Button>
              )}
            </div>
          </div>

          {/* Copy source selector (inline) */}
          {confirmAction === "copy" && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-surface dark:bg-slate-800 rounded">
              <label className="text-xs text-text-muted dark:text-gray-400 whitespace-nowrap">
                {t("master.workCalendar.sourceCalendar")}:
              </label>
              <select
                value={copySource}
                onChange={(e) => setCopySource(e.target.value)}
                className="flex-1 rounded border border-border dark:border-gray-600 bg-white dark:bg-slate-900 text-text dark:text-gray-200 px-2 py-1 text-sm"
              >
                <option value="">-- {t("common.select")} --</option>
                {calendars.filter((c) => c.calendarId !== calendar.calendarId).map((c) => (
                  <option key={c.calendarId} value={c.calendarId}>{c.calendarId} ({c.calendarYear})</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={t("common.confirm")}
        message={t(`master.workCalendar.confirmMsg.${confirmAction ?? "generate"}`)}
      />
    </>
  );
}
