"use client";

/**
 * @file quality/ncr/components/NcrPrintModal.tsx
 * @description 부적합 보고서 A4 출력 — 발행/대상/부적합 내용/처리방안/원인·재발방지/결재란.
 *              window.print + @media print(A4 세로). 서버 호출 없이 목록이 보유한 레코드만 쓴다.
 *
 * 초보자 가이드:
 * 1. 인쇄는 화면 전체를 숨기고 ncr-print-area 영역만 보이게 하는 방식이다(IQC 성적서와 동일).
 * 2. 처리방안은 5종을 모두 찍고 확정된 것에만 채운다 — 종이 양식 그대로 읽히게 하려는 것.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { useComCodeLabel } from "@/hooks/useComCode";
import { NCR_DISPOSITION_CODES, type NcrReport } from "../types";

interface Props {
  record: NcrReport | null;
  onClose: () => void;
}

const PRINT_AREA_ID = "ncr-print-area";

const TH = "border border-black bg-gray-100 px-2 py-1 text-left font-semibold";
const TD = "border border-black px-2 py-1";

const fmtDate = (v?: string | null) => (v ? String(v).slice(0, 10) : "-");
const fmtNum = (v?: number | null) => (v === null || v === undefined ? "-" : v.toLocaleString());

export default function NcrPrintModal({ record, onClose }: Props) {
  const { t } = useTranslation();

  const targetTypeLabel = useComCodeLabel("NCR_TARGET_TYPE", record?.targetType ?? "");
  const foundStageLabel = useComCodeLabel("NCR_FOUND_STAGE", record?.foundStage ?? "");
  const gradeLabel = useComCodeLabel("DEFECT_GRADE", record?.defectGrade ?? "");
  const causeLabel = useComCodeLabel("NCR_CAUSE_CATEGORY", record?.causeCategory ?? "");
  const statusLabel = useComCodeLabel("NCR_STATUS", record?.status ?? "");

  // 출력일시는 모달이 열릴 때(레코드가 바뀔 때) 고정한다
  const printedAt = useMemo(() => (record ? new Date().toLocaleString() : ""), [record]);

  return (
    <Modal
      isOpen={!!record}
      onClose={onClose}
      title={t("quality.ncr.print.modalTitle", "부적합 보고서 출력")}
      size="xl"
    >
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={() => window.print()} disabled={!record}>
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>

      {record && (
        <div id={PRINT_AREA_ID} className="bg-white text-black p-2 text-[12px] leading-relaxed">
          {/* 제목 */}
          <div className="flex items-end justify-between border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-2xl font-bold tracking-[0.25em]">
                {t("quality.ncr.print.title", "부적합 보고서")}
              </h1>
              <div className="text-[11px] text-gray-700 mt-0.5">Nonconformance Report</div>
            </div>
            <div className="text-right text-[11px]">
              <div>
                {t("quality.ncr.ncrNo", "NCR 번호")}:{" "}
                <span className="font-mono font-semibold">{record.ncrNo}</span>
              </div>
              <div>{t("quality.ncr.print.printedAt", "출력일시")}: {printedAt}</div>
            </div>
          </div>

          {/* 발행 정보 */}
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.issuedAt", "발행일")}</th>
                <td className={TD}>{fmtDate(record.issuedAt)}</td>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.issueDept", "발행부서")}</th>
                <td className={TD}>{record.issueDept || "-"}</td>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.dueDate", "회신요구일")}</th>
                <td className={TD}>{fmtDate(record.dueDate)}</td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.targetType", "대상구분")}</th>
                <td className={TD}>{record.targetType ? targetTypeLabel : "-"}</td>
                <th className={TH}>{t("quality.ncr.foundStage", "발견단계")}</th>
                <td className={TD}>{record.foundStage ? foundStageLabel : "-"}</td>
                <th className={TH}>{t("common.status", "상태")}</th>
                <td className={`${TD} font-semibold`}>{record.status ? statusLabel : "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* 대상 */}
          <div className="font-bold mb-1 text-[13px]">
            ■ {t("quality.ncr.print.targetSection", "부적합 대상")}
          </div>
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <th className={`${TH} w-[90px]`}>{t("common.partCode", "품번")}</th>
                <td className={`${TD} font-mono`}>{record.itemCode || "-"}</td>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.lotNo", "로트번호")}</th>
                <td className={`${TD} font-mono`}>{record.lotNo || "-"}</td>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.serialNo", "시리얼")}</th>
                <td className={`${TD} font-mono`}>{record.serialNo || "-"}</td>
              </tr>
              <tr>
                <th className={TH}>{t("production.result.orderNo", "작업지시")}</th>
                <td className={`${TD} font-mono`}>{record.orderNo || "-"}</td>
                <th className={TH}>P/O No</th>
                <td className={`${TD} font-mono`}>{record.poNo || "-"}</td>
                <th className={TH}>{t("quality.ncr.vendorCode", "공급업체")}</th>
                <td className={TD}>{record.vendorCode || "-"}</td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.inspectQty", "검사수량")}</th>
                <td className={`${TD} text-right tabular-nums`}>{fmtNum(record.inspectQty)}</td>
                <th className={TH}>{t("quality.ncr.defectQty", "불량수량")}</th>
                <td className={`${TD} text-right tabular-nums font-semibold`}>{fmtNum(record.defectQty)}</td>
                <th className={TH}>{t("quality.ncr.defectGrade", "결함구분")}</th>
                <td className={`${TD} font-semibold`}>{record.defectGrade ? gradeLabel : "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* 부적합 내용 */}
          <div className="font-bold mb-1 text-[13px]">
            ■ {t("quality.ncr.print.contentSection", "부적합 내용")}
          </div>
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.defectCode", "부적합명")}</th>
                <td className={TD}>{record.defectCode || "-"}</td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.description", "부적합 현상")}</th>
                <td className={`${TD} whitespace-pre-wrap align-top h-[80px]`}>
                  {record.description || ""}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 처리방안 — 5종을 모두 찍고 확정된 것만 채운다 */}
          <div className="font-bold mb-1 text-[13px]">
            ■ {t("quality.ncr.print.dispositionSection", "처리방안")}
          </div>
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.disposition", "처리방안")}</th>
                <td className={TD} colSpan={3}>
                  <div className="flex flex-wrap gap-4">
                    {NCR_DISPOSITION_CODES.map((code) => (
                      <span key={code} className={record.disposition === code ? "font-bold" : ""}>
                        {record.disposition === code ? "■" : "□"}{" "}
                        {t(`comCode.NCR_DISPOSITION.${code}`, code)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.dispositionDetail", "세부내용 및 사유")}</th>
                <td className={`${TD} whitespace-pre-wrap align-top h-[60px]`} colSpan={3}>
                  {record.dispositionDetail || ""}
                </td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.dueActionDate", "처리기한")}</th>
                <td className={TD}>{fmtDate(record.dueActionDate)}</td>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.responsibleCode", "처리 책임자")}</th>
                <td className={TD}>{record.responsibleCode || "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* 원인·재발방지 */}
          <div className="font-bold mb-1 text-[13px]">
            ■ {t("quality.ncr.print.causeSection", "발생 원인 및 재발방지 대책")}
          </div>
          <table className="w-full border-collapse mb-3">
            <tbody>
              <tr>
                <th className={`${TH} w-[90px]`}>{t("quality.ncr.causeCategory", "원인분류")}</th>
                <td className={TD}>{record.causeCategory ? causeLabel : "-"}</td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.rootCause", "발생 원인")}</th>
                <td className={`${TD} whitespace-pre-wrap align-top h-[70px]`}>
                  {record.rootCause || ""}
                </td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.preventiveAction", "재발방지 대책")}</th>
                <td className={`${TD} whitespace-pre-wrap align-top h-[70px]`}>
                  {record.preventiveAction || ""}
                </td>
              </tr>
              <tr>
                <th className={TH}>{t("quality.ncr.capaNo", "시정조치(CAPA)")}</th>
                <td className={`${TD} font-mono`}>{record.capaNo || "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* 결재란 */}
          <table className="w-full border-collapse mt-6 text-[11px] break-inside-avoid">
            <tbody>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">
                  {t("quality.ncr.print.writer", "작성자")}
                </th>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">
                  {t("quality.ncr.print.reviewer", "검토자")}
                </th>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">
                  {t("quality.ncr.print.approver", "승인자")}
                </th>
              </tr>
              <tr>
                <td className="border border-black px-2 py-6 text-center align-bottom">{record.writerCode || ""}</td>
                <td className="border border-black px-2 py-6 text-center align-bottom">{record.responsibleCode || ""}</td>
                <td className="border border-black px-2 py-6 text-center align-bottom">{record.approverCode || ""}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-right text-[10px] text-gray-700 mt-2">
            {t("quality.ncr.print.printedAt", "출력일시")}: {printedAt}
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #${PRINT_AREA_ID}, #${PRINT_AREA_ID} * { visibility: visible; }
          #${PRINT_AREA_ID} { position: absolute; top: 0; left: 0; width: 100%; }
          /* 모달 크롬(fixed 래퍼·스크롤 영역)이 다중 페이지를 잘라내지 않도록 보고서가 열린 동안만 해제 */
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
