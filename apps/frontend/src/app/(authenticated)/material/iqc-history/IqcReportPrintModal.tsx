"use client";

/**
 * @file material/iqc-history/IqcReportPrintModal.tsx
 * @description 수입검사(IQC) 성적서 A4 출력 — 머리(품목/입하/거래처/검사자/판정) + AQL 요약 +
 *              시리얼별 검사항목 측정값 표 + 서명란 + 출력일시. window.print + @media print(A4).
 *              서버 호출 없이 이력 그리드/상세 모달이 보유한 IQC_LOGS 레코드(DETAILS·ITEM_RESULTS JSON)만 사용한다.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { useComCodeLabel } from "@/hooks/useComCode";
import {
  parseIqcDetails,
  parseIqcItemResults,
  parseSampleBarcodes,
  type IqcDetailRecord,
} from "./iqcDetailTypes";

interface Props {
  record: IqcDetailRecord | null;
  onClose: () => void;
}

const PRINT_AREA_ID = "iqc-report-print-area";

const fmtDateTime = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
};

const fmtNum = (v?: number | null) => (v === null || v === undefined ? "-" : v.toLocaleString());

const fmtAcRe = (ac?: number | null, re?: number | null) =>
  ac === null || ac === undefined ? "-" : `${ac} / ${re ?? "-"}`;

const TH = "border border-black bg-gray-100 px-2 py-1 text-left font-semibold";
const TD = "border border-black px-2 py-1";

export default function IqcReportPrintModal({ record, onClose }: Props) {
  const { t } = useTranslation();

  const inspectTypeLabel = useComCodeLabel("IQC_INSPECT_TYPE", record?.inspectType ?? "");
  const resultLabel = useComCodeLabel("INSPECT_RESULT", record?.result ?? "");

  const details = useMemo(() => parseIqcDetails(record?.details), [record?.details]);
  const serials = details?.serials ?? [];
  const itemResults = useMemo(() => parseIqcItemResults(record?.itemResults), [record?.itemResults]);
  const barcodes = useMemo(() => parseSampleBarcodes(record?.sampleBarcode), [record?.sampleBarcode]);

  // 출력일시: 모달이 열릴 때(레코드가 바뀔 때) 고정
  const printedAt = useMemo(() => (record ? new Date().toLocaleString() : ""), [record]);

  const hasAql = !!(
    record?.aqlInspectionLevel ||
    record?.aqlSampleQty ||
    record?.aqlMajorCode ||
    record?.aqlMinorCode ||
    record?.aqlJudgeReason
  );

  const judgeText = (v?: string) => {
    if (v === "PASS") return t("material.iqcHistory.pass", "합격");
    if (v === "FAIL") return t("material.iqcHistory.fail", "불합격");
    return v || "-";
  };

  const handlePrint = () => window.print();

  return (
    <Modal
      isOpen={!!record}
      onClose={onClose}
      title={t("material.iqcHistory.report.modalTitle", "IQC 성적서 출력")}
      size="xl"
    >
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={handlePrint} disabled={!record}>
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>

      {record && (
        <div id={PRINT_AREA_ID} className="bg-white text-black p-2 text-[12px] leading-relaxed">
          {/* 제목 */}
          <div className="flex items-end justify-between border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-2xl font-bold tracking-[0.25em]">
                {t("material.iqcHistory.report.title", "수입검사 성적서")}
              </h1>
              <div className="text-[11px] text-gray-700 mt-0.5">IQC Inspection Report</div>
            </div>
            <div className="text-right text-[11px]">
              <div>
                {t("material.iqcHistory.arrivalNo", "입하번호")}:{" "}
                <span className="font-mono font-semibold">{record.arrivalNo || "-"}</span>
              </div>
              <div>
                {t("material.iqcHistory.report.printedAt", "출력일시")}: {printedAt}
              </div>
            </div>
          </div>

          {/* 머리 정보 */}
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <th className={`${TH} w-[100px]`}>{t("common.partCode", "품목코드")}</th>
                <td className={`${TD} font-mono`}>{record.itemCode || "-"}</td>
                <th className={`${TH} w-[100px]`}>{t("common.partName", "품목명")}</th>
                <td className={TD} colSpan={3}>{record.itemName || "-"}</td>
              </tr>
              <tr>
                <th className={TH}>{t("material.iqcHistory.report.vendor", "거래처")}</th>
                <td className={TD}>
                  {record.vendorName || record.vendorCode || "-"}
                  {record.vendorName && record.vendorCode ? (
                    <span className="font-mono text-gray-600"> ({record.vendorCode})</span>
                  ) : null}
                </td>
                <th className={`${TH} w-[100px]`}>{t("material.iqcHistory.report.lotQty", "LOT 수량")}</th>
                <td className={`${TD} text-right tabular-nums`}>
                  {fmtNum(record.lotQty)} {record.unit ?? ""}
                </td>
                <th className={`${TH} w-[100px]`}>LOT No.</th>
                <td className={`${TD} font-mono`}>{record.matUid || "-"}</td>
              </tr>
              <tr>
                <th className={TH}>{t("material.iqcHistory.inspectDate", "검사일시")}</th>
                <td className={TD}>{fmtDateTime(record.inspectDate)}</td>
                <th className={TH}>{t("material.iqcHistory.inspector", "검사자")}</th>
                <td className={TD}>{record.inspectorName || "-"}</td>
                <th className={TH}>{t("material.iqcHistory.inspectType", "검사유형")}</th>
                <td className={TD}>
                  {record.inspectType ? inspectTypeLabel : "-"}
                  {record.retestRound ? ` (${t("material.iqcHistory.report.retestRound", "재검 {{round}}차", { round: record.retestRound })})` : ""}
                </td>
              </tr>
              <tr>
                <th className={TH}>{t("material.iqcHistory.report.inspectClass", "검사구분")}</th>
                <td className={TD}>{record.inspectClass || "-"}</td>
                <th className={TH}>{t("material.iqcHistory.detail.judge", "판정")}</th>
                <td className={`${TD} font-bold text-[14px]`}>
                  {record.result ? resultLabel : "-"}
                </td>
                <th className={TH}>{t("common.remark", "비고")}</th>
                <td className={TD}>{record.remark || "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* AQL 요약 */}
          <div className="font-bold mb-1 text-[13px]">■ {t("material.iqcHistory.report.aqlSummary", "AQL 요약")}</div>
          {hasAql ? (
            <table className="w-full border-collapse mb-3">
              <tbody>
                <tr>
                  <th className={`${TH} w-[100px]`}>{t("material.iqcHistory.detail.inspectLevel", "검사수준")}</th>
                  <td className={TD}>
                    {record.aqlInspectionLevel || "-"}
                    {record.aqlInspectionMode ? <span className="text-gray-600"> / {record.aqlInspectionMode}</span> : null}
                  </td>
                  <th className={`${TH} w-[100px]`}>{t("material.iqcHistory.report.sampleQty", "시료수")}</th>
                  <td className={`${TD} text-right tabular-nums`}>{fmtNum(record.aqlSampleQty)}</td>
                  <th className={`${TH} w-[100px]`}>{t("material.iqcHistory.report.defectCounts", "불량수 (C/Ma/Mi)")}</th>
                  <td className={`${TD} text-right tabular-nums`}>
                    {fmtNum(record.defectCritical ?? 0)} / {fmtNum(record.defectMajor ?? 0)} / {fmtNum(record.defectMinor ?? 0)}
                  </td>
                </tr>
                <tr>
                  <th className={TH}>Major AQL</th>
                  <td className={TD}>{record.aqlMajorCode || "-"}</td>
                  <th className={TH}>Major Ac / Re</th>
                  <td className={`${TD} text-right tabular-nums`} colSpan={3}>{fmtAcRe(record.aqlMajorAc, record.aqlMajorRe)}</td>
                </tr>
                <tr>
                  <th className={TH}>Minor AQL</th>
                  <td className={TD}>{record.aqlMinorCode || "-"}</td>
                  <th className={TH}>Minor Ac / Re</th>
                  <td className={`${TD} text-right tabular-nums`} colSpan={3}>{fmtAcRe(record.aqlMinorAc, record.aqlMinorRe)}</td>
                </tr>
                <tr>
                  <th className={TH}>{t("material.iqcHistory.report.judgeReason", "판정 근거")}</th>
                  <td className={TD} colSpan={5}>{record.aqlJudgeReason || "-"}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="border border-black px-2 py-2 mb-3 text-gray-700">
              {t("material.iqcHistory.report.noAql", "AQL 샘플링 정보가 없습니다 (수동 판정).")}
            </p>
          )}

          {/* 검사항목별 판정 (ITEM_RESULTS) */}
          {itemResults.length > 0 && (
            <>
              <div className="font-bold mb-1 text-[13px]">■ {t("material.iqcHistory.detail.itemJudgeTitle", "검사항목별 판정")}</div>
              <table className="w-full border-collapse mb-3 text-[11px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-1 py-1 w-[32px]">No</th>
                    <th className="border border-black px-2 py-1">{t("material.iqcHistory.detail.inspectItem", "검사항목")}</th>
                    <th className="border border-black px-2 py-1 w-[70px]">{t("material.iqcHistory.detail.defectGrade", "불량등급")}</th>
                    <th className="border border-black px-2 py-1 w-[70px]">{t("material.iqcHistory.detail.requiredInspected", "요구/검사")}</th>
                    <th className="border border-black px-2 py-1 w-[60px]">{t("material.iqcHistory.detail.inspectLevel", "검사수준")}</th>
                    <th className="border border-black px-2 py-1 w-[50px]">AQL</th>
                    <th className="border border-black px-2 py-1 w-[50px]">{t("material.iqcHistory.detail.defectCount", "불량수")}</th>
                    <th className="border border-black px-2 py-1 w-[56px]">Ac/Re</th>
                    <th className="border border-black px-2 py-1 w-[56px]">{t("material.iqcHistory.detail.judge", "판정")}</th>
                    <th className="border border-black px-2 py-1">{t("material.iqcHistory.detail.reason", "사유")}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemResults.map((r, idx) => (
                    <tr key={r.inspItemCode ?? idx}>
                      <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                      <td className="border border-black px-2 py-1">{r.inspItemCode || "-"}</td>
                      <td className="border border-black px-2 py-1 text-center">{r.defectGrade || "-"}</td>
                      <td className="border border-black px-2 py-1 text-center tabular-nums">
                        {r.requiredQty != null ? `${r.inspectedQty ?? "-"}/${r.requiredQty}` : "-"}
                      </td>
                      <td className="border border-black px-2 py-1 text-center">{r.inspectionLevel || "-"}</td>
                      <td className="border border-black px-2 py-1 text-right tabular-nums">{r.aql ?? "-"}</td>
                      <td className="border border-black px-2 py-1 text-right tabular-nums">{r.defectCount ?? 0}</td>
                      <td className="border border-black px-2 py-1 text-center tabular-nums">
                        {r.acceptQty != null ? `${r.acceptQty}/${r.rejectQty ?? "-"}` : "-"}
                      </td>
                      <td className="border border-black px-2 py-1 text-center font-semibold">{judgeText(r.result)}</td>
                      <td className="border border-black px-2 py-1">{r.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 시리얼별 검사항목 측정값 */}
          <div className="font-bold mb-1 text-[13px]">
            ■ {t("material.iqcHistory.report.serialItems", "시리얼별 검사항목 측정값")}
            {serials.length > 0 ? ` (${serials.length})` : ""}
          </div>
          {serials.length > 0 ? (
            serials.map((s, sIdx) => (
              <div key={s.matUid} className="mb-3 break-inside-avoid">
                <div className="flex items-center justify-between border border-black border-b-0 bg-gray-100 px-2 py-1 text-[11px]">
                  <span>
                    <span className="font-semibold">{sIdx + 1}. </span>
                    <span className="font-mono">{s.matUid}</span>
                    {s.qty != null ? <span className="text-gray-700"> · {t("common.qty", "수량")} {fmtNum(s.qty)}</span> : null}
                  </span>
                  <span className="font-semibold">{judgeText(s.result)}</span>
                </div>
                {s.items && s.items.length > 0 ? (
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-black px-1 py-1 w-[32px]">No</th>
                        <th className="border border-black px-2 py-1">{t("material.iqcHistory.detail.inspectItem", "검사항목")}</th>
                        <th className="border border-black px-2 py-1 w-[120px]">{t("material.iqcHistory.detail.spec", "규격")}</th>
                        <th className="border border-black px-2 py-1 w-[60px]">{t("material.iqcHistory.detail.lsl", "하한")}</th>
                        <th className="border border-black px-2 py-1 w-[60px]">{t("material.iqcHistory.detail.usl", "상한")}</th>
                        <th className="border border-black px-2 py-1 w-[44px]">{t("common.unit", "단위")}</th>
                        <th className="border border-black px-2 py-1 w-[80px]">{t("material.iqcHistory.detail.measuredValue", "측정값")}</th>
                        <th className="border border-black px-2 py-1 w-[56px]">{t("material.iqcHistory.detail.judge", "판정")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.items.map((item, idx) => (
                        <tr key={item.itemId ?? idx}>
                          <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                          <td className="border border-black px-2 py-1">{item.inspectItem}</td>
                          <td className="border border-black px-2 py-1">{item.spec || "-"}</td>
                          <td className="border border-black px-2 py-1 text-right tabular-nums">{fmtNum(item.lsl)}</td>
                          <td className="border border-black px-2 py-1 text-right tabular-nums">{fmtNum(item.usl)}</td>
                          <td className="border border-black px-2 py-1 text-center">{item.unit || "-"}</td>
                          <td className="border border-black px-2 py-1 text-right tabular-nums font-semibold">{item.measuredValue || "-"}</td>
                          <td className="border border-black px-2 py-1 text-center font-semibold">{judgeText(item.judge)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="border border-black px-2 py-2 text-gray-700">
                    {t("material.iqcHistory.detail.noItemValues", "항목별 측정값 없음 (수동 판정)")}
                  </div>
                )}
              </div>
            ))
          ) : barcodes.length > 0 ? (
            <table className="w-full border-collapse mb-3 text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-1 py-1 w-[32px]">No</th>
                  <th className="border border-black px-2 py-1 text-left">{t("material.iqcHistory.detail.scanSerial", "스캔 시리얼")}</th>
                </tr>
              </thead>
              <tbody>
                {barcodes.map((b, idx) => (
                  <tr key={b}>
                    <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                    <td className="border border-black px-2 py-1 font-mono">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="border border-black px-2 py-2 mb-3 text-gray-700">
              {t("material.iqcHistory.detail.noData", "상세 검사 데이터가 없습니다.")}
            </p>
          )}

          {/* 서명란 */}
          <table className="w-full border-collapse mt-6 text-[11px] break-inside-avoid">
            <tbody>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("material.iqcHistory.inspector", "검사자")}</th>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("material.iqcHistory.report.reviewer", "검토자")}</th>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("material.iqcHistory.report.approver", "승인자")}</th>
              </tr>
              <tr>
                <td className="border border-black px-2 py-6 text-center align-bottom">{record.inspectorName || ""}</td>
                <td className="border border-black px-2 py-6"></td>
                <td className="border border-black px-2 py-6"></td>
              </tr>
            </tbody>
          </table>

          <div className="text-right text-[10px] text-gray-700 mt-2">
            {t("material.iqcHistory.report.printedAt", "출력일시")}: {printedAt}
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #${PRINT_AREA_ID}, #${PRINT_AREA_ID} * { visibility: visible; }
          #${PRINT_AREA_ID} { position: absolute; top: 0; left: 0; width: 100%; }
          /* 모달 크롬(fixed 래퍼·스크롤 영역)이 다중 페이지를 잘라내지 않도록 성적서가 열린 동안만 해제 */
          body:has(#${PRINT_AREA_ID}) .fixed { position: static !important; }
          body:has(#${PRINT_AREA_ID}) .overflow-y-auto { overflow: visible !important; max-height: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>

      <div className="flex justify-end pt-4 border-t border-border mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
