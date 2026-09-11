"use client";

/**
 * @file src/components/material/IqcRequestPrintModal.tsx
 * @description 수입검사(IQC) 검사의뢰서 A4 출력 모달 — 입하관리(본 발행)·입하실적조회/수입검사(재발행) 공용.
 *              대상(입하번호+품목) 여러 건을 받으면 장 단위(page-break)로 연속 출력한다.
 *
 * 초보자 가이드:
 * 1. 각 장의 머리 정보는 검사대기 목록과 같은 API(/material/iqc-history/pending-arrivals?iqcStatus=&search=입하번호)에서
 *    받아 useIqcData의 매핑(단일 출처)으로 IqcItem을 만든다. 대상의 검사상태를 모르면 request-lookup으로 먼저 해석한다.
 *    검사 완료(PASS/FAIL) 건도 재발행할 수 있으며, 그 경우 머리에 재발행·검사상태를 표기한다.
 * 2. 검사항목은 IqcModal과 같은 /master/iqc-part-specs/:itemCode/resolve-items, AQL은 /quality/aql/resolve-iqc-items.
 * 3. 입하번호·시리얼은 Code128 바코드로 인쇄 → 검사 시 IqcModal에서 그대로 스캔 가능.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import api from "@/services/api";
import { useComCodeMap } from "@/hooks/useComCode";
import { mapPendingGroupToIqcItem, type IqcItem } from "@/hooks/material/useIqcData";
import type { IqcRequestTarget } from "@/hooks/material/useIqcRequestPrint";
import BarcodeCanvas from "@/app/(authenticated)/master/label/components/BarcodeCanvas";

interface Props {
  targets: IqcRequestTarget[];
  onClose: () => void;
}

/** /material/arrivals/results/:arrivalNo/serials 행 (입하 그룹의 원본 시리얼, 취소 포함) */
interface ArrivalSerial {
  matUid: string;
  qty: number;
  iqcStatus: string | null;
  stockInYn: 'Y' | 'N';
  cancelYn: 'Y' | 'N';
}

interface InspectItemRow {
  seq: number;
  inspectItem: string;
  spec: string | null;
  lsl: number | null;
  usl: number | null;
  unit: string | null;
  judgeCriteria: string | null;
  defectGrade?: string | null;
  inspectionType?: string | null;
  aql?: number | null;
}

interface AqlPolicy {
  sampleQty: number;
  inspectionLevel: string;
  inspectionMode: string;
}

/** 의뢰서 1장 분량의 데이터 */
interface RequestSheet {
  target: IqcRequestTarget;
  item: IqcItem | null;
  /** 해석된 검사상태 (PENDING/PASS/FAIL) */
  iqcStatus: string | null;
  serials: ArrivalSerial[];
  inspectItems: InspectItemRow[];
  aqlPolicy: AqlPolicy | null;
}

const PRINT_AREA_ID = "iqc-request-print-area";

const fmtDate = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE").format(d);
};
const fmtNum = (v?: number | null) => (v === null || v === undefined ? "-" : v.toLocaleString());

const TH = "border border-black bg-gray-100 px-2 py-1 text-left font-semibold";
const TD = "border border-black px-2 py-1";

/** 대상의 검사상태를 모르면(입하 직후 등) 서버 해석으로 보강한다. 취소·미존재면 null. */
async function resolveIqcStatus(target: IqcRequestTarget): Promise<string | null> {
  if (target.iqcStatus) return target.iqcStatus;
  try {
    const res = await api.get("/material/iqc-history/request-lookup", { params: { barcode: target.arrivalNo } });
    const groups: Array<{ arrivalNo: string; itemCode: string; iqcStatus: string | null }> = res.data?.data?.groups ?? [];
    return groups.find((g) => g.arrivalNo === target.arrivalNo && g.itemCode === target.itemCode)?.iqcStatus ?? null;
  } catch {
    return null;
  }
}

async function loadSheet(target: IqcRequestTarget): Promise<RequestSheet> {
  const iqcStatus = await resolveIqcStatus(target);
  const [groupRes, serialRes, itemsRes] = await Promise.allSettled([
    api.get("/material/iqc-history/pending-arrivals", { params: { iqcStatus: iqcStatus ?? "PENDING", search: target.arrivalNo } }),
    api.get(`/material/arrivals/results/${encodeURIComponent(target.arrivalNo)}/serials`, { params: { itemCode: target.itemCode } }),
    api.get(`/master/iqc-part-specs/${encodeURIComponent(target.itemCode)}/resolve-items`),
  ]);
  const groups: Array<Record<string, unknown>> = groupRes.status === "fulfilled" ? (groupRes.value.data?.data ?? []) : [];
  const group = groups.find((g) => g.arrivalNo === target.arrivalNo && g.itemCode === target.itemCode);
  const item = group ? mapPendingGroupToIqcItem(group) : null;
  const allSerials: ArrivalSerial[] = serialRes.status === "fulfilled" ? (serialRes.value.data?.data ?? []) : [];

  let aqlPolicy: AqlPolicy | null = null;
  if (item) {
    try {
      const aqlRes = await api.get("/quality/aql/resolve-iqc-items", {
        params: { itemCode: item.itemCode, vendorCode: item.vendorCode, lotQty: item.totalQty },
      });
      aqlPolicy = aqlRes.data?.data ?? null;
    } catch {
      aqlPolicy = null;
    }
  }
  return {
    target,
    item,
    iqcStatus,
    serials: allSerials.filter((s) => s.cancelYn !== 'Y'),
    inspectItems: itemsRes.status === "fulfilled" ? (itemsRes.value.data?.data ?? []) : [],
    aqlPolicy,
  };
}

export default function IqcRequestPrintModal({ targets, onClose }: Props) {
  const { t } = useTranslation();
  const [sheets, setSheets] = useState<RequestSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const methodMap = useComCodeMap("IQC_INSPECT_METHOD");
  const iqcStatusMap = useComCodeMap("IQC_STATUS");
  const isOpen = targets.length > 0;

  // 출력일시: 모달이 열릴 때(대상이 바뀔 때) 고정
  const printedAt = useMemo(() => (isOpen ? new Date().toLocaleString() : ""), [isOpen]);
  const targetKey = targets.map((x) => `${x.arrivalNo}::${x.itemCode}`).join("|");

  useEffect(() => {
    if (!isOpen) {
      setSheets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(targets.map(loadSheet))
      .then((loaded) => { if (!cancelled) setSheets(loaded); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // targets 배열 참조가 아니라 내용(targetKey)이 바뀔 때만 다시 조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetKey]);

  const handlePrint = () => window.print();
  const printableCount = sheets.filter((s) => s.item).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("material.iqc.request.modalTitle", "IQC 검사의뢰서 출력")}
      size="xl"
    >
      <div className="flex items-center justify-between mb-2 print:hidden">
        <span className="text-sm text-text-muted">
          {t("material.iqc.request.sheetCount", "출력 대상 {{count}}장", { count: printableCount })}
        </span>
        <Button onClick={handlePrint} disabled={loading || printableCount === 0}
          disabledReason={loading ? t("common.loading", "불러오는 중...") : t("material.iqc.request.nothingToPrint", "출력할 입하 건이 없습니다.")}>
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>

      {isOpen && (
        <div id={PRINT_AREA_ID} className="bg-white text-black p-2 text-[12px] leading-relaxed">
          {sheets.map((sheet, sheetIdx) => {
            const { target, item, iqcStatus, serials, inspectItems, aqlPolicy } = sheet;
            const isReissue = !!iqcStatus && iqcStatus !== "PENDING";
            return (
              <section
                key={`${target.arrivalNo}::${target.itemCode}`}
                className={sheetIdx < sheets.length - 1 ? "break-after-page mb-8" : ""}
              >
                {/* 제목 + 입하번호 바코드 */}
                <div className="flex items-end justify-between border-b-2 border-black pb-2 mb-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-[0.25em]">
                      {t("material.iqc.request.title", "수입검사 의뢰서")}
                    </h1>
                    <div className="text-[11px] text-gray-700 mt-0.5">
                      IQC Inspection Request
                      {isReissue && (
                        <span className="ml-2 rounded border border-black px-1.5 py-px font-semibold">
                          {t("material.iqc.request.reissue", "재발행")} · {iqcStatusMap[iqcStatus!]?.codeName ?? iqcStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <div className="[&_canvas]:h-12">
                      <BarcodeCanvas value={target.arrivalNo} format="code128" />
                    </div>
                    <div>{t("material.iqc.request.printedAt", "출력일시")}: {printedAt}</div>
                  </div>
                </div>

                {!item ? (
                  <p className="border border-black px-2 py-3 mb-3 text-gray-700">
                    {loading
                      ? t("common.loading", "불러오는 중...")
                      : t("material.iqc.request.groupNotFound", "입하 건을 찾을 수 없습니다(취소되었거나 존재하지 않음): {{arrivalNo}} / {{itemCode}}", { arrivalNo: target.arrivalNo, itemCode: target.itemCode })}
                  </p>
                ) : (
                  <>
                    {/* 의뢰 정보 */}
                    <table className="w-full border-collapse mb-3">
                      <tbody>
                        <tr>
                          <th className={`${TH} w-[100px]`}>{t("material.col.arrivalNo", "입하번호")}</th>
                          <td className={`${TD} font-mono font-semibold`}>{item.arrivalNo}</td>
                          <th className={`${TH} w-[100px]`}>{t("material.col.poNo", "발주번호")}</th>
                          <td className={`${TD} font-mono`}>{item.poNo || "-"}</td>
                          <th className={`${TH} w-[100px]`}>{t("material.col.arrivalDate", "입하일")}</th>
                          <td className={TD}>{fmtDate(item.arrivalDate)}</td>
                        </tr>
                        <tr>
                          <th className={TH}>{t("common.partCode", "품목코드")}</th>
                          <td className={`${TD} font-mono`}>{item.itemCode}</td>
                          <th className={TH}>{t("common.partName", "품목명")}</th>
                          <td className={TD} colSpan={3}>{item.itemName || "-"}</td>
                        </tr>
                        <tr>
                          <th className={TH}>{t("material.col.supplier", "거래처")}</th>
                          <td className={TD}>
                            {item.supplierName || "-"}
                            {item.vendorCode ? <span className="font-mono text-gray-600"> ({item.vendorCode})</span> : null}
                          </td>
                          <th className={TH}>{t("material.iqc.totalQty", "총수량")}</th>
                          <td className={`${TD} text-right tabular-nums`}>{fmtNum(item.totalQty)} {item.unit}</td>
                          <th className={TH}>{t("material.iqc.serialCount", "시리얼수")}</th>
                          <td className={`${TD} text-right tabular-nums`}>{fmtNum(item.serialCount)}</td>
                        </tr>
                        <tr>
                          <th className={TH}>{t("material.iqc.method", "검사구분")}</th>
                          <td className={TD}>{item.inspectMethod ? (methodMap[item.inspectMethod]?.codeName ?? item.inspectMethod) : "-"}</td>
                          <th className={TH}>{t("material.iqc.request.aql", "AQL (시료수/수준/모드)")}</th>
                          <td className={TD} colSpan={3}>
                            {aqlPolicy
                              ? `${fmtNum(aqlPolicy.sampleQty)} / ${aqlPolicy.inspectionLevel} / ${aqlPolicy.inspectionMode}`
                              : t("material.iqc.request.noAql", "AQL 정책 없음 (수동 판정)")}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 대상 시리얼 목록 (입하 그룹 원본 시리얼, 취소 제외) */}
                    <div className="font-bold mb-1 text-[13px]">
                      ■ {t("material.iqc.request.serials", "대상 시리얼")} ({serials.length})
                    </div>
                    {serials.length > 0 ? (
                      <table className="w-full border-collapse mb-3 text-[11px]">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-black px-1 py-1 w-[32px]">No</th>
                            <th className="border border-black px-2 py-1 text-left">{t("material.iqc.serialNo", "시리얼")}</th>
                            <th className="border border-black px-2 py-1 w-[70px]">{t("material.iqc.qty", "수량")}</th>
                            <th className="border border-black px-2 py-1 w-[180px]">{t("material.iqc.request.barcode", "바코드")}</th>
                            <th className="border border-black px-2 py-1 w-[70px]">{t("material.iqc.request.sampleMark", "시료")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {serials.map((s, idx) => (
                            <tr key={s.matUid} className="break-inside-avoid">
                              <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                              <td className="border border-black px-2 py-1 font-mono">{s.matUid}</td>
                              <td className="border border-black px-2 py-1 text-right tabular-nums">{fmtNum(s.qty)}</td>
                              <td className="border border-black px-1 py-0.5 text-center [&_canvas]:h-8 [&_canvas]:mx-auto">
                                <BarcodeCanvas value={s.matUid} format="code128" />
                              </td>
                              <td className="border border-black px-2 py-1 text-center">☐</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="border border-black px-2 py-2 mb-3 text-gray-700">
                        {t("material.iqc.request.noSerials", "대상 시리얼이 없습니다.")}
                      </p>
                    )}

                    {/* 검사항목 (측정값·판정 공란) */}
                    <div className="font-bold mb-1 text-[13px]">
                      ■ {t("material.iqc.request.inspectItems", "검사항목")} ({inspectItems.length})
                    </div>
                    {inspectItems.length > 0 ? (
                      <table className="w-full border-collapse mb-3 text-[11px]">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-black px-1 py-1 w-[32px]">No</th>
                            <th className="border border-black px-2 py-1 text-left">{t("material.iqcHistory.detail.inspectItem", "검사항목")}</th>
                            <th className="border border-black px-2 py-1 w-[110px]">{t("material.iqcHistory.detail.spec", "규격")}</th>
                            <th className="border border-black px-2 py-1 w-[56px]">{t("material.iqcHistory.detail.lsl", "하한")}</th>
                            <th className="border border-black px-2 py-1 w-[56px]">{t("material.iqcHistory.detail.usl", "상한")}</th>
                            <th className="border border-black px-2 py-1 w-[44px]">{t("common.unit", "단위")}</th>
                            <th className="border border-black px-2 py-1 w-[60px]">{t("material.iqc.request.inspectType", "유형")}</th>
                            <th className="border border-black px-2 py-1 w-[50px]">{t("material.iqcHistory.detail.defectGrade", "등급")}</th>
                            <th className="border border-black px-2 py-1 w-[90px]">{t("material.iqcHistory.detail.measuredValue", "측정값")}</th>
                            <th className="border border-black px-2 py-1 w-[56px]">{t("material.iqcHistory.detail.judge", "판정")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectItems.map((r, idx) => (
                            <tr key={`${r.seq}-${r.inspectItem}`}>
                              <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                              <td className="border border-black px-2 py-1">
                                {r.inspectItem}
                                {r.judgeCriteria ? <div className="text-[10px] text-gray-600">{r.judgeCriteria}</div> : null}
                              </td>
                              <td className="border border-black px-2 py-1">{r.spec || "-"}</td>
                              <td className="border border-black px-2 py-1 text-right tabular-nums">{fmtNum(r.lsl)}</td>
                              <td className="border border-black px-2 py-1 text-right tabular-nums">{fmtNum(r.usl)}</td>
                              <td className="border border-black px-2 py-1 text-center">{r.unit || "-"}</td>
                              <td className="border border-black px-2 py-1 text-center">{r.inspectionType || "AQL"}</td>
                              <td className="border border-black px-2 py-1 text-center">{r.defectGrade || "-"}</td>
                              <td className="border border-black px-2 py-1"></td>
                              <td className="border border-black px-2 py-1"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="border border-black px-2 py-2 mb-3 text-gray-700">
                        {t("material.iqc.request.noInspectItems", "등록된 검사항목이 없습니다. 품목별 검사규격을 확인하세요.")}
                      </p>
                    )}

                    {/* 서명란 */}
                    <table className="w-full border-collapse mt-6 text-[11px] break-inside-avoid">
                      <tbody>
                        <tr>
                          <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("material.iqc.request.requester", "의뢰자")}</th>
                          <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("material.col.inspector", "검사자")}</th>
                          <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("material.iqcHistory.report.approver", "승인자")}</th>
                        </tr>
                        <tr>
                          <td className="border border-black px-2 py-6"></td>
                          <td className="border border-black px-2 py-6"></td>
                          <td className="border border-black px-2 py-6"></td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="text-right text-[10px] text-gray-700 mt-2">
                      {t("material.iqc.request.printedAt", "출력일시")}: {printedAt}
                      {sheets.length > 1 ? ` · ${sheetIdx + 1}/${sheets.length}` : ""}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #${PRINT_AREA_ID}, #${PRINT_AREA_ID} * { visibility: visible; }
          #${PRINT_AREA_ID} { position: absolute; top: 0; left: 0; width: 100%; }
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
