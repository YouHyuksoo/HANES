"use client";

/**
 * @file master/work-calendar/components/DayEditModal.tsx
 * @description 근무일 편집 모달 — 일별 근무유형/교대/잔업 등 설정
 *
 * 초보자 가이드:
 * 1. 선택한 날짜의 근무 정보를 편집하는 모달
 * 2. dayType에 따라 OFF_REASON 필드가 조건부 노출
 * 3. SHIFTS는 교대 패턴 목록에서 다중 선택(CSV)
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import { Button, Input } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import type { WorkCalendarDay, ShiftPatternItem } from "./CalendarGrid";

interface DayEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  currentData: WorkCalendarDay | null;
  shiftPatterns: ShiftPatternItem[];
  onSave: (data: Partial<WorkCalendarDay>) => void;
}

export default function DayEditModal({
  isOpen,
  onClose,
  selectedDate,
  currentData,
  shiftPatterns,
  onSave,
}: DayEditModalProps) {
  const { t } = useTranslation();
  const dayTypeOptions = useComCodeOptions("WORK_DAY_TYPE");
  const offReasonOptions = useComCodeOptions("DAY_OFF_TYPE");

  const [dayType, setDayType] = useState("WORK");
  const [offReason, setOffReason] = useState("");
  const [shiftCount, setShiftCount] = useState(1);
  const [shifts, setShifts] = useState<string[]>([]);
  const [otMinutes, setOtMinutes] = useState(0);
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (currentData) {
      setDayType(currentData.dayType);
      setOffReason(currentData.offReason ?? "");
      setShiftCount(currentData.shiftCount);
      setShifts(currentData.shifts ? currentData.shifts.split(",") : []);
      setOtMinutes(currentData.otMinutes);
      setRemark(currentData.remark ?? "");
    } else {
      setDayType("WORK");
      setOffReason("");
      setShiftCount(1);
      setShifts([]);
      setOtMinutes(0);
      setRemark("");
    }
  }, [isOpen, currentData]);

  const toggleShift = (code: string) => {
    setShifts((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const handleSave = () => {
    onSave({
      workDate: selectedDate ?? "",
      dayType,
      offReason: dayType === "OFF" ? offReason : null,
      shiftCount,
      shifts: shifts.length > 0 ? shifts.join(",") : null,
      otMinutes,
      remark: remark || null,
    });
    onClose();
  };

  const selectCls =
    "w-full rounded border border-border dark:border-gray-600 bg-white dark:bg-slate-900 text-text dark:text-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t("master.workCalendar.editDay")} — ${selectedDate ?? ""}`} size="md">
      <div className="flex flex-col gap-4 p-1">
        {/* 근무유형 */}
        <div>
          <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
            {t("master.workCalendar.dayType")}
          </label>
          <select value={dayType} onChange={(e) => setDayType(e.target.value)} className={selectCls}>
            {dayTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 휴무사유 (OFF일 때만) */}
        {dayType === "OFF" && (
          <div>
            <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
              {t("master.workCalendar.offReason")}
            </label>
            <select value={offReason} onChange={(e) => setOffReason(e.target.value)} className={selectCls}>
              <option value="">-- {t("common.select")} --</option>
              {offReasonOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* 교대수 */}
        <div>
          <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
            {t("master.workCalendar.shiftCount")}
          </label>
          <Input type="number" min={1} max={3} value={shiftCount} onChange={(e) => setShiftCount(Number(e.target.value))} fullWidth />
        </div>

        {/* 교대 선택 */}
        <div>
          <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
            {t("master.workCalendar.shifts")}
          </label>
          <div className="flex flex-wrap gap-2">
            {shiftPatterns.filter((s) => s.useYn === "Y").map((sp) => (
              <button
                key={sp.shiftCode}
                type="button"
                onClick={() => toggleShift(sp.shiftCode)}
                className={`px-3 py-1 text-xs rounded border transition-colors
                  ${shifts.includes(sp.shiftCode)
                    ? "bg-primary text-white border-primary"
                    : "bg-white dark:bg-slate-800 text-text dark:text-gray-300 border-border dark:border-gray-600 hover:border-primary"}`}
              >
                {sp.shiftName} ({sp.startTime}~{sp.endTime})
              </button>
            ))}
          </div>
        </div>

        {/* 잔업시간 */}
        <div>
          <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
            {t("master.workCalendar.otMinutes")}
          </label>
          <Input type="number" min={0} value={otMinutes} onChange={(e) => setOtMinutes(Number(e.target.value))} fullWidth />
        </div>

        {/* 비고 */}
        <div>
          <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">
            {t("master.workCalendar.remark")}
          </label>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} fullWidth />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border dark:border-gray-700">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={handleSave}>{t("common.save")}</Button>
      </div>
    </Modal>
  );
}
