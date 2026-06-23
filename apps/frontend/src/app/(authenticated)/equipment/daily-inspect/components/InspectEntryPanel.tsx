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

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ClipboardEdit, AlertTriangle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { InspectItemImage } from "@/components/shared";

type InspectType = "DAILY" | "PERIODIC";

export interface Worker {
  workerCode: string;
  workerName: string;
  dept: string;
}

interface InspectItem {
  itemCode?: string;
  seq?: number;
  sortSeq?: number;
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
  inspectType?: InspectType;
  apiBasePath?: string;
  labels?: Partial<InspectEntryLabels>;
  existingInspected?: boolean;
}

interface InspectEntryLabels {
  selectEquip: string;
  inspectEntry: string;
  inspectDate: string;
  inspectorRequired: string;
  startTime: string;
  noItems: string;
  savedOk: string;
  savedNg: string;
  saveError: string;
  fillAllItems: string;
  saveButtonPass: string;
  saveButtonNg: string;
  overallTitle: string;
  overallFailDescription: (total: number, ngCount: number) => string;
  overallPassDescription: (total: number) => string;
  failLabel: string;
  passLabel: string;
  badRemarkPlaceholder: string;
  pendingLabel: string;
}

/* ── 인라인 편집 DataGrid (별도 컴포넌트로 분리 → 포커스 손실 방지) ── */
interface InspectDataGridProps {
  items: InspectItem[];
  results: Record<string, ItemResult>;
  updateResult: (key: string, patch: Partial<ItemResult>) => void;
  labels: InspectEntryLabels;
}

function InspectDataGrid({ items, results, updateResult, labels }: InspectDataGridProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<InspectItem>[]>(() => [
    {
      id: "seq",
      header: "No",
      size: 44,
      meta: { align: "center" as const },
      cell: ({ row }) => <span className="text-text-muted">{row.index + 1}</span>,
    },
    {
      id: "image",
      header: t("equipment.dailyInspect.colPhoto", "사진"),
      size: 56,
      meta: { align: "center" as const },
      enableColumnFilter: false,
      cell: ({ row }) => (
        <InspectItemImage imageUrl={row.original.imageUrl} alt={row.original.itemName} size={36} />
      ),
    },
    {
      accessorKey: "itemName",
      header: t("equipment.dailyInspect.colItem", "점검항목"),
      size: 180,
      cell: ({ getValue }) => <span className="font-medium text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemType",
      header: t("equipment.dailyInspect.colType", "유형"),
      size: 72,
      meta: { align: "center" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            v === "MEASURE"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          }`}>
            {v === "MEASURE" ? t("equipment.dailyInspect.typeMeasure", "측정형") : t("equipment.dailyInspect.typeVisual", "판정형")}
          </span>
        );
      },
    },
    {
      id: "criteria",
      header: t("equipment.dailyInspect.colCriteria", "기준"),
      size: 130,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <span className="text-text-muted text-xs">
          {criteriaText(row.original, t("equipment.dailyInspect.defaultCriteria", "정상"))}
        </span>
      ),
    },
    {
      id: "input",
      header: t("equipment.dailyInspect.colMeasure", "측정값/입력"),
      size: 120,
      meta: { align: "center" as const },
      enableColumnFilter: false,
      cell: ({ row }) => {
        const item = row.original;
        const key = itemKey(item, row.index);
        const r = results[key];
        const isNg = r?.result === "NG";
        if (item.itemType === "MEASURE") {
          return (
            <input
              type="number"
              step="any"
              value={r?.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updateResult(key, { value: v, result: v ? judgeItem(item, v) : null });
              }}
              className={`w-24 px-2 py-1 text-xs text-right border rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-primary ${
                isNg ? "border-red-400 text-red-600 dark:text-red-400 font-bold" : "border-border"
              }`}
            />
          );
        }
        return (
          <select
            value={r?.result ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              updateResult(key, { result: v === "OK" || v === "NG" ? v : null });
            }}
            className={`w-24 px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-primary ${
              isNg ? "border-red-400 text-red-600 dark:text-red-400 font-bold" : "border-border"
            }`}
          >
            <option value="">--</option>
            <option value="OK">OK</option>
            <option value="NG">NG</option>
          </select>
        );
      },
    },
    {
      id: "judge",
      header: t("equipment.dailyInspect.colJudge", "판정"),
      size: 60,
      meta: { align: "center" as const },
      enableColumnFilter: false,
      cell: ({ row }) => {
        const key = itemKey(row.original, row.index);
        const result = results[key]?.result;
        if (!result) return <span className="text-text-muted text-xs">-</span>;
        return (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            result === "OK"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          }`}>
            {result}
          </span>
        );
      },
    },
    {
      id: "remark",
      header: t("common.remark", "비고"),
      size: 160,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const key = itemKey(row.original, row.index);
        const isNg = results[key]?.result === "NG";
        return (
          <input
            type="text"
            value={results[key]?.remark ?? ""}
            onChange={(e) => updateResult(key, { remark: e.target.value })}
            placeholder={isNg ? labels.badRemarkPlaceholder : ""}
            className="w-full px-2 py-0.5 text-xs border border-border rounded bg-white dark:bg-slate-800 focus:outline-none focus:border-primary"
          />
        );
      },
    },
  ], [items, results, updateResult, labels, t]);

  return (
    <DataGrid
      data={items}
      columns={columns}
      isLoading={false}
      rowClassName={(row, index) => {
        const key = itemKey(row, index);
        const result = results[key]?.result;
        if (result === "NG") return "bg-red-50 dark:bg-red-950/20";
        if (result === "OK") return "bg-green-50/40 dark:bg-green-950/10";
        return "";
      }}
    />
  );
}

function judgeItem(item: InspectItem, raw: string): "OK" | "NG" | null {
  if (!raw.trim()) return null;
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  if (item.lslValue !== null && v < item.lslValue) return "NG";
  if (item.uslValue !== null && v > item.uslValue) return "NG";
  return "OK";
}

function criteriaText(item: InspectItem, normalLabel: string): string {
  const u = item.unit ? ` ${item.unit}` : "";
  if (item.lslValue !== null && item.uslValue !== null)
    return `${item.lslValue} ~ ${item.uslValue}${u}`;
  if (item.uslValue !== null) return `≤ ${item.uslValue}${u}`;
  if (item.lslValue !== null) return `≥ ${item.lslValue}${u}`;
  return item.criteria ?? normalLabel;
}

function itemKey(item: InspectItem, index: number): string {
  return item.itemCode ?? `${item.sortSeq ?? item.seq ?? index}-${item.itemName}`;
}

function itemSeq(item: InspectItem, index: number): number {
  return item.seq ?? item.sortSeq ?? index + 1;
}

export default function InspectEntryPanel({
  equipCode,
  equipName,
  itemCount,
  inspectDate,
  workers,
  onSaved,
  inspectType = "DAILY",
  apiBasePath = "/equipment/daily-inspect",
  labels: labelsProp,
  existingInspected,
}: InspectEntryPanelProps) {
  const { t } = useTranslation();
  const labels = useMemo<InspectEntryLabels>(() => ({
    selectEquip: t("equipment.dailyInspect.selectEquip"),
    inspectEntry: t("equipment.dailyInspect.inspectEntry"),
    inspectDate: t("equipment.dailyInspect.inspectDate"),
    inspectorRequired: t("equipment.dailyInspect.inspectorRequired"),
    startTime: t("equipment.dailyInspect.startTime"),
    noItems: t("equipment.dailyInspect.noItems"),
    savedOk: t("equipment.dailyInspect.savedOk"),
    savedNg: t("equipment.dailyInspect.savedNg"),
    saveError: t("equipment.dailyInspect.saveError"),
    fillAllItems: t("equipment.dailyInspect.fillAllItems", "점검 항목을 모두 입력하세요."),
    saveButtonPass: t("equipment.dailyInspect.saveButtonPass", "저장 (PASS)"),
    saveButtonNg: t("equipment.dailyInspect.saveButtonNg", "저장 (NG)"),
    overallTitle: t("equipment.dailyInspect.overallTitle", "종합 판정"),
    overallFailDescription: (total, ngCount) =>
      t("equipment.dailyInspect.overallFailDescription", "{{total}}항목 중 {{ngCount}}건 NG", { total, ngCount }),
    overallPassDescription: (total) =>
      t("equipment.dailyInspect.overallPassDescription", "전 {{total}}항목 OK", { total }),
    failLabel: t("equipment.dailyInspect.failLabel", "불합격 (NG)"),
    passLabel: t("equipment.dailyInspect.passLabel", "합격 (PASS)"),
    badRemarkPlaceholder: t("equipment.dailyInspect.badRemarkPlaceholder", "불량 내용 입력..."),
    pendingLabel: t("equipment.dailyInspect.pendingLabel", "대기"),
    ...labelsProp,
  }), [labelsProp, t]);
  const [items, setItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [inspectorName, setInspectorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const startTime = useMemo(
    () =>
      new Date().toLocaleTimeString(undefined, {
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
        params: { equipCode, inspectType, useYn: "Y", limit: 100 },
        signal: ctrl.signal,
      }),
      inspectType === "DAILY"
        ? api
            .get(`${apiBasePath}/check`, {
              params: { equipCode, inspectDate },
              signal: ctrl.signal,
            })
            .then((r) =>
              r.data?.data?.alreadyInspected
                ? api.get(`${apiBasePath}/${equipCode}/${inspectDate}`, {
                    signal: ctrl.signal,
                  })
                : null
            )
            .catch(() => null)
        : existingInspected
          ? api
              .get(`${apiBasePath}/${equipCode}/${inspectDate}`, { signal: ctrl.signal })
              .catch(() => null)
          : Promise.resolve(null),
    ])
      .then(([itemsRes, logRes]) => {
        const data: InspectItem[] = itemsRes.data?.data ?? [];
        setItems(data);
        const init: Record<string, ItemResult> = {};
        data.forEach((item, index) => {
          init[itemKey(item, index)] = { value: "", result: null, remark: "" };
        });

        const logData = logRes?.data?.data;
        if (logData) {
          try {
            const parsed =
              typeof logData.details === "string"
                ? JSON.parse(logData.details)
                : logData.details;
            for (const d of parsed?.items ?? []) {
              const matchedIndex = data.findIndex((item, index) =>
                (d.itemCode && item.itemCode === d.itemCode) ||
                itemSeq(item, index) === d.seq ||
                item.itemName === d.itemName
              );
              if (matchedIndex >= 0) {
                const key = itemKey(data[matchedIndex], matchedIndex);
                init[key] = {
                  value: d.value ?? "",
                  result: d.result ?? null,
                  remark: d.remark ?? "",
                };
              }
            }
            if (logData.inspectorName) setInspectorName(logData.inspectorName);
          } catch (error: unknown) {
            // 저장된 점검 details 파싱 실패 — 폼은 빈 값으로 진행하되,
            // 양식 갱신 등으로 포맷이 깨졌을 때 원인을 추적할 수 있도록 로깅한다.
            console.warn("[InspectEntryPanel] 저장된 점검 details 파싱 실패", error);
          }
        }
        setResults(init);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== "CanceledError") setItems([]);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [apiBasePath, equipCode, existingInspected, inspectDate, inspectType]);

  const resultsRef = useRef(results);
  resultsRef.current = results;

  const updateResult = useCallback((key: string, patch: Partial<ItemResult>) => {
    setResults((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
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
    items.length > 0 && items.every((item, index) => results[itemKey(item, index)]?.result !== null);
  const isNgOverall = ngCount > 0;
  const saveDisabledReason = loading
    ? t("common.loading")
    : allFilled && !inspectorName
      ? labels.inspectorRequired
      : !allFilled
        ? labels.fillAllItems
        : "";

  const handleSave = useCallback(async () => {
    if (!equipCode || !inspectorName || !allFilled) return;
    setSaving(true);
    try {
      const details = {
        items: items.map((item, index) => ({
          itemCode: item.itemCode ?? null,
          seq: itemSeq(item, index),
          itemName: item.itemName,
          itemType: item.itemType,
          value: results[itemKey(item, index)]?.value || null,
          result: results[itemKey(item, index)]?.result,
          remark: results[itemKey(item, index)]?.remark || null,
        })),
      };
      const payload = {
        equipCode,
        inspectDate,
        inspectorName,
        overallResult: isNgOverall ? "FAIL" : "PASS",
        details,
        inspectType,
      };
      const alreadyExists =
        inspectType === "DAILY"
          ? await api
              .get(`${apiBasePath}/check`, { params: { equipCode, inspectDate } })
              .then((r) => r.data?.data?.alreadyInspected)
              .catch(() => false)
          : existingInspected
            ? await api
                .get(`${apiBasePath}/${equipCode}/${inspectDate}`)
                .then(() => true)
                .catch(() => false)
            : false;

      if (alreadyExists) {
        await api.put(`${apiBasePath}/${equipCode}/${inspectDate}`, payload);
      } else {
        await api.post(apiBasePath, payload);
      }
      toast.success(isNgOverall ? labels.savedNg : labels.savedOk);
      onSaved();
    } catch {
      toast.error(labels.saveError);
    } finally {
      setSaving(false);
    }
  }, [apiBasePath, equipCode, existingInspected, inspectorName, allFilled, inspectType, items, results, isNgOverall, inspectDate, labels, onSaved]);

  if (!equipCode) {
    return (
      <div className="bg-surface border border-border rounded-xl flex flex-col items-center justify-center gap-3 text-text-muted shadow-sm">
        <ClipboardEdit className="w-12 h-12 opacity-20" />
        <p className="text-sm">{labels.selectEquip}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {labels.inspectEntry} — {equipCode} {equipName}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {t("equipment.dailyInspect.itemCountSuffix", "{{count}}항목", { count: itemCount })}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 gap-1">
            <button
              onClick={handleSave}
              disabled={!allFilled || !inspectorName || saving}
              title={saving ? t("common.saving") : saveDisabledReason || t("common.save")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                isNgOverall
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-primary hover:bg-primary/90 text-white"
              }`}
            >
              {saving ? t("common.saving") : isNgOverall ? labels.saveButtonNg : labels.saveButtonPass}
            </button>
            {saveDisabledReason && (
              <p className="text-[10px] text-text-muted">{saveDisabledReason}</p>
            )}
          </div>
        </div>

        {/* 점검일자 / 점검자 / 시작시각 */}
        <div className="mt-2.5 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-text-muted mb-1">{labels.inspectDate}</div>
            <div className="font-mono font-medium">{inspectDate}</div>
          </div>
          <div>
            <div className="font-bold mb-1 text-primary">{labels.inspectorRequired}</div>
            <select
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="w-full px-2 py-1 border border-primary rounded bg-background focus:outline-none text-xs"
            >
              <option value="">{t("equipment.dailyInspect.selectPlaceholder", "-- 선택 --")}</option>
              {workers.map((w) => (
                <option key={w.workerCode} value={w.workerName}>
                  {w.workerName} ({w.dept})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-text-muted mb-1">{labels.startTime}</div>
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
              <div className="text-xs font-bold opacity-80">{labels.overallTitle}</div>
              <div className="text-xs mt-0.5">
                {isNgOverall
                  ? labels.overallFailDescription(items.length, ngCount)
                  : labels.overallPassDescription(items.length)}
              </div>
            </div>
            <div
              className={`font-black text-sm px-3 py-1 rounded-lg ${
                isNgOverall ? "bg-red-600 text-white" : "bg-teal-500 text-white"
              }`}
            >
              {isNgOverall ? labels.failLabel : labels.passLabel}
            </div>
          </div>
        </div>
      )}

      {/* 항목 DataGrid */}
      <div className="flex-1 min-h-0 p-3">
        {loading ? (
          <div className="py-8 text-center text-text-muted text-sm">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-30" />
            <p className="text-sm">{labels.noItems}</p>
          </div>
        ) : (
          <InspectDataGrid
            items={items}
            results={results}
            updateResult={updateResult}
            labels={labels}
          />
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
            {t("equipment.dailyInspect.overallJudgeArrow", "→ 종합판정")}{" "}
            <strong
              className={
                isNgOverall
                  ? "text-red-600 dark:text-red-400"
                  : allFilled
                  ? "text-green-600 dark:text-green-400"
                  : ""
              }
            >
              {isNgOverall ? "NG" : allFilled ? "PASS" : labels.pendingLabel}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
