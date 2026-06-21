"use client";

/**
 * IQC 이력 상세 모달 — 시리얼별 검사항목 측정값·판정 조회
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle } from "lucide-react";
import { Modal, ComCodeBadge } from "@/components/ui";

interface ItemJudgeEntry {
  seq?: number;
  inspItemCode?: string;
  defectGrade?: string | null;
  inspectionLevel?: string | null;
  aql?: number | null;
  defectCount?: number;
  acceptQty?: number | null;
  rejectQty?: number | null;
  result?: string;
  reason?: string;
  inspectionType?: string;
  requiredQty?: number | null;
  inspectedQty?: number | null;
}

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

interface SerialEntry {
  matUid: string;
  qty?: number | null;
  result?: string;
  items?: InspectionItem[];
}

interface DetailsPayload {
  type?: string;
  serials?: SerialEntry[];
}

export interface IqcDetailRecord {
  inspectDate: string;
  seq?: number;
  matUid?: string | null;
  arrivalNo?: string | null;
  itemCode?: string;
  itemName?: string | null;
  inspectType?: string;
  result?: string;
  inspectorName?: string | null;
  sampleBarcode?: string | null;
  remark?: string | null;
  details?: string | null;
  itemResults?: string | null;
}

interface Props {
  record: IqcDetailRecord | null;
  onClose: () => void;
}

const formatDate = (val: string) => {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString();
};

const resultBadge = (result?: string) => {
  if (!result) return null;
  const color = result === "PASS"
    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{result}</span>;
};

export default function IqcDetailModal({ record, onClose }: Props) {
  const { t } = useTranslation();
  const [selectedSerial, setSelectedSerial] = useState<string>("");

  const details: DetailsPayload | null = (() => {
    if (!record?.details) return null;
    try { return JSON.parse(record.details); }
    catch { return null; }
  })();

  const serials: SerialEntry[] = details?.serials ?? [];

  const itemResults: ItemJudgeEntry[] = (() => {
    if (!record?.itemResults) return [];
    try {
      const parsed = JSON.parse(record.itemResults);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  // 모달 열릴 때 첫 시리얼 자동 선택
  const activeSerial = selectedSerial || serials[0]?.matUid || "";
  const activeEntry = serials.find((s) => s.matUid === activeSerial);

  // sampleBarcode 콤마 파싱 (details가 없을 때 fallback)
  const barcodes = record?.sampleBarcode
    ? record.sampleBarcode.split(",").map((b) => b.trim()).filter(Boolean)
    : [];

  const title = t("material.iqcHistory.detail.title", "IQC 검사 상세 — {{name}} ({{date}})", {
    name: record?.itemName ?? record?.itemCode ?? "",
    date: formatDate(record?.inspectDate ?? ""),
  });

  return (
    <Modal isOpen={!!record} onClose={onClose} title={title} size="full">
      {record && (
        <div className="flex flex-col gap-4">
          {/* 헤더 정보 */}
          <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 text-sm px-1">
            <div className="flex gap-2"><span className="text-text-muted min-w-[60px]">{t("material.iqcHistory.detail.item", "품목")}</span><span className="font-medium text-text">{record.itemName || record.itemCode || "-"}</span></div>
            <div className="flex gap-2"><span className="text-text-muted min-w-[60px]">{t("material.iqcHistory.arrivalNo", "입하번호")}</span><span className="font-mono text-text">{record.arrivalNo || "-"}</span></div>
            <div className="flex gap-2"><span className="text-text-muted min-w-[60px]">{t("material.iqcHistory.detail.judge", "판정")}</span>{resultBadge(record.result)}</div>
            <div className="flex gap-2"><span className="text-text-muted min-w-[60px]">{t("material.iqcHistory.inspectType", "검사유형")}</span><span className="text-text">{record.inspectType || "-"}</span></div>
            <div className="flex gap-2"><span className="text-text-muted min-w-[60px]">{t("material.iqcHistory.inspector", "검사자")}</span><span className="text-text">{record.inspectorName || "-"}</span></div>
            <div className="flex gap-2"><span className="text-text-muted min-w-[60px]">{t("common.remark")}</span><span className="text-text">{record.remark || "-"}</span></div>
          </div>

          <div className="border-t border-border" />

          {/* 검사항목별 판정 (검사항목별 AQL 모델) */}
          {itemResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">{t("material.iqcHistory.detail.itemJudgeTitle", "검사항목별 판정")} ({itemResults.length})</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.inspectItem", "검사항목")}</th>
                      <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.defectGrade", "불량등급")}</th>
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.inspectType", "검사유형")}</th>
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.requiredInspected", "요구/검사")}</th>
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.inspectLevel", "검사수준")}</th>
                      <th className="text-right px-2 py-1.5 font-medium text-text-muted">AQL</th>
                      <th className="text-right px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.defectCount", "불량수")}</th>
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">Ac/Re</th>
                      <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.judge", "판정")}</th>
                      <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.reason", "사유")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemResults.map((r, idx) => (
                      <tr key={r.inspItemCode ?? idx} className="border-t border-border hover:bg-surface/50">
                        <td className="px-2 py-1.5 font-medium text-text">{r.inspItemCode || "-"}</td>
                        <td className="px-2 py-1.5">
                          {r.defectGrade ? <ComCodeBadge groupCode="DEFECT_GRADE" code={r.defectGrade} /> : <span className="text-text-muted">-</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {r.inspectionType && r.inspectionType !== 'AQL'
                            ? <ComCodeBadge groupCode="IQC_ITEM_INSP_TYPE" code={r.inspectionType} />
                            : <span className="text-text-muted">AQL</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-text-muted">
                          {r.requiredQty != null ? `${r.inspectedQty ?? '-'}/${r.requiredQty}` : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center text-text">{r.inspectionLevel || "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text">{r.aql ?? "-"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text">{r.defectCount ?? 0}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-text-muted">
                          {r.acceptQty != null ? `${r.acceptQty}/${r.rejectQty}` : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-center">{resultBadge(r.result)}</td>
                        <td className="px-2 py-1.5 text-text-muted">{r.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 시리얼 상세 */}
          {serials.length > 0 ? (
            <div className="flex gap-3 min-h-0" style={{ height: "480px" }}>
              {/* 시리얼 목록 */}
              <div className="w-52 flex-shrink-0 flex flex-col border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-surface border-b border-border text-xs font-semibold text-text-muted">
                  {t("material.iqcHistory.detail.serial", "시리얼")} ({serials.length})
                </div>
                <div className="overflow-y-auto flex-1">
                  {serials.map((s, i) => (
                    <button
                      key={s.matUid}
                      type="button"
                      onClick={() => setSelectedSerial(s.matUid)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left border-b border-border hover:bg-surface text-xs ${
                        activeSerial === s.matUid ? "bg-primary/10" : ""
                      }`}
                    >
                      <span>
                        <span className="text-text-muted">{i + 1}. </span>
                        <span className="font-mono text-text">{s.matUid}</span>
                      </span>
                      {resultBadge(s.result)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 검사항목 테이블 */}
              <div className="flex-1 border border-border rounded-lg overflow-hidden flex flex-col">
                {activeEntry ? (
                  <>
                    <div className="px-3 py-2 bg-surface border-b border-border text-xs font-semibold text-text-muted flex items-center justify-between">
                      <span className="font-mono">{activeEntry.matUid}</span>
                      {resultBadge(activeEntry.result)}
                    </div>
                    {activeEntry.items && activeEntry.items.length > 0 ? (
                      <div className="overflow-y-auto flex-1">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-surface border-b border-border">
                            <tr>
                              <th className="text-left px-2 py-1.5 font-medium text-text-muted">#</th>
                              <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.inspectItem", "검사항목")}</th>
                              <th className="text-left px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.spec", "규격")}</th>
                              <th className="text-right px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.lsl", "하한")}</th>
                              <th className="text-right px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.usl", "상한")}</th>
                              <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.measuredValue", "측정값")}</th>
                              <th className="text-center px-2 py-1.5 font-medium text-text-muted">{t("material.iqcHistory.detail.judge", "판정")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeEntry.items.map((item, idx) => (
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
                                  {item.judge === "PASS" && <CheckCircle className="w-4 h-4 text-green-500 inline" />}
                                  {item.judge === "FAIL" && <XCircle className="w-4 h-4 text-red-500 inline" />}
                                  {(!item.judge || (item.judge !== "PASS" && item.judge !== "FAIL")) && <span className="text-text-muted">-</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
                        {t("material.iqcHistory.detail.noItemValues", "항목별 측정값 없음 (수동 판정)")}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-text-muted">
                    {t("material.iqcHistory.detail.selectSerial", "시리얼을 선택하세요.")}
                  </div>
                )}
              </div>
            </div>
          ) : barcodes.length > 0 ? (
            /* details 없고 sampleBarcode만 있는 경우 */
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">{t("material.iqcHistory.detail.scanSerial", "스캔 시리얼")} ({barcodes.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {barcodes.map((b) => (
                  <span key={b} className="px-2 py-0.5 rounded bg-surface border border-border text-xs font-mono text-text">{b}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-6">{t("material.iqcHistory.detail.noData", "상세 검사 데이터가 없습니다.")}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
