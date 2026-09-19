"use client";
/**
 * @file components/shared/carrier/CarrierSlipPrintModal.tsx
 * @description 대차 이동전표 A4 인쇄 — 열릴 때 발행/재발행 API를 호출하고(전표번호 스탬프), 담긴 내용과 다음 공정을 출력한다.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button } from "@/components/ui";
import api from "@/services/api";
import type { CarrierSlipView } from "./carrierTypes";
import { formatCarrierDateTime as fmt } from "./formatDateTime";

interface Props { isOpen: boolean; carrierNo: string | null; onClose: () => void; }

export default function CarrierSlipPrintModal({ isOpen, carrierNo, onClose }: Props) {
  const { t } = useTranslation();
  const [slip, setSlip] = useState<CarrierSlipView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !carrierNo) { setSlip(null); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post(`/production/carriers/${encodeURIComponent(carrierNo)}/slip`, {}, { skipSuccessToast: true });
        if (alive) setSlip(res.data?.data ?? null);
      } catch {
        if (alive) setSlip(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, carrierNo]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("carrier.slipTitle", "대차 이동전표")} size="xl">
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={() => window.print()} disabled={!slip || loading} data-testid="carrier-slip-print">
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>
      {loading && <p className="text-center text-text-muted py-8">{t("common.loading", "불러오는 중...")}</p>}
      {slip && !loading && (
        <div id="carrier-slip-print-area" className="bg-white text-black p-2 text-[13px] leading-relaxed">
          <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
            <div>
              <h1 className="text-2xl font-bold tracking-[0.3em]">{t("carrier.slipTitle", "대차 이동전표")}</h1>
              <div className="text-xs mt-1">
                {t("carrier.issuedAt", "발행")}: {fmt(slip.issuedAt)} · {slip.issuedBy}{slip.reprint ? ` · ${t("carrier.reprint", "재발행")}` : ""}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <QRCode value={slip.carrierNo} size={84} />
              <div className="text-[11px] font-mono font-semibold mt-1">{slip.carrierNo}</div>
            </div>
          </div>
          <table className="w-full border-collapse mb-4 text-[13px]">
            <tbody>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[110px]">{t("carrier.slipNo", "전표번호")}</th>
                <td className="border border-black px-2 py-1 font-mono font-semibold">{slip.slipNo}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[110px]">{t("master.carrier.carrierType", "유형")}</th>
                <td className="border border-black px-2 py-1">{slip.carrierType}{slip.carrierName ? ` · ${slip.carrierName}` : ""}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partCode", "품목코드")}</th>
                <td className="border border-black px-2 py-1">{slip.itemCode ?? "-"}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partName", "품목명")}</th>
                <td className="border border-black px-2 py-1">{slip.itemName ?? "-"}</td>
              </tr>
              <tr>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("production.order.orderNo", "작업지시번호")}</th>
                <td className="border border-black px-2 py-1">{slip.orderNo ?? "-"}</td>
                <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("carrier.from", "출발 공정")} → {t("carrier.to", "도착 공정")}</th>
                <td className="border border-black px-2 py-1 font-semibold">
                  {slip.fromProcessName ?? slip.fromProcessCode ?? "-"} → {slip.toProcessName ?? slip.toProcessCode ?? t("carrier.toFinal", "최종")}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-1 py-1 w-[36px]">No</th>
                <th className="border border-black px-2 py-1">{t("carrier.barcode", "바코드")}</th>
                <th className="border border-black px-2 py-1">{t("common.partCode", "품목코드")}</th>
                <th className="border border-black px-2 py-1 w-[70px]">{t("common.qty", "수량")}</th>
                <th className="border border-black px-2 py-1 w-[140px]">{t("carrier.loadedAt", "적재일시")}</th>
              </tr>
            </thead>
            <tbody>
              {slip.contents.map((row, i) => (
                <tr key={row.barcode}>
                  <td className="border border-black px-1 py-1 text-center">{i + 1}</td>
                  <td className="border border-black px-2 py-1 font-mono">{row.barcode}</td>
                  <td className="border border-black px-2 py-1">{row.itemCode}</td>
                  <td className="border border-black px-2 py-1 text-right tabular-nums">{row.qty.toLocaleString()}</td>
                  <td className="border border-black px-2 py-1">{fmt(row.loadedAt)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black px-2 py-1 text-right" colSpan={3}>{t("common.total", "합계")} ({slip.loadedCount})</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{slip.totalQty.toLocaleString()}</td>
                <td className="border border-black px-2 py-1" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #carrier-slip-print-area, #carrier-slip-print-area * { visibility: visible; }
          #carrier-slip-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>
      <div className="flex justify-end pt-4 border-t border-border mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
