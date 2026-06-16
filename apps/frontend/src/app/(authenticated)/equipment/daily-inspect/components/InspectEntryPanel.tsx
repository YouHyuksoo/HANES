"use client";

/**
 * @file components/InspectEntryPanel.tsx
 * @description 일일설비점검 우측 패널 — 항목별 측정값/판정 인라인 입력 + 저장
 *
 * 초보자 가이드:
 * - MEASURE(측정형): 숫자 입력 → LSL/USL 비교로 OK/NG 자동판정
 * - VISUAL(판정형): OK/NG 직접 선택
 * - 한 항목이라도 NG → 종합판정 FAIL → 저장 시 정비요청(WO) 자동 등록
 * - 기존 로그가 있으면 details JSON 파싱해 입력값 자동 채움
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ClipboardEdit, AlertTriangle } from "lucide-react";
import api from "@/services/api";
import { InspectItemImage } from "@/components/shared";
import type { Worker } from "../page";

interface InspectItem {
  seq: number;
  itemName: string;
  itemType: string;
  criteria: string | null;
  unit: string | null;
  lslValue: number | null;
  uslValue: number | null;
  imageUrl: string | null;
}

interface ItemResult {
  value: string;
  result: "OK" | "NG" | null;
  remark: string;
}

interface InspectEntryPanelProps {
  equipCode: string | null;
  equipName: string;
  itemCount: number;
  inspectDate: string;
  workers: Worker[];
  onSaved: () => void;
}

function judgeItem(item: InspectItem, raw: string): "OK" | "NG" | null {
  if (!raw.trim()) return null;
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  if (item.lslValue !== null && v < item.lslValue) return "NG";
  if (item.uslValue !== null && v > item.uslValue) return "NG";
  return "OK";
}

function criteriaText(item: InspectItem): string {
  const u = item.unit ? ` ${item.unit}` : "";
  if (item.lslValue !== null && item.uslValue !== null)
    return `${item.lslValue} ~ ${item.uslValue}${u}`;
  if (item.uslValue !== null) return `≤ ${item.uslValue}${u}`;
  if (item.lslValue !== null) return `≥ ${item.lslValue}${u}`;
  return item.criteria ?? "정상";
}

export default function InspectEntryPanel({
  equipCode,
  equipName,
  itemCount,
  inspectDate,
  workers,
  onSaved,
}: InspectEntryPanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Record<number, ItemResult>>({});
  const [inspectorName, setInspectorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const startTime = useMemo(
    () =>
      new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  useEffect(() => {
    if (!equipCode) {
      setItems([]);
      setResults({});
      setInspectorName("");
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);

    Promise.all([
      api.get("/master/equip-inspect-items", {
        params: { equipCode, inspectType: "DAILY", useYn: "Y", limit: 100 },
        signal: ctrl.signal,
      }),
      api
        .get("/equipment/daily-inspect/check", {
          params: { equipCode, inspectDate },
          signal: ctrl.signal,
        })
        .then((r) =>
          r.data?.data?.alreadyInspected
            ? api.get(`/equipment/daily-inspect/${equipCode}/${inspectDate}`, {
                signal: ctrl.signal,
              })
            : null
        )
        .catch(() => null),
    ])
      .then(([itemsRes, logRes]) => {
        const data: InspectItem[] = itemsRes.data?.data ?? [];
        setItems(data);
        const init: Record<number, ItemResult> = {};
        for (const item of data) init[item.seq] = { value: "", result: null, remark: "" };

        const logData = logRes?.data?.data;
        if (logData) {
          try {
            const parsed =
              typeof logData.details === "string"
                ? JSON.parse(logData.details)
                : logData.details;
            for (const d of parsed?.items ?? []) {
              if (init[d.seq]) init[d.seq] = { value: d.value ?? "", result: d.result ?? null, remark: d.remark ?? "" };
            }
            if (logData.inspectorName) setInspectorName(logData.inspectorName);
          } catch { /* ignore parse error */ }
        }
        setResults(init);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== "CanceledError") setItems([]);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [equipCode, inspectDate]);

  const updateResult = useCallback((seq: number, patch: Partial<ItemResult>) => {
    setResults((prev) => ({ ...prev, [seq]: { ...prev[seq], ...patch } }));
  }, []);

  const okCount = useMemo(
    () => Object.values(results).filter((r) => r.result === "OK").length,
    [results]
  );
  const ngCount = useMemo(
    () => Object.values(results).filter((r) => r.result === "NG").length,
    [results]
  );
  const allFilled =
    items.length > 0 && items.every((item) => results[item.seq]?.result !== null);
  const isNgOverall = ngCount > 0;
  const saveDisabledReason = loading
    ? t("common.loading")
    : allFilled && !inspectorName
      ? t("equipment.dailyInspect.inspectorRequired")
      : !allFilled
        ? "점검 항목을 모두 입력하세요."
        : "";

  const handleSave = useCallback(async () => {
    if (!equipCode || !inspectorName || !allFilled) return;
    setSaving(true);
    try {
      const details = {
        items: items.map((item) => ({
          seq: item.seq,
          itemName: item.itemName,
          itemType: item.itemType,
          value: results[item.seq]?.value || null,
          result: results[item.seq]?.result,
          remark: results[item.seq]?.remark || null,
        })),
      };
      const payload = {
        equipCode,
        inspectDate,
        inspectorName,
        overallResult: isNgOverall ? "FAIL" : "PASS",
        details,
        inspectType: "DAILY",
      };
      const alreadyExists = await api
        .get("/equipment/daily-inspect/check", { params: { equipCode, inspectDate } })
        .then((r) => r.data?.data?.alreadyInspected)
        .catch(() => false);

      if (alreadyExists) {
        await api.put(`/equipment/daily-inspect/${equipCode}/${inspectDate}`, payload);
      } else {
        await api.post("/equipment/daily-inspect", payload);
      }
      toast.success(
        isNgOverall
          ? t("equipment.dailyInspect.savedNg")
          : t("equipment.dailyInspect.savedOk")
      );
      onSaved();
    } catch {
      toast.error(t("equipment.dailyInspect.saveError"));
    } finally {
      setSaving(false);
    }
  }, [equipCode, inspectorName, allFilled, items, results, isNgOverall, inspectDate, onSaved, t]);

  if (!equipCode) {
    return (
      <div className="bg-surface border border-border rounded-xl flex flex-col items-center justify-center gap-3 text-text-muted shadow-sm">
        <ClipboardEdit className="w-12 h-12 opacity-20" />
        <p className="text-sm">{t("equipment.dailyInspect.selectEquip")}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">
              📝 {t("equipment.dailyInspect.inspectEntry")} — {equipCode} {equipName}
            </div>
            <div className="text-xs text-text-muted mt-0.5">{itemCount}항목</div>
          </div>
          <button
            onClick={handleSave}
            disabled={!allFilled || !inspectorName || saving}
            title={saving ? t("common.saving") : saveDisabledReason || t("common.save")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
              isNgOverall
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            {saving
              ? t("common.saving")
              : isNgOverall
              ? "💾 저장 (NG · 정비요청 등록)"
              : "💾 저장 (PASS)"}
          </button>
          {saveDisabledReason ? (
            <p className="text-[11px] text-text-muted mt-2" title={saveDisabledReason}>
              {saveDisabledReason}
            </p>
          ) : null}
        </div>

        {/* 점검일자 / 점검자 / 시작시각 */}
        <div className="mt-2.5 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-text-muted mb-1">
              {t("equipment.dailyInspect.inspectDate")}
            </div>
            <div className="font-mono font-medium">{inspectDate}</div>
          </div>
          <div>
            <div className="font-bold mb-1 text-primary">
              {t("equipment.dailyInspect.inspectorRequired")}
            </div>
            <select
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="w-full px-2 py-1 border border-primary rounded bg-background focus:outline-none text-xs"
            >
              <option value="">-- 선택 --</option>
              {workers.map((w) => (
                <option key={w.workerCode} value={w.workerName}>
                  {w.workerName} ({w.dept})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-text-muted mb-1">
              {t("equipment.dailyInspect.startTime")}
            </div>
            <div className="font-mono font-medium">{startTime}</div>
          </div>
        </div>
      </div>

      {/* 종합판정 배너 */}
      {allFilled && (
        <div className="px-3 pt-2.5">
          <div
            className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${
              isNgOverall
                ? "bg-red-50 dark:bg-red-950/30 border-red-500 text-red-700 dark:text-red-300"
                : "bg-green-50 dark:bg-green-950/30 border-teal-500 text-green-700 dark:text-green-300"
            }`}
          >
            <div>
              <div className="text-xs font-bold opacity-80">종합 판정</div>
              <div className="text-xs mt-0.5">
                {isNgOverall
                  ? `${items.length}항목 중 ${ngCount}건 NG — 저장 시 정비요청(WO) 자동 등록`
                  : `전 ${items.length}항목 OK`}
              </div>
            </div>
            <div
              className={`font-black text-sm px-3 py-1 rounded-lg ${
                isNgOverall ? "bg-red-600 text-white" : "bg-teal-500 text-white"
              }`}
            >
              {isNgOverall ? "✕ 불합격 (NG)" : "✓ 합격 (PASS)"}
            </div>
          </div>
        </div>
      )}

      {/* 항목 테이블 */}
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="py-8 text-center text-text-muted text-sm">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t("equipment.dailyInspect.noItems")}</p>
          </div>
        ) : (
          <table className="w-full text-xs border border-border rounded-lg overflow-hidden border-collapse">
            <thead className="bg-surface sticky top-0">
              <tr className="border-b border-border text-text-muted">
                <th className="w-8 px-2 py-2 text-center font-medium">No</th>
                <th className="w-14 px-2 py-2 text-center font-medium">사진</th>
                <th className="px-3 py-2 text-left font-medium">점검항목</th>
                <th className="w-16 px-2 py-2 text-center font-medium">유형</th>
                <th className="w-32 px-2 py-2 text-center font-medium">기준</th>
                <th className="w-24 px-2 py-2 text-center font-medium">측정값/입력</th>
                <th className="w-14 px-2 py-2 text-center font-medium">판정</th>
                <th className="px-2 py-2 text-left font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const r = results[item.seq];
                const isRowNg = r?.result === "NG";
                return (
                  <tr
                    key={item.seq}
                    className={`border-b border-border ${
                      isRowNg ? "bg-red-50 dark:bg-red-950/20" : ""
                    }`}
                  >
                    <td className="px-2 py-2 text-center text-text-muted">{idx + 1}</td>
                    <td className="px-2 py-2 text-center">
                      <InspectItemImage imageUrl={item.imageUrl} alt={item.itemName} size={40} />
                    </td>
                    <td className="px-3 py-2 font-medium">{item.itemName}</td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${
                          item.itemType === "MEASURE"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        }`}
                      >
                        {item.itemType === "MEASURE" ? "측정형" : "판정형"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-text-muted">
                      {criteriaText(item)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {item.itemType === "MEASURE" ? (
                        <input
                          type="number"
                          step="any"
                          value={r?.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateResult(item.seq, {
                              value: v,
                              result: v ? judgeItem(item, v) : null,
                            });
                          }}
                          className={`w-20 px-2 py-1 text-right border rounded bg-white dark:bg-slate-800 focus:outline-none ${
                            isRowNg
                              ? "border-red-500 text-red-600 dark:text-red-400 font-bold"
                              : "border-border"
                          }`}
                        />
                      ) : (
                        <select
                          value={r?.result ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateResult(item.seq, {
                              result: v === "OK" || v === "NG" ? v : null,
                            });
                          }}
                          className={`w-20 px-2 py-1 border rounded bg-white dark:bg-slate-800 focus:outline-none ${
                            isRowNg
                              ? "border-red-500 text-red-600 dark:text-red-400 font-bold"
                              : "border-border"
                          }`}
                        >
                          <option value="">--</option>
                          <option value="OK">OK</option>
                          <option value="NG">NG</option>
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r?.result ? (
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            r.result === "OK"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {r.result}
                        </span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={r?.remark ?? ""}
                        onChange={(e) => updateResult(item.seq, { remark: e.target.value })}
                        placeholder={isRowNg ? "불량 내용 입력..." : ""}
                        className="w-full px-2 py-1 border border-border rounded bg-white dark:bg-slate-800 focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 푸터 */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">
            OK {okCount}
          </span>
          <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium">
            NG {ngCount}
          </span>
          <span className="text-text-muted">
            → 종합판정{" "}
            <strong
              className={
                isNgOverall
                  ? "text-red-600 dark:text-red-400"
                  : allFilled
                  ? "text-green-600 dark:text-green-400"
                  : ""
              }
            >
              {isNgOverall ? "NG" : allFilled ? "PASS" : "대기"}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
