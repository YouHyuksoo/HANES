"use client";

/**
 * @file production/order/components/JobOrderPrintModal.tsx
 * @description 작업지시서 A4 출력 — 상단 작업지시 정보 + 하단 자재요청(BOM 소요량) 내역.
 *              창고 담당자 제공용. window.print + @media print(A4).
 */

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button } from "@/components/ui";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";

interface Props {
  isOpen: boolean;
  orderNo: string | null;
  onClose: () => void;
}

interface PartSummary {
  itemCode?: string;
  itemName?: string;
  unit?: string;
  spec?: string | null;
  itemType?: string;
}

interface JobOrderDetail {
  orderNo: string;
  itemCode: string;
  part?: PartSummary | null;
  lineCode?: string | null;
  custPoNo?: string | null;
  planQty: number;
  planDate?: string | null;
  priority?: number;
  status: string;
  remark?: string | null;
}

interface BomRow {
  childItemCode: string;
  qtyPer: number;
  seq: number;
  processCode?: string | null;
  childPart?: PartSummary | null;
}

const fmtDate = (v?: string | null) => (v ? String(v).slice(0, 10) : "-");

export default function JobOrderPrintModal({ isOpen, orderNo, onClose }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<JobOrderDetail | null>(null);
  const [boms, setBoms] = useState<BomRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !orderNo) {
      setOrder(null);
      setBoms([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/production/job-orders/${encodeURIComponent(orderNo)}`);
        const o: JobOrderDetail = res.data?.data;
        if (!alive) return;
        setOrder(o);
        if (o?.itemCode) {
          const b = await api.get(`/master/boms/parent/${encodeURIComponent(o.itemCode)}`);
          if (alive) setBoms(b.data?.data ?? []);
        }
      } catch {
        if (alive) { setOrder(null); setBoms([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, orderNo]);

  const planQty = order?.planQty ?? 0;
  const today = useMemo(() => getTodayLocal(), []);

  // 원자재만 표시 (반제품/소모품 제외)
  const rawMaterials = useMemo(
    () => boms.filter((b) => b.childPart?.itemType === "RAW_MATERIAL"),
    [boms],
  );

  // QR: 작업지시 조회 deep-link URL (모바일 카메라 스캔 시 해당 작업지시 자동 조회)
  const qrValue = useMemo(() => {
    if (!order) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/production/order?orderNo=${encodeURIComponent(order.orderNo)}`;
  }, [order]);

  const handlePrint = () => window.print();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("production.order.printTitle", "작업지시서 출력")} size="xl">
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={handlePrint} disabled={!order || loading}>
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>

      {loading && <p className="text-center text-text-muted py-8">{t("common.loading", "불러오는 중...")}</p>}

      {order && !loading && (
        <div id="jo-print-area" className="bg-white text-black p-2 text-[13px] leading-relaxed">
          {/* 제목 + QR (작업지시번호·라인·품목·수량) */}
          <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-2xl font-bold tracking-[0.3em]">{t("production.order.printTitle", "작업지시서")}</h1>
              <div className="text-xs mt-1">{t("production.order.printDate", "출력일")}: {today}</div>
            </div>
            <div className="flex flex-col items-center">
              {qrValue && <QRCode value={qrValue} size={84} />}
              <div className="text-[11px] font-mono font-semibold mt-1">{order.orderNo}</div>
            </div>
          </div>

          {/* 작업지시 정보 */}
          <table className="w-full border-collapse mb-4 text-[13px]">
            <tbody>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[110px]">{t("production.order.orderNo", "작업지시번호")}</th>
                <td className="border border-black px-2 py-1 font-semibold">{order.orderNo}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[110px]">{t("common.status", "상태")}</th>
                <td className="border border-black px-2 py-1">{order.status}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partCode", "품목코드")}</th>
                <td className="border border-black px-2 py-1">{order.itemCode}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partName", "품목명")}</th>
                <td className="border border-black px-2 py-1">{order.part?.itemName ?? "-"}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("production.order.planQty", "계획수량")}</th>
                <td className="border border-black px-2 py-1 font-semibold">{planQty.toLocaleString()} {order.part?.unit ?? ""}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("production.order.planDate", "계획일")}</th>
                <td className="border border-black px-2 py-1">{fmtDate(order.planDate)}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("production.order.line", "라인")}</th>
                <td className="border border-black px-2 py-1">{order.lineCode ?? "-"}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("production.order.custPoNo", "고객PO")}</th>
                <td className="border border-black px-2 py-1">{order.custPoNo ?? "-"}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.remark", "비고")}</th>
                <td className="border border-black px-2 py-1" colSpan={3}>{order.remark ?? "-"}</td>
              </tr>
            </tbody>
          </table>

          {/* 자재요청 내역 */}
          <div className="font-bold mb-1 text-[14px]">■ {t("production.order.materialRequest", "자재요청 내역")}</div>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-1 py-1 w-[36px]">No</th>
                <th className="border border-black px-2 py-1">{t("common.partCode", "품목코드")}</th>
                <th className="border border-black px-2 py-1">{t("common.partName", "품목명")}</th>
                <th className="border border-black px-2 py-1 w-[90px]">{t("production.order.spec", "규격")}</th>
                <th className="border border-black px-2 py-1 w-[70px]">{t("production.order.process", "공정")}</th>
                <th className="border border-black px-2 py-1 w-[60px]">{t("production.order.bomQty", "BOM수량")}</th>
                <th className="border border-black px-2 py-1 w-[80px]">{t("production.order.reqQty", "소요량")}</th>
                <th className="border border-black px-2 py-1 w-[44px]">{t("common.unit", "단위")}</th>
                <th className="border border-black px-2 py-1 w-[60px]">{t("production.order.checkCol", "확인")}</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.length === 0 ? (
                <tr><td className="border border-black px-2 py-3 text-center text-gray-500" colSpan={9}>{t("production.order.noRawMaterial", "원자재가 없습니다")}</td></tr>
              ) : (
                rawMaterials.map((b, idx) => (
                  <tr key={`${b.childItemCode}-${b.seq}`}>
                    <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                    <td className="border border-black px-2 py-1 font-mono">{b.childItemCode}</td>
                    <td className="border border-black px-2 py-1">{b.childPart?.itemName ?? "-"}</td>
                    <td className="border border-black px-2 py-1">{b.childPart?.spec ?? "-"}</td>
                    <td className="border border-black px-2 py-1 text-center">{b.processCode ?? "-"}</td>
                    <td className="border border-black px-2 py-1 text-right">{(b.qtyPer ?? 0).toLocaleString()}</td>
                    <td className="border border-black px-2 py-1 text-right font-semibold">{((b.qtyPer ?? 0) * planQty).toLocaleString()}</td>
                    <td className="border border-black px-2 py-1 text-center">{b.childPart?.unit ?? "-"}</td>
                    <td className="border border-black px-2 py-1"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 서명란 */}
          <table className="w-full border-collapse mt-6 text-[12px]">
            <tbody>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("production.order.preparedBy", "작성자")}</th>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("production.order.warehouseConfirm", "창고확인")}</th>
                <th className="border border-black bg-gray-100 px-2 py-1 w-1/3">{t("production.order.receivedBy", "수령자")}</th>
              </tr>
              <tr>
                <td className="border border-black px-2 py-6"></td>
                <td className="border border-black px-2 py-6"></td>
                <td className="border border-black px-2 py-6"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #jo-print-area, #jo-print-area * { visibility: visible; }
          #jo-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>

      <div className="flex justify-end pt-4 border-t border-border mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
