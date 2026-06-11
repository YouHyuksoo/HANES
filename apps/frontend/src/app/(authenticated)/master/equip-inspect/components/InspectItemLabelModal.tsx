"use client";

/**
 * @file master/equip-inspect/components/InspectItemLabelModal.tsx
 * @description 설비 점검항목 QR 라벨 발행 — QR(항목코드) + 항목 정보. window.print + @media print(라벨 사이즈).
 *              현장 점검 시 QR 스캔으로 점검항목을 식별하기 위한 라벨.
 */

import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button } from "@/components/ui";
import { InspectItemRow, INSPECT_TYPE_COLORS } from "../types";

interface Props {
  isOpen: boolean;
  item: InspectItemRow | null;
  inspectTypeLabel?: string;
  cycleLabel?: string;
  onClose: () => void;
}

export default function InspectItemLabelModal({ isOpen, item, inspectTypeLabel, cycleLabel, onClose }: Props) {
  const { t } = useTranslation();
  const handlePrint = () => window.print();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.equipInspect.qrLabelTitle", "점검항목 QR 라벨")} size="md">
      <div className="flex justify-end mb-3 print:hidden">
        <Button onClick={handlePrint} disabled={!item}>
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>

      {item && (
        <div
          id="inspect-label-area"
          className="mx-auto bg-white text-black border-2 border-black rounded p-3 flex flex-col items-center gap-2"
          style={{ width: 300 }}
        >
          <div className="self-start text-[11px] font-semibold tracking-wide">
            {t("master.equipInspect.qrLabelHeader", "설비 점검항목")}
          </div>
          <QRCode value={item.itemCode} size={128} />
          <div className="font-mono text-base font-bold mt-1">{item.itemCode}</div>
          <div className="text-center text-sm font-semibold leading-tight">{item.itemName}</div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className={`px-2 py-0.5 rounded font-medium ${INSPECT_TYPE_COLORS[item.inspectType] ?? ""}`}>
              {inspectTypeLabel || item.inspectType}
            </span>
            {item.cycle && <span>· {cycleLabel || item.cycle}</span>}
          </div>
          {item.criteria && (
            <div className="text-[11px] text-center text-gray-700 leading-tight">{item.criteria}</div>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #inspect-label-area, #inspect-label-area * { visibility: visible; }
          #inspect-label-area {
            position: absolute; top: 0; left: 0;
            border: none !important; width: auto;
          }
          @page { size: 60mm 55mm; margin: 3mm; }
        }
      `}</style>

      <div className="flex justify-end pt-4 border-t border-border mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
