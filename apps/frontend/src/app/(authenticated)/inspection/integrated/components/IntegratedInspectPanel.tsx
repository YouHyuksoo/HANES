"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Zap, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { IntegratedStepState, IntegratedInspectApiResponse, IntegratedJobOrderRow } from "../types";

const STEPS: Array<{ inspectType: IntegratedStepState["inspectType"]; labelKey: string; color: string }> = [
  { inspectType: "CONTINUITY", labelKey: "inspection.integrated.continuity", color: "border-l-blue-500" },
  { inspectType: "LEAK", labelKey: "inspection.integrated.leak", color: "border-l-cyan-500" },
  { inspectType: "HIPOT", labelKey: "inspection.integrated.hipot", color: "border-l-purple-500" },
  { inspectType: "STRUCTURE", labelKey: "inspection.integrated.structure", color: "border-l-amber-500" },
];

interface Props {
  order: IntegratedJobOrderRow;
  equipCode?: string;
}

interface FgLabelRow {
  fgBarcode: string;
  issuedAt: string;
  inspectPassYn: string | null;
}

export default function IntegratedInspectPanel({ order, equipCode }: Props) {
  const { t } = useTranslation();

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
  const [labels, setLabels] = useState<FgLabelRow[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  const updateStep = useCallback(
    (inspectType: string, field: keyof IntegratedStepState, value: unknown) => {
      setSteps((prev) =>
        prev.map((s) => (s.inspectType === inspectType ? { ...s, [field]: value } : s))
      );
    },
    []
  );

  const fetchLabels = useCallback(async () => {
    setLoadingLabels(true);
    try {
      const res = await api.get(`/quality/continuity-inspect/fg-labels/${order.orderNo}`);
      setLabels(res.data?.data ?? []);
    } catch {
      setLabels([]);
    } finally {
      setLoadingLabels(false);
    }
  }, [order.orderNo]);

  useEffect(() => {
    setResult(null);
    fetchLabels();
  }, [fetchLabels]);

  const allStepsSelected = steps.every((s) => s.passYn !== null);

  const handleSubmit = useCallback(async () => {
    if (!allStepsSelected) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        orderNo: order.orderNo,
        itemCode: order.itemCode,
        lineCode: order.lineCode || undefined,
        equipCode,
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
            ` FG: ${data.fgBarcode}`
        );
      } else {
        toast.error(t("inspection.integrated.overallFailDesc", "하나 이상의 검사 스텝이 불합격입니다."));
      }

      // Reset steps for next product
      setSteps(
        STEPS.map((s) => ({
          inspectType: s.inspectType,
          labelKey: s.labelKey,
          passYn: null,
          errorCode: "",
          errorDetail: "",
        }))
      );
      await fetchLabels();
    } catch {
      // Error handled by interceptor
    } finally {
      setSubmitting(false);
    }
  }, [order, steps, allStepsSelected, equipCode, t, fetchLabels]);

  const columns = useMemo<ColumnDef<FgLabelRow>[]>(
    () => [
      {
        accessorKey: "fgBarcode",
        header: t("inspection.result.fgBarcode", "FG 바코드"),
        size: 200,
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
      },
      {
        accessorKey: "issuedAt",
        header: t("inspection.result.issuedAt", "발행시간"),
        size: 150,
      },
      {
        accessorKey: "inspectPassYn",
        header: t("quality.inspect.judgement"),
        size: 80,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (v === "Y")
            return (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                <CheckCircle className="w-3.5 h-3.5" />
                {t("quality.inspect.pass")}
              </span>
            );
          if (v === "N")
            return (
              <span className="flex items-center gap-1 text-red-500 dark:text-red-400 text-xs">
                <XCircle className="w-3.5 h-3.5" />
                {t("quality.inspect.fail")}
              </span>
            );
          return <span className="text-text-muted text-xs">-</span>;
        },
      },
    ],
    [t]
  );

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* Order info */}
      <Card padding="sm" className="border-primary/30">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono font-bold text-text">{order.orderNo}</p>
              <p className="text-xs text-text-muted">
                {order.itemName ?? order.itemCode} / {t("production.order.planQty", "계획")}: {order.planQty}
              </p>
            </div>
            <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={order.status} />
          </div>
        </CardContent>
      </Card>

      {/* 4 Step cards */}
      {STEPS.map((stepDef, idx) => {
        const step = steps[idx];
        const isPass = step.passYn === "Y";
        const isFail = step.passYn === "N";
        return (
          <Card
            key={stepDef.inspectType}
            padding="sm"
            className={`border-l-4 ${
              isPass
                ? "border-l-green-500"
                : isFail
                  ? "border-l-red-500"
                  : stepDef.color
            } transition-colors`}
          >
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-text">{t(stepDef.labelKey)}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  onClick={() => updateStep(stepDef.inspectType, "passYn", "Y")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-bold text-sm transition-all whitespace-nowrap ${
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
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-bold text-sm transition-all whitespace-nowrap ${
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
                <div className="space-y-2 pl-1">
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
            </CardContent>
          </Card>
        );
      })}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !allStepsSelected}
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all whitespace-nowrap ${
          allStepsSelected
            ? "bg-primary hover:bg-primary-dark text-white"
            : "bg-surface text-text-muted cursor-not-allowed opacity-60"
        }`}
      >
        {submitting
          ? t("common.saving")
          : t("inspection.integrated.submit", "통합검사 제출")}
      </button>

      {/* Not all steps selected warning */}
      {!allStepsSelected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20">
          <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {t("inspection.integrated.allRequired", "모든 검사 스텝의 판정을 선택하세요")}
          </span>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <Card
          padding="sm"
          className={
            result.overallPass
              ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
              : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
          }
        >
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* FG Label history */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text">
              {t("inspection.result.fgLabelHistory", "FG 라벨 발행 이력")}
            </span>
            <Button variant="ghost" size="sm" onClick={fetchLabels}>
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLabels ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <DataGrid
            data={labels}
            columns={columns}
            isLoading={loadingLabels}
            sqlQuery={`SELECT *\nFROM INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
