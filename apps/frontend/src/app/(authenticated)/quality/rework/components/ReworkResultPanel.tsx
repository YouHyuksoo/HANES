"use client";

/**
 * @file quality/rework/components/ReworkResultPanel.tsx
 * @description 재작업 공정별 실적 입력 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. 공정 서브그리드에서 실적입력 버튼 클릭 시 우측에서 슬라이드 인
 * 2. 작업자, 수량, 작업내역(IATF 필수) 등 입력
 * 3. API: POST /quality/reworks/results
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/components/ui";
import { WorkerSelect } from "@/components/shared";
import api from "@/services/api";

export interface ResultTarget {
  reworkOrderId: string;
  processCode: string;
  processName: string;
  seq: number;
  planQty: number;
  reworkNo: string;
}

interface Props {
  target: ResultTarget;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

interface ResultForm {
  workerId: string;
  resultQty: string;
  goodQty: string;
  defectQty: string;
  workDetail: string;
  workTimeMin: string;
  remark: string;
}

const INIT: ResultForm = {
  workerId: "",
  resultQty: "",
  goodQty: "",
  defectQty: "",
  workDetail: "",
  workTimeMin: "",
  remark: "",
};

export default function ReworkResultPanel({ target, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ResultForm>({ ...INIT, resultQty: String(target.planQty) });
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof ResultForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const canSubmit = !!form.workerId && !!form.resultQty && !!form.workDetail;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.post("/quality/reworks/results", {
        reworkOrderId: target.reworkOrderId,
        processCode: target.processCode,
        workerId: form.workerId,
        resultQty: Number(form.resultQty) || 0,
        goodQty: Number(form.goodQty) || 0,
        defectQty: Number(form.defectQty) || 0,
        workDetail: form.workDetail,
        workTimeMin: Number(form.workTimeMin) || 0,
        remark: form.remark || undefined,
      });
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [target, form, canSubmit, onSave, onClose]);

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{t("quality.rework.resultEntry")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? t("common.saving") : t("common.register")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 대상 요약 */}
        <div className="p-3 bg-surface dark:bg-slate-800 rounded-lg grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-text-muted">{t("quality.rework.reworkNo")}:</span>{" "}
            <span className="font-medium text-text">{target.reworkNo}</span>
          </div>
          <div>
            <span className="text-text-muted">{t("quality.rework.processCode")}:</span>{" "}
            <span className="font-medium text-text">{target.processCode}</span>
          </div>
          <div>
            <span className="text-text-muted">{t("quality.rework.processName")}:</span>{" "}
            <span className="font-medium text-text">{target.processName}</span>
          </div>
          <div>
            <span className="text-text-muted">{t("quality.rework.reworkQty")}:</span>{" "}
            <span className="font-mono text-text">{target.planQty}</span>
          </div>
        </div>

        {/* 작업자 */}
        <WorkerSelect
          label={t("quality.rework.worker")}
          value={form.workerId}
          onChange={v => setField("workerId", v)}
          fullWidth
        />

        {/* 수량 3열 */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={t("quality.rework.resultQty")}
            type="number"
            value={form.resultQty}
            onChange={e => setField("resultQty", e.target.value)}
            fullWidth
          />
          <Input
            label={t("quality.rework.goodQty")}
            type="number"
            value={form.goodQty}
            onChange={e => setField("goodQty", e.target.value)}
            fullWidth
          />
          <Input
            label={t("quality.rework.defectQtyShort")}
            type="number"
            value={form.defectQty}
            onChange={e => setField("defectQty", e.target.value)}
            fullWidth
          />
        </div>

        {/* 작업내역 (IATF 필수) */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.rework.workDetail")} <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.workDetail}
            onChange={e => setField("workDetail", e.target.value)}
          />
        </div>

        {/* 작업시간 */}
        <Input
          label={t("quality.rework.workTimeMin")}
          type="number"
          value={form.workTimeMin}
          onChange={e => setField("workTimeMin", e.target.value)}
          fullWidth
        />

        {/* 비고 */}
        <Input
          label={t("common.remark")}
          value={form.remark}
          onChange={e => setField("remark", e.target.value)}
          fullWidth
        />
      </div>

    </div>
  );
}
