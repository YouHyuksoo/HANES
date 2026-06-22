"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Zap } from "lucide-react";
import { Button, Input } from "@/components/ui";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { IntegratedStepState, IntegratedInspectApiResponse } from "../types";

const STEPS: Array<{ inspectType: IntegratedStepState["inspectType"]; labelKey: string }> = [
  { inspectType: "CONTINUITY", labelKey: "inspection.integrated.continuity" },
  { inspectType: "LEAK", labelKey: "inspection.integrated.leak" },
  { inspectType: "HIPOT", labelKey: "inspection.integrated.hipot" },
  { inspectType: "STRUCTURE", labelKey: "inspection.integrated.structure" },
];

interface FgLabelInfo {
  fgBarcode: string;
  itemCode: string;
  itemName?: string;
  orderNo: string | null;
  status: string;
  inspectPassYn: string | null;
  structureYn: string | null;
}

interface Props {
  fgLabel: FgLabelInfo | null;
  onClose: () => void;
  onSave: () => void;
}

export default function IntegratedInspectPanel({ fgLabel, onClose, onSave }: Props) {
  const { t } = useTranslation();

  const [manualOrderNo, setManualOrderNo] = useState("");
  const [manualItemCode, setManualItemCode] = useState("");

  const [steps, setSteps] = useState<IntegratedStepState[]>(() =>
    STEPS.map((s) => ({
      inspectType: s.inspectType,
      labelKey: s.labelKey,
      passYn: null,
      errorCode: "",
      errorDetail: "",
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IntegratedInspectApiResponse | null>(null);

  const updateStep = useCallback(
    (inspectType: string, field: keyof IntegratedStepState, value: unknown) => {
      setSteps((prev) =>
        prev.map((s) => (s.inspectType === inspectType ? { ...s, [field]: value } : s))
      );
      setResult(null);
    },
    []
  );

  const orderNo = fgLabel?.orderNo ?? manualOrderNo;
  const itemCode = fgLabel?.itemCode ?? manualItemCode;
  const allStepsSelected = steps.every((s) => s.passYn !== null);
  const canSubmit = allStepsSelected && orderNo.trim() && itemCode.trim();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        orderNo: orderNo.trim(),
        itemCode: itemCode.trim(),
        steps: steps.map((s) => ({
          inspectType: s.inspectType,
          passYn: s.passYn,
          errorCode: s.passYn === "N" ? (s.errorCode || undefined) : undefined,
          errorDetail: s.passYn === "N" ? (s.errorDetail || undefined) : undefined,
        })),
      };

      const res = await api.post("/quality/continuity-inspect/integrated-inspect", payload);
      const data: IntegratedInspectApiResponse = res.data?.data;
      setResult(data);

      if (data.overallPass) {
        toast.success(
          t("inspection.integrated.submitted", "통합검사가 완료되었습니다.") +
            (data.fgBarcode ? ` FG: ${data.fgBarcode}` : "")
        );
      } else {
        toast.error(t("inspection.integrated.overallFailDesc", "하나 이상의 검사 스텝이 불합격입니다."));
      }

      onSave();
    } catch {
      // Error handled by interceptor
    } finally {
      setSubmitting(false);
    }
  }, [steps, canSubmit, orderNo, itemCode, t, onSave]);

  return (
    <div className="flex-shrink-0 rounded-xl border border-border bg-background shadow-sm animate-fade-in">
      <div className="max-h-[55vh] overflow-y-auto p-4 space-y-4 text-xs">
        {/* Manual entry when no scanned label */}
        {!fgLabel && (
          <div className="bg-surface rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t("production.result.orderNo", "작업지시")}
              value={manualOrderNo}
              onChange={(e) => setManualOrderNo(e.target.value)}
              fullWidth
            />
            <Input
              label={t("master.part.partCode", "품목코드")}
              value={manualItemCode}
              onChange={(e) => setManualItemCode(e.target.value)}
              fullWidth
            />
          </div>
        )}

        {/* 4 Step cards (horizontal) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
          {STEPS.map((stepDef) => {
            const step = steps.find((s) => s.inspectType === stepDef.inspectType)!;
            const isPass = step.passYn === "Y";
            const isFail = step.passYn === "N";
            return (
              <div
                key={stepDef.inspectType}
                className={`rounded-lg border-l-4 p-4 ${
                  isPass
                    ? "border-l-green-500 bg-green-50/30 dark:bg-green-900/10"
                    : isFail
                      ? "border-l-red-500 bg-red-50/30 dark:bg-red-900/10"
                      : "border-l-border bg-surface"
                }`}
              >
                <h3 className="text-sm font-bold text-text mb-3">{t(stepDef.labelKey)}</h3>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => updateStep(stepDef.inspectType, "passYn", "Y")}
                    className={`flex items-center justify-center gap-1 py-3 rounded-lg border-2 font-bold text-sm transition-all whitespace-nowrap ${
                      isPass
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "border-border bg-surface text-text-muted hover:border-green-300"
                    }`}
                  >
                    <CheckCircle className="w-5 h-5" />
                    {t("quality.inspect.pass")}
                  </button>
                  <button
                    onClick={() => updateStep(stepDef.inspectType, "passYn", "N")}
                    className={`flex items-center justify-center gap-1 py-3 rounded-lg border-2 font-bold text-sm transition-all whitespace-nowrap ${
                      isFail
                        ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "border-border bg-surface text-text-muted hover:border-red-300"
                    }`}
                  >
                    <XCircle className="w-5 h-5" />
                    {t("quality.inspect.fail")}
                  </button>
                </div>

                {isFail && (
                  <div className="space-y-2">
                    <Input
                      placeholder={t("quality.inspect.defectCode", "불량코드")}
                      value={step.errorCode}
                      onChange={(e) => updateStep(stepDef.inspectType, "errorCode", e.target.value)}
                      fullWidth
                    />
                    <Input
                      placeholder={t("quality.inspect.detailReason", "상세사유")}
                      value={step.errorDetail}
                      onChange={(e) => updateStep(stepDef.inspectType, "errorDetail", e.target.value)}
                      fullWidth
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit row */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all whitespace-nowrap ${
                canSubmit
                  ? "bg-primary hover:bg-primary-dark text-white"
                  : "bg-surface text-text-muted cursor-not-allowed opacity-60"
              }`}
            >
              {submitting
                ? t("common.saving")
                : t("inspection.integrated.submit", "통합검사 제출")}
            </button>
            <Button variant="secondary" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>

          {!allStepsSelected && (
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
              {t("inspection.integrated.allRequired", "모든 검사 스텝의 판정을 선택하세요")}
            </p>
          )}
          {allStepsSelected && !canSubmit && (
            <p className="text-xs text-orange-600 dark:text-orange-400 text-center">
              {t("inspection.integrated.manualRequired", "작업지시와 품목코드를 입력하세요")}
            </p>
          )}
        </div>

        {/* Result banner */}
        {result && (
          <div
            className={`rounded-lg border p-4 ${
              result.overallPass
                ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
                : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {result.overallPass ? (
                <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
              )}
              <span
                className={`text-sm font-bold ${
                  result.overallPass
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {result.overallPass
                  ? t("inspection.integrated.overallPassDesc", "모든 검사 스텝이 합격했습니다.")
                  : t("inspection.integrated.overallFailDesc", "하나 이상의 검사 스텝이 불합격입니다.")}
              </span>
            </div>
            {result.overallPass && result.fgBarcode && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {t("inspection.result.fgBarcode", "FG 바코드")}:
                </span>
                <span className="font-mono text-base font-bold text-green-800 dark:text-green-200">
                  {result.fgBarcode}
                </span>
              </div>
            )}
            {!result.overallPass && (
              <div className="mt-2 space-y-1">
                {result.stepResults
                  .filter((sr) => sr.passYn === "N")
                  .map((sr) => (
                    <div key={sr.inspectType} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{t(`inspection.integrated.${sr.inspectType.toLowerCase()}`, sr.inspectType)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
