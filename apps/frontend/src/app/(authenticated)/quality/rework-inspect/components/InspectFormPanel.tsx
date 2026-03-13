"use client";

/**
 * @file rework-inspect/components/InspectFormPanel.tsx
 * @description 재작업 후 검사 등록 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. 재검사 대기 행 선택 시 우측에서 슬라이드 인
 * 2. 검사자(WorkerSelect), 검사방법, 결과(PASS/FAIL/SCRAP), 수량 입력
 * 3. API: POST /quality/rework-inspects
 */
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/components/ui";
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
  target: InspectTarget;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
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

export default function InspectFormPanel({ target, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ ...INIT, passQty: target.resultQty });
  const [saving, setSaving] = useState(false);

  const resultOptions = useMemo(() => [
    { value: "PASS", label: t("quality.rework.statusPASS"), color: "text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30" },
    { value: "FAIL", label: t("quality.rework.statusFAIL"), color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30" },
    { value: "SCRAP", label: t("quality.rework.statusSCRAP"), color: "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30" },
  ], [t]);

  const handleSubmit = useCallback(async () => {
    if (!form.inspectorCode) return;
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
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [target, form, onSave, onClose]);

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{t("quality.rework.inspect")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.inspectorCode}>
            {saving ? t("common.saving") : t("common.register")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 대상 요약 */}
        <div className="p-3 bg-surface dark:bg-slate-800 rounded-lg grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-text-muted">{t("quality.rework.reworkNo")}:</span> <span className="font-medium text-text">{target.reworkNo}</span></div>
          <div><span className="text-text-muted">{t("quality.rework.itemCode")}:</span> <span className="font-medium text-text">{target.itemCode}</span></div>
          <div><span className="text-text-muted">{t("quality.rework.reworkQty")}:</span> <span className="font-mono text-text">{target.reworkQty}</span></div>
          <div><span className="text-text-muted">{t("quality.rework.resultQty")}:</span> <span className="font-mono text-text">{target.resultQty}</span></div>
        </div>

        {/* 검사자/방법 */}
        <WorkerSelect label={t("quality.rework.inspectorCode")} value={form.inspectorCode}
          onChange={v => setForm(p => ({ ...p, inspectorCode: v }))} fullWidth />
        <Input label={t("quality.rework.inspectMethod")} value={form.inspectMethod}
          onChange={e => setForm(p => ({ ...p, inspectMethod: e.target.value }))} fullWidth />

        {/* 검사 결과 */}
        <div>
          <label className="block text-xs font-medium text-text mb-2">{t("quality.rework.inspectResult")}</label>
          <div className="flex gap-2">
            {resultOptions.map(opt => (
              <label key={opt.value}
                className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium
                  ${form.inspectResult === opt.value ? `${opt.color} ring-1 ring-primary/30` : "border-border bg-white dark:bg-slate-800 text-text hover:border-primary/50"}`}>
                <input type="radio" name="inspectResult" value={opt.value}
                  checked={form.inspectResult === opt.value}
                  onChange={e => setForm(p => ({ ...p, inspectResult: e.target.value as "PASS" | "FAIL" | "SCRAP" }))}
                  className="sr-only" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 수량 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.rework.passQty")} type="number" value={String(form.passQty)}
            onChange={e => setForm(p => ({ ...p, passQty: Number(e.target.value) }))} fullWidth />
          <Input label={t("quality.rework.failQty")} type="number" value={String(form.failQty)}
            onChange={e => setForm(p => ({ ...p, failQty: Number(e.target.value) }))} fullWidth />
        </div>

        {/* 불량상세 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">{t("quality.rework.defectDetail")}</label>
          <textarea className="w-full rounded-md border border-border bg-white dark:bg-slate-900 text-text px-3 py-2 text-xs min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={form.defectDetail} onChange={e => setForm(p => ({ ...p, defectDetail: e.target.value }))} />
        </div>

        <Input label={t("common.remark")} value={form.remarks}
          onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} fullWidth />
      </div>

    </div>
  );
}
