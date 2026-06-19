"use client";

/**
 * @file shelf-life-history/ShelfLifeDetailModal.tsx
 * @description 유수명자재 재검사 이력 상세 모달 — 검사항목별 측정값·판정 조회
 *
 * 재검사 저장 형태: details = { type: "RETEST_INSPECTION", items: [...] } (단일 LOT, 시리얼 구분 없음)
 */
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle } from "lucide-react";
import { Modal } from "@/components/ui";

interface InspectionItem {
  itemId?: string;
  inspectItem: string;
  spec?: string | null;
  lsl?: number | null;
  usl?: number | null;
  unit?: string | null;
  measuredValue?: string;
  judge?: string;
}

interface DetailsPayload {
  type?: string;
  items?: InspectionItem[];
}

export interface ShelfLifeDetailRecord {
  inspectDate: string;
  seq?: number;
  matUid?: string | null;
  itemCode?: string;
  itemName?: string | null;
  result?: string;
  retestRound?: number | null;
  inspectorName?: string | null;
  destructSampleQty?: number | null;
  remark?: string | null;
  details?: string | null;
}

interface Props {
  record: ShelfLifeDetailRecord | null;
  onClose: () => void;
}

const formatDate = (val?: string) => {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString();
};

export default function ShelfLifeDetailModal({ record, onClose }: Props) {
  const { t } = useTranslation();

  const details: DetailsPayload | null = (() => {
    if (!record?.details) return null;
    try { return JSON.parse(record.details); }
    catch { return null; }
  })();

  const items: InspectionItem[] = details?.items ?? [];

  const resultBadge = (result?: string) => {
    if (!result) return <span className="text-text-muted">-</span>;
    const color = result === "PASS"
      ? "text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700"
      : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300";
    const label = result === "PASS" ? t("material.shelfLife.pass", "합격") : t("material.shelfLife.fail", "불합격");
    return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>{label}</span>;
  };

  const title = `${t("material.shelfLife.reinspectModalTitle", "유수명자재 재검사")} — ${record?.itemName ?? record?.itemCode ?? ""} (${formatDate(record?.inspectDate)})`;

  return (
    <Modal isOpen={!!record} onClose={onClose} title={title} size="2xl">
      {record && (
        <div className="flex flex-col gap-4">
          {/* 헤더 정보 */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-1 text-sm md:grid-cols-3">
            <div className="flex gap-2"><span className="min-w-[64px] text-text-muted">{t("common.partName")}</span><span className="font-medium text-text">{record.itemName || record.itemCode || "-"}</span></div>
            <div className="flex gap-2"><span className="min-w-[64px] text-text-muted">LOT No.</span><span className="font-mono text-text">{record.matUid || "-"}</span></div>
            <div className="flex gap-2"><span className="min-w-[64px] text-text-muted">{t("material.shelfLife.retestRound", "회차")}</span><span className="text-text">{record.retestRound ?? "-"}</span></div>
            <div className="flex gap-2"><span className="min-w-[64px] text-text-muted">{t("common.result", "결과")}</span>{resultBadge(record.result)}</div>
            <div className="flex gap-2"><span className="min-w-[64px] text-text-muted">{t("material.shelfLife.inspector", "검사자")}</span><span className="text-text">{record.inspectorName || "-"}</span></div>
            <div className="flex gap-2"><span className="min-w-[64px] text-text-muted">{t("material.iqc.sampleQty", "시료수량")}</span><span className="text-text">{record.destructSampleQty ?? "-"}</span></div>
            <div className="col-span-2 flex gap-2 md:col-span-3"><span className="min-w-[64px] text-text-muted">{t("common.remark")}</span><span className="text-text">{record.remark || "-"}</span></div>
          </div>

          <div className="border-t border-border" />

          {/* 검사항목 상세 */}
          {items.length > 0 ? (
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b border-border bg-surface">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">{t("material.iqc.inspectItem", "검사항목")}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-text-muted">{t("material.iqc.spec", "규격")}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-text-muted">{t("material.iqc.lsl", "하한")}</th>
                    <th className="px-2 py-1.5 text-right font-medium text-text-muted">{t("material.iqc.usl", "상한")}</th>
                    <th className="px-2 py-1.5 text-center font-medium text-text-muted">{t("material.iqc.measuredValue", "측정값")}</th>
                    <th className="px-2 py-1.5 text-center font-medium text-text-muted">{t("material.iqc.judgment", "판정")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.itemId ?? idx} className="border-t border-border hover:bg-surface/50">
                      <td className="px-2 py-1.5 text-text-muted">{idx + 1}</td>
                      <td className="px-2 py-1.5 font-medium text-text">{item.inspectItem}</td>
                      <td className="px-2 py-1.5 text-text-muted">{item.spec || "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{item.lsl !== undefined && item.lsl !== null ? item.lsl : "-"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{item.usl !== undefined && item.usl !== null ? item.usl : "-"}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums font-medium text-text">
                        {item.measuredValue ? `${item.measuredValue}${item.unit ? ` ${item.unit}` : ""}` : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {item.judge === "PASS" && <CheckCircle className="inline h-4 w-4 text-green-500" />}
                        {item.judge === "FAIL" && <XCircle className="inline h-4 w-4 text-red-500" />}
                        {(!item.judge || (item.judge !== "PASS" && item.judge !== "FAIL")) && <span className="text-text-muted">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">
              {t("material.shelfLife.noInspectDetail", "항목별 측정값 없음 (수동 판정)")}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
