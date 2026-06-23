"use client";
import { useTranslation } from "react-i18next";
import type { DefectRecord, RepairRecord } from "../types";

export default function DefectRepairSection({
  defects,
  repairs,
}: {
  defects: DefectRecord[];
  repairs: RepairRecord[];
}) {
  const { t } = useTranslation();

  function statusBadge(status: string) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border text-blue-600 border-blue-600">
        {status}
      </span>
    );
  }

  function sourceLabel(source: "REPAIR" | "REWORK"): string {
    if (source === "REPAIR") return t("quality.trace.sourceRepair", "수리");
    if (source === "REWORK") return t("quality.trace.sourceRework", "재작업");
    return source;
  }

  return (
    <div className="space-y-4">
      {/* 불량 블록 */}
      <div>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
          {t("quality.trace.defects", "불량 등록")}
        </div>
        {defects.length === 0 ? (
          <div className="text-sm text-text-muted py-1">{t("quality.trace.noDefects", "불량 내역 없음")}</div>
        ) : (
          <ul className="divide-y divide-border">
            {defects.map((d, i) => (
              <li key={`${i}-${d.defectCode}-${d.occurAt}`} className="flex items-center gap-3 text-sm py-1.5">
                <span className="font-mono text-xs text-text-muted shrink-0">
                  {(d.occurAt ?? "").slice(0, 16).replace("T", " ")}
                </span>
                <span className="font-medium text-text">{d.defectName}</span>
                <span className="text-xs text-text-muted">{d.defectCode}</span>
                <span className="text-text-muted">{d.qty.toLocaleString()}</span>
                {d.cause && <span className="text-xs text-text-muted truncate">{d.cause}</span>}
                <span className="ml-auto shrink-0">{statusBadge(d.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 수리·재작업 블록 */}
      <div>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
          {t("quality.trace.repairs", "수리·재작업")}
        </div>
        {repairs.length === 0 ? (
          <div className="text-sm text-text-muted py-1">{t("quality.trace.noRepairs", "수리 내역 없음")}</div>
        ) : (
          <ul className="divide-y divide-border">
            {repairs.map((r, i) => (
              <li key={`${i}-${r.refNo}-${r.startAt}`} className="flex items-center gap-3 text-sm py-1.5">
                <span className="font-mono text-xs text-text-muted shrink-0">
                  {(r.startAt ?? "").slice(0, 16).replace("T", " ")}
                </span>
                <span className="font-medium text-text">{sourceLabel(r.source)}</span>
                <span className="font-mono text-xs text-text-muted">{r.refNo}</span>
                {r.defectType && <span className="text-xs text-text-muted truncate">{r.defectType}</span>}
                <span className="text-xs text-text-muted">{r.workerId ?? "-"}</span>
                {r.endAt && (
                  <span className="text-xs text-text-muted shrink-0">
                    ~{r.endAt.slice(0, 16).replace("T", " ")}
                  </span>
                )}
                <span className="ml-auto shrink-0">{statusBadge(r.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
