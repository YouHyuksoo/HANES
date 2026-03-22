"use client";

/**
 * @file master/work-calendar/components/ShiftPatternTab.tsx
 * @description 교대 패턴 CRUD 탭 — 교대코드/시간/휴게/근무분 관리
 *
 * 초보자 가이드:
 * 1. 교대 패턴 목록을 테이블로 표시 (코드, 이름, 시작~종료, 휴게, 근무분)
 * 2. 추가/수정은 Modal, 삭제는 ConfirmModal 사용
 * 3. API: /master/shift-patterns (GET/POST/PUT/DELETE)
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, ConfirmModal } from "@/components/ui";
import api from "@/services/api";
import type { ShiftPatternItem } from "./CalendarGrid";

interface ShiftPatternTabProps {
  shifts: ShiftPatternItem[];
  onRefresh: () => void;
}

interface ShiftForm {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workMinutes: number;
  sortOrder: number;
  useYn: string;
}

const INIT_FORM: ShiftForm = {
  shiftCode: "", shiftName: "", startTime: "08:00", endTime: "17:00",
  breakMinutes: 60, workMinutes: 480, sortOrder: 1, useYn: "Y",
};

export default function ShiftPatternTab({ shifts, onRefresh }: ShiftPatternTabProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<ShiftForm>(INIT_FORM);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);

  const setF = (key: keyof ShiftForm, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openAdd = () => {
    setForm({ ...INIT_FORM, sortOrder: shifts.length + 1 });
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (s: ShiftPatternItem) => {
    setForm({
      shiftCode: s.shiftCode, shiftName: s.shiftName,
      startTime: s.startTime, endTime: s.endTime,
      breakMinutes: s.breakMinutes, workMinutes: s.workMinutes,
      sortOrder: s.sortOrder, useYn: s.useYn,
    });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSave = useCallback(async () => {
    try {
      if (isEdit) {
        await api.put(`/master/shift-patterns/${form.shiftCode}`, form);
      } else {
        await api.post("/master/shift-patterns", form);
      }
      setModalOpen(false);
      onRefresh();
    } catch { /* api interceptor handles */ }
  }, [form, isEdit, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!deleteCode) return;
    try {
      await api.delete(`/master/shift-patterns/${deleteCode}`);
      setDeleteCode(null);
      onRefresh();
    } catch { /* api interceptor handles */ }
  }, [deleteCode, onRefresh]);

  const inputCls =
    "w-full rounded border border-border dark:border-gray-600 bg-white dark:bg-slate-900 text-text dark:text-gray-200 px-2 py-1.5 text-sm";

  return (
    <>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-text dark:text-gray-100">
              {t("master.workCalendar.shiftPatterns")}
            </h3>
            <Button size="sm" variant="secondary" onClick={openAdd}>
              <Plus className="w-3.5 h-3.5 mr-1" />{t("common.add")}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-border dark:border-gray-700 bg-surface dark:bg-slate-800">
                  {[t("master.workCalendar.shiftCode"), t("master.workCalendar.shiftName"),
                    t("master.workCalendar.startTime"), t("master.workCalendar.endTime"),
                    t("master.workCalendar.breakMin"), t("master.workCalendar.workMin"),
                    t("common.actions"),
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-text-muted dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.shiftCode} className="border-b border-border/50 dark:border-gray-700 hover:bg-surface-hover dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 font-mono text-text dark:text-gray-200">{s.shiftCode}</td>
                    <td className="px-3 py-2 text-text dark:text-gray-200">{s.shiftName}</td>
                    <td className="px-3 py-2 text-text-muted dark:text-gray-400">{s.startTime}</td>
                    <td className="px-3 py-2 text-text-muted dark:text-gray-400">{s.endTime}</td>
                    <td className="px-3 py-2 text-center text-text-muted dark:text-gray-400">{s.breakMinutes}</td>
                    <td className="px-3 py-2 text-center text-text dark:text-gray-200">{s.workMinutes}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)} className="h-6 px-1.5">
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteCode(s.shiftCode)} className="h-6 px-1.5 text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-text-muted dark:text-gray-400 py-6">{t("common.noData")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 추가/수정 모달 */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} size="md"
        title={isEdit ? t("master.workCalendar.editShift") : t("master.workCalendar.addShift")}>
        <div className="flex flex-col gap-3 p-1">
          <div>
            <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">{t("master.workCalendar.shiftCode")}</label>
            <Input value={form.shiftCode} onChange={(e) => setF("shiftCode", e.target.value)} disabled={isEdit} fullWidth />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">{t("master.workCalendar.shiftName")}</label>
            <Input value={form.shiftName} onChange={(e) => setF("shiftName", e.target.value)} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">{t("master.workCalendar.startTime")}</label>
              <input type="time" value={form.startTime} onChange={(e) => setF("startTime", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">{t("master.workCalendar.endTime")}</label>
              <input type="time" value={form.endTime} onChange={(e) => setF("endTime", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">{t("master.workCalendar.breakMin")}</label>
              <Input type="number" min={0} value={form.breakMinutes} onChange={(e) => setF("breakMinutes", Number(e.target.value))} fullWidth />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted dark:text-gray-400 mb-1">{t("master.workCalendar.workMin")}</label>
              <Input type="number" min={0} value={form.workMinutes} onChange={(e) => setF("workMinutes", Number(e.target.value))} fullWidth />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border dark:border-gray-700">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSave}><Save className="w-3.5 h-3.5 mr-1" />{t("common.save")}</Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteCode !== null}
        onClose={() => setDeleteCode(null)}
        onConfirm={handleDelete}
        title={t("common.delete")}
        message={t("master.workCalendar.deleteShiftMsg")}
      />
    </>
  );
}
