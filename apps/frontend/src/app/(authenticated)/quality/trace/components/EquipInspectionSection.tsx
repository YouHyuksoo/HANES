"use client";
import { useTranslation } from "react-i18next";
import type { EquipInspection } from "../types";

export default function EquipInspectionSection({ inspections }: { inspections: EquipInspection[] }) {
  const { t } = useTranslation();

  if (inspections.length === 0) {
    return (
      <div className="text-sm text-text-muted py-1.5">
        {t("quality.trace.noEquipInspections", "설비점검 내역 없음")}
      </div>
    );
  }

  function typeLabel(type: string): string {
    if (type === "DAILY") return t("quality.trace.inspectTypeDaily", "일일점검");
    if (type === "WORKER") return t("quality.trace.inspectTypeWorker", "작업자점검");
    if (type === "PERIODIC") return t("quality.trace.inspectTypePeriodic", "정기점검");
    return type;
  }

  function resultBadge(result: string) {
    const cls =
      result === "PASS"
        ? "text-green-600 border-green-600"
        : result === "FAIL"
          ? "text-red-600 border-red-600"
          : "text-blue-600 border-blue-600";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>
        {result}
      </span>
    );
  }

  function itemColor(result: string): string {
    const r = result.toUpperCase();
    if (r === "PASS" || r === "OK") return "text-green-600";
    if (r === "FAIL" || r === "NG") return "text-red-600";
    return "text-text";
  }

  return (
    <ul className="divide-y divide-border">
      {inspections.map((insp, i) => (
        <li key={`${i}-${insp.equipCode}-${insp.inspectAt ?? insp.inspectDate}`} className="py-1.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-text-muted shrink-0">
              {(insp.inspectAt ?? insp.inspectDate ?? "").slice(0, 16).replace("T", " ")}
            </span>
            <span className="font-medium text-text">{typeLabel(insp.inspectType)}</span>
            <span className="text-xs text-text-muted truncate">
              {insp.equipName} / {insp.inspectorName ?? "-"}
            </span>
            <span className="ml-auto shrink-0">{resultBadge(insp.overallResult)}</span>
          </div>
          {insp.items.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-1">
              {insp.items.map((it, j) => (
                <span key={`${j}-${it.name}`} className="text-xs text-text-muted">
                  {it.name} <span className={itemColor(it.result)}>{it.result}</span>
                  {it.remark ? <span className="text-text-muted"> ({it.remark})</span> : null}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
