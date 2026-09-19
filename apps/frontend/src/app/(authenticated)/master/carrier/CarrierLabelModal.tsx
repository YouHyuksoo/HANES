"use client";
/**
 * @file src/app/(authenticated)/master/carrier/CarrierLabelModal.tsx
 * @description 대차 QR 라벨 — QR 값은 대차번호 그대로(현장 화면이 carrierNo로 매칭). window.print + 60x55mm.
 */
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button, ComCodeBadge } from "@/components/ui";
import type { CarrierRow } from "./carrierColumns";

interface Props { isOpen: boolean; carrier: CarrierRow | null; onClose: () => void; }

export default function CarrierLabelModal({ isOpen, carrier, onClose }: Props) {
  const { t } = useTranslation();
  const handlePrint = () => window.print();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.carrier.qrLabelTitle", "대차 QR 라벨")} size="md">
      <div className="flex justify-end mb-3 print:hidden">
        <Button onClick={handlePrint} disabled={!carrier} data-testid="carrier-label-print">
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>
      {carrier && (
        <div id="carrier-label-area" className="mx-auto bg-white text-black border-2 border-black rounded p-3 flex flex-col items-center gap-2" style={{ width: 300 }}>
          <div className="self-start text-[11px] font-semibold tracking-wide">{t("master.carrier.qrLabelHeader", "대차")}</div>
          <QRCode value={carrier.carrierNo} size={128} />
          <div className="font-mono text-base font-bold mt-1">{carrier.carrierNo}</div>
          <div className="text-center text-sm font-semibold leading-tight">{carrier.carrierName ?? ""}</div>
          <div className="print:hidden"><ComCodeBadge groupCode="CARRIER_TYPE" code={carrier.carrierType} /></div>
          <div className="text-[11px] text-gray-700">
            {carrier.capacity == null ? t("master.carrier.capacityUnlimited") : `${t("master.carrier.capacity")} ${carrier.capacity}`}
          </div>
        </div>
      )}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #carrier-label-area, #carrier-label-area * { visibility: visible; }
          #carrier-label-area { position: absolute; top: 0; left: 0; border: none !important; width: auto; }
          @page { size: 60mm 55mm; margin: 3mm; }
        }
      `}</style>
    </Modal>
  );
}
