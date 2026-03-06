"use client";

/**
 * @file rework-inspect/components/InspectFormModal.tsx
 * @description 재작업 후 검사 등록 모달 - 검사자, 검사방법, 결과(PASS/FAIL/SCRAP), 수량 입력
 *
 * 초보자 가이드:
 * 1. 재검사 대기 행 선택 시 열림  2. 검사자는 WorkerSelect 사용
 * 3. 결과는 PASS/FAIL/SCRAP 라디오  4. POST /quality/rework-inspects 호출
 */
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal } from "@/components/ui";
import { WorkerSelect } from "@/components/shared";
import api from "@/services/api";

export interface InspectTarget {
  id: number;
  reworkNo: string;
  itemCode: string;
  reworkQty: number;
  resultQty: number;
}

interface Props {
  isOpen: boolean;
  target: InspectTarget | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INIT = {
  inspectorCode: "",
  inspectMethod: "",
  inspectResult: "PASS" as "PASS" | "FAIL" | "SCRAP",
  passQty: 0,
  failQty: 0,
  defectDetail: "",
  remarks: "",
};

export default function InspectFormModal({ isOpen, target, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(INIT);
  const [saving, setSaving] = useState(false);

  /* target 변경 시 폼 리셋 */
  useMemo(() => {
    setForm({ ...INIT, passQty: target?.resultQty ?? 0 });
  }, [target]);

  const resultOptions = useMemo(() => [
    { value: "PASS", label: t("quality.rework.statusPASS") },
    { value: "FAIL", label: t("quality.rework.statusFAIL") },
    { value: "SCRAP", label: t("quality.rework.statusSCRAP") },
  ], [t]);

  const handleSubmit = useCallback(async () => {
    if (!target) return;
    setSaving(true);
    try {
      await api.post("/quality/rework-inspects", {
        reworkOrderId: target.id,
        inspectorCode: form.inspectorCode,
        inspectMethod: form.inspectMethod,
        inspectResult: form.inspectResult,
        passQty: Number(form.passQty),
        failQty: Number(form.failQty),
        defectDetail: form.defectDetail,
        remarks: form.remarks,
      });
      onSuccess();
    } catch (e) {
      console.error("Rework inspect save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [target, form, onSuccess]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("quality.rework.inspect")} size="lg">
      {target && (
        <div className="space-y-4">
          {/* 대상 요약 */}
          <div className="p-3 bg-background dark:bg-slate-800 rounded-lg grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-text-muted">{t("quality.rework.reworkNo")}:</span> <span className="font-medium text-text">{target.reworkNo}</span></div>
            <div><span className="text-text-muted">{t("quality.rework.itemCode")}:</span> <span className="font-medium text-text">{target.itemCode}</span></div>
            <div><span className="text-text-muted">{t("quality.rework.reworkQty")}:</span> <span className="font-mono text-text">{target.reworkQty}</span></div>
            <div><span className="text-text-muted">{t("quality.rework.resultQty")}:</span> <span className="font-mono text-text">{target.resultQty}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <WorkerSelect
              label={t("quality.rework.inspectorCode")}
              value={form.inspectorCode}
              onChange={(v) => setForm((p) => ({ ...p, inspectorCode: v }))}
              fullWidth
            />
            <Input
              label={t("quality.rework.inspectMethod")}
              placeholder={t("quality.rework.inspectMethod")}
              value={form.inspectMethod}
              onChange={(e) => setForm((p) => ({ ...p, inspectMethod: e.target.value }))}
              fullWidth
            />
          </div>

          {/* 검사 결과 라디오 */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">{t("quality.rework.inspectResult")}</label>
            <div className="flex gap-3">
              {resultOptions.map((opt) => (
                <label key={opt.value} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${form.inspectResult === opt.value ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary" : "border-border bg-white dark:bg-slate-800 text-text hover:border-primary/50"}`}>
                  <input type="radio" name="inspectResult" value={opt.value} checked={form.inspectResult === opt.value} onChange={(e) => setForm((p) => ({ ...p, inspectResult: e.target.value as "PASS" | "FAIL" | "SCRAP" }))} className="sr-only" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label={t("quality.rework.passQty")} type="number" value={String(form.passQty)} onChange={(e) => setForm((p) => ({ ...p, passQty: Number(e.target.value) }))} fullWidth />
            <Input label={t("quality.rework.failQty")} type="number" value={String(form.failQty)} onChange={(e) => setForm((p) => ({ ...p, failQty: Number(e.target.value) }))} fullWidth />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("quality.rework.defectDetail")}</label>
            <textarea className="w-full rounded-lg border border-border bg-white dark:bg-slate-800 text-text px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.defectDetail} onChange={(e) => setForm((p) => ({ ...p, defectDetail: e.target.value }))} />
          </div>

          <Input label={t("common.remark")} value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} fullWidth />

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
            <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.inspectorCode}>{saving ? t("common.saving") : t("common.register")}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
