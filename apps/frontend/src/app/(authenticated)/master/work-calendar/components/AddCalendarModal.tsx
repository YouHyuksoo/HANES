"use client";

/**
 * @file master/work-calendar/components/AddCalendarModal.tsx
 * @description 캘린더 추가 모달 — 새 근무캘린더 생성 폼
 *
 * 초보자 가이드:
 * 1. 캘린더ID, 연도, 공정, 교대수 등을 입력하여 새 캘린더를 생성
 * 2. 공정 미선택 시 공장 기본 캘린더로 등록
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import { Field, FieldInput } from "./WorkCalendarFieldHelp";

interface ProcessOption {
  processCode: string;
  processName: string;
}

interface AddCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (form: AddCalendarForm) => void;
  processes: ProcessOption[];
}

export interface AddCalendarForm {
  calendarId: string;
  calendarYear: string;
  processCd: string;
  defaultShiftCount: number;
  defaultShifts: string;
  remark: string;
}

const INIT: AddCalendarForm = {
  calendarId: "",
  calendarYear: String(new Date().getFullYear()),
  processCd: "",
  defaultShiftCount: 1,
  defaultShifts: "",
  remark: "",
};

export default function AddCalendarModal({ isOpen, onClose, onSave, processes }: AddCalendarModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AddCalendarForm>(INIT);

  const setF = (key: keyof AddCalendarForm, value: string | number) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    if (!form.calendarId.trim() || !form.calendarYear.trim()) return;
    onSave(form);
    setForm(INIT);
  };

  const handleClose = () => {
    setForm(INIT);
    onClose();
  };

  const selectCls =
    "w-full rounded border border-border dark:border-gray-600 bg-white dark:bg-slate-900 text-text dark:text-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("master.workCalendar.addCalendar")} size="md">
      <div className="flex flex-col gap-3 p-1">
        <FieldInput
          field="calendarId"
          label={t("master.workCalendar.calendarId")}
          value={form.calendarId}
          onChange={(e) => setF("calendarId", e.target.value)}
          required
        />
        <FieldInput
          field="calendarYear"
          label={t("master.workCalendar.calendarYear")}
          value={form.calendarYear}
          onChange={(e) => setF("calendarYear", e.target.value)}
          maxLength={4}
          required
        />
        <Field field="processCd" label={t("master.workCalendar.processCd")}>
          <select value={form.processCd} onChange={(e) => setF("processCd", e.target.value)} className={selectCls}>
            <option value="">{t("master.workCalendar.allProcesses")}</option>
            {processes.map((p) => (
              <option key={p.processCode} value={p.processCode}>
                {p.processCode} - {p.processName}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <FieldInput
            field="defaultShiftCount"
            label={t("master.workCalendar.defaultShiftCount")}
            type="number"
            min={1}
            max={3}
            value={form.defaultShiftCount}
            onChange={(e) => setF("defaultShiftCount", Number(e.target.value))}
          />
          <FieldInput
            field="defaultShifts"
            label={t("master.workCalendar.defaultShifts")}
            value={form.defaultShifts}
            onChange={(e) => setF("defaultShifts", e.target.value)}
          />
        </div>
        <FieldInput
          field="remark"
          label={t("master.workCalendar.remark")}
          value={form.remark}
          onChange={(e) => setF("remark", e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border dark:border-gray-700">
        <Button variant="secondary" onClick={handleClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={handleSave} disabled={!form.calendarId.trim() || !form.calendarYear.trim()}>{t("common.save")}</Button>
      </div>
    </Modal>
  );
}
