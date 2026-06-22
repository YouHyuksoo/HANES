"use client";

/**
 * @file shelf-life-reinspect/components/ReinspectModal.tsx
 * @description 유수명자재 재검사 모달 - 단일 LOT을 IQC처럼 검사항목 전체로 검사
 *
 * 초보자 가이드:
 * 1. 대상 LOT의 품목코드로 /master/iqc-part-specs/:itemCode/resolve-items 조회 → 검사항목 전체 표시
 * 2. 항목별 측정값 입력(LSL/USL 자동판정) 또는 PASS/FAIL 수동판정
 * 3. 한 항목이라도 FAIL → 종합 FAIL, 전 항목 PASS → 종합 PASS
 * 4. 합격 시 연장일 입력(품목 최대연장일 이하) → POST /material/shelf-life/reinspect
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, AlertCircle, FlaskConical } from "lucide-react";
import { Button, Modal, Input } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import api from "@/services/api";

export interface ReinspectTarget {
  matUid: string;
  itemCode: string;
  itemName?: string | null;
  unit?: string | null;
  currentQty?: number | null;
  expireDate?: string | null;
  daysUntilExpiry?: number | null;
}

interface IqcInspectItem {
  itemCode: string;
  seq: number;
  inspectItem: string;
  spec: string | null;
  lsl: number | null;
  usl: number | null;
  unit: string | null;
  judgeMethod?: string;
  judgeCriteria: string | null;
}

interface MeasurementRow {
  itemId: string;
  inspectItem: string;
  spec: string;
  lsl: number | null;
  usl: number | null;
  unit: string;
  judgeCriteria: string;
  measuredValue: string;
  judge: "PASS" | "FAIL" | "";
}

interface ReinspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ReinspectTarget | null;
  onSubmitted: () => void;
}

function judgeValue(value: string, lsl: number | null, usl: number | null): "PASS" | "FAIL" | "" {
  if (!value.trim()) return "";
  if (lsl === null && usl === null) return "PASS";
  const num = parseFloat(value);
  if (Number.isNaN(num)) return "";
  if (lsl !== null && num < lsl) return "FAIL";
  if (usl !== null && num > usl) return "FAIL";
  return "PASS";
}

function createRows(items: IqcInspectItem[]): MeasurementRow[] {
  return items.map((item) => ({
    itemId: `${item.itemCode}::${item.seq}`,
    inspectItem: item.inspectItem,
    spec: item.spec || "",
    lsl: item.lsl,
    usl: item.usl,
    unit: item.unit || "",
    judgeCriteria: item.judgeCriteria || "",
    measuredValue: "",
    judge: "",
  }));
}

export default function ReinspectModal({ isOpen, onClose, target, onSubmitted }: ReinspectModalProps) {
  const { t } = useTranslation();
  const [loadingItems, setLoadingItems] = useState(false);
  const [hasInspectItems, setHasInspectItems] = useState(true);
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [manualResult, setManualResult] = useState<"PASS" | "FAIL" | "">("");
  const [inspector, setInspector] = useState("");
  const [remark, setRemark] = useState("");
  const [extendDays, setExtendDays] = useState("");
  const [sampleQty, setSampleQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 모달 오픈/대상 변경 시 상태 초기화 + 검사항목 로드
  useEffect(() => {
    if (!isOpen || !target) {
      setRows([]);
      setManualResult("");
      setInspector("");
      setRemark("");
      setExtendDays("");
      setSampleQty("");
      setHasInspectItems(true);
      return;
    }

    let cancelled = false;
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const res = await api.get(
          `/master/iqc-part-specs/${encodeURIComponent(target.itemCode)}/resolve-items`,
        );
        if (cancelled) return;
        const items: IqcInspectItem[] = res.data?.data ?? [];
        setRows(createRows(items));
        setHasInspectItems(items.length > 0);
      } catch {
        if (cancelled) return;
        setRows([]);
        setHasInspectItems(false);
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    };
    fetchItems();
    return () => { cancelled = true; };
  }, [isOpen, target]);

  const updateMeasurement = useCallback((idx: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], measuredValue: value, judge: judgeValue(value, next[idx].lsl, next[idx].usl) };
      return next;
    });
  }, []);

  const updateJudge = useCallback((idx: number, judge: "PASS" | "FAIL") => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], measuredValue: judge, judge };
      return next;
    });
  }, []);

  // 종합판정: 검사항목이 있으면 전 항목 판정 후 도출, 없으면 수동판정
  const allJudged = rows.length > 0 && rows.every((r) => r.judge !== "");
  const overallResult: "PASS" | "FAIL" | "" = hasInspectItems
    ? (allJudged ? (rows.some((r) => r.judge === "FAIL") ? "FAIL" : "PASS") : "")
    : manualResult;

  const passCount = rows.filter((r) => r.judge === "PASS").length;
  const failCount = rows.filter((r) => r.judge === "FAIL").length;
  const canSubmit = overallResult !== "" && !loadingItems && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!target || overallResult === "") return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        matUid: target.matUid,
        result: overallResult,
        inspectorName: inspector || undefined,
        remark: remark || undefined,
        details: JSON.stringify({
          type: "RETEST_INSPECTION",
          items: rows.map((r) => ({
            itemId: r.itemId,
            inspectItem: r.inspectItem,
            spec: r.spec,
            measuredValue: r.measuredValue,
            judge: r.judge,
            lsl: r.lsl,
            usl: r.usl,
            unit: r.unit,
          })),
        }),
      };
      if (sampleQty) payload.destructSampleQty = Number(sampleQty);
      if (overallResult === "PASS" && extendDays) payload.extendDays = Number(extendDays);

      await api.post("/material/shelf-life/reinspect", payload);
      onSubmitted();
      onClose();
    } catch {
      // api 인터셉터에서 에러 처리
    } finally {
      setSubmitting(false);
    }
  }, [target, overallResult, inspector, remark, rows, sampleQty, extendDays, onSubmitted, onClose]);

  if (!target) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.shelfLife.reinspectModalTitle", "유수명자재 재검사")} size="2xl">
      <div className="flex flex-col gap-3">
        {/* 대상 LOT 요약 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md bg-background p-3 text-xs md:grid-cols-4">
          <p className="text-text-muted">LOT No.: <span className="font-mono font-semibold text-text">{target.matUid}</span></p>
          <p className="col-span-2 truncate text-text-muted" title={`${target.itemName ?? ""} (${target.itemCode})`}>
            {t("common.partName")}: <span className="font-semibold text-text">{target.itemName ?? "-"} ({target.itemCode})</span>
          </p>
          <p className="text-text-muted">
            {t("material.shelfLife.expireDate")}: <span className="font-semibold text-text">{target.expireDate ? new Date(target.expireDate).toLocaleDateString() : "-"}</span>
          </p>
        </div>

        {/* 검사항목 테이블 */}
        <div className="min-h-0 overflow-hidden rounded-lg border border-border">
          {loadingItems ? (
            <div className="p-8 text-center text-sm text-text-muted">{t("common.loading")}</div>
          ) : hasInspectItems ? (
            <div className="max-h-[42vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">{t("material.iqc.inspectItem", "검사항목")}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">{t("material.iqc.spec", "규격")}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-text-muted">{t("material.iqc.lsl", "하한")}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-text-muted">{t("material.iqc.usl", "상한")}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">{t("material.iqc.judgeCriteria", "판정기준")}</th>
                    <th className="px-2 py-1.5 text-center font-medium text-text-muted">{t("material.iqc.measuredValue", "측정값")}</th>
                    <th className="px-2 py-1.5 text-center font-medium text-text-muted">{t("material.iqc.judgment", "판정")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.itemId} className="border-t border-border hover:bg-surface/50">
                      <td className="px-2 py-1.5 text-text-muted">{idx + 1}</td>
                      <td className="px-2 py-1.5 font-medium text-text">{row.inspectItem}</td>
                      <td className="px-2 py-1.5 text-text-muted">{row.spec || "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{row.lsl !== null ? row.lsl : "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{row.usl !== null ? row.usl : "-"}</td>
                      <td className="px-2 py-1.5 max-w-[180px] text-text-muted">
                        <span className="block truncate" title={row.judgeCriteria || undefined}>{row.judgeCriteria || "-"}</span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        {row.lsl === null && row.usl === null ? (
                          <div className="flex justify-center gap-1">
                            <button type="button"
                              className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                                row.judge === "PASS"
                                  ? "border-green-400 bg-green-100 font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : "border-border bg-surface text-text-muted hover:text-green-700"
                              }`}
                              onClick={() => updateJudge(idx, "PASS")}>PASS</button>
                            <button type="button"
                              className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                                row.judge === "FAIL"
                                  ? "border-red-400 bg-red-100 font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                  : "border-border bg-surface text-text-muted hover:text-red-700"
                              }`}
                              onClick={() => updateJudge(idx, "FAIL")}>FAIL</button>
                          </div>
                        ) : (
                          <input type="number" step="any"
                            className="h-7 w-24 rounded border border-border bg-surface px-2 text-center text-text focus:outline-none focus:ring-1 focus:ring-primary"
                            value={row.measuredValue}
                            onChange={(e) => updateMeasurement(idx, e.target.value)}
                            placeholder={row.unit} />
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {row.judge === "PASS" && <CheckCircle className="inline w-4 h-4 text-green-500" />}
                        {row.judge === "FAIL" && <XCircle className="inline w-4 h-4 text-red-500" />}
                        {row.judge === "" && <span className="text-text-muted">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {t("material.iqc.noInspectItems", "이 품목에 등록된 IQC 검사항목이 없습니다. 수동으로 합불 판정해주세요.")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={manualResult === "PASS" ? "primary" : "secondary"} onClick={() => setManualResult("PASS")}>{t("material.shelfLife.pass", "합격")}</Button>
                <Button size="sm" variant={manualResult === "FAIL" ? "danger" : "secondary"} onClick={() => setManualResult("FAIL")}>{t("material.shelfLife.fail", "불합격")}</Button>
              </div>
            </div>
          )}
        </div>

        {/* 입력 필드 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">{t("material.shelfLife.inspector", "검사자")}</label>
            <Input value={inspector} onChange={(e) => setInspector(e.target.value)} fullWidth />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">{t("material.iqc.sampleQty", "시료수량")}</label>
            <QtyInput value={Number(sampleQty) || 0} onChange={n => setSampleQty(n ? String(n) : "")} placeholder="0" fullWidth />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">{t("material.shelfLife.extendDays", "적용연장일(일)")}</label>
            <Input type="number" min={0}
              value={overallResult === "PASS" ? extendDays : ""}
              onChange={(e) => setExtendDays(e.target.value)}
              placeholder={overallResult === "PASS" ? t("material.shelfLife.extendDaysHint", "품목 기준 자동") : "-"}
              disabled={overallResult !== "PASS"} fullWidth />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-text-muted">{t("common.remark")}</label>
            <Input value={remark} onChange={(e) => setRemark(e.target.value)} fullWidth />
          </div>
        </div>

        {/* 종합판정 + 등록 */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm font-semibold">
            {overallResult === ""
              ? <span className="text-amber-600 dark:text-amber-300">{t("material.iqc.incompleteSerialJudge", "판정이 끝나지 않았습니다.")}</span>
              : overallResult === "FAIL"
                ? <span className="text-red-600 dark:text-red-400">{t("material.shelfLife.overallResult", "종합판정")}: {t("material.shelfLife.fail", "불합격")}{hasInspectItems ? ` (FAIL ${failCount} / PASS ${passCount})` : ""}</span>
                : <span className="text-green-600 dark:text-green-400">{t("material.shelfLife.overallResult", "종합판정")}: {t("material.shelfLife.pass", "합격")}{hasInspectItems ? ` (PASS ${passCount})` : ""}</span>}
          </span>
          <Button variant={overallResult === "FAIL" ? "danger" : "primary"} onClick={handleSubmit} disabled={!canSubmit}>
            <FlaskConical className="mr-1 h-4 w-4" />
            {submitting ? t("common.saving") : t("material.shelfLife.submitReinspect", "재검사 결과 등록")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
