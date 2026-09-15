"use client";

/**
 * @file master/equip/components/EquipLabelModal.tsx
 * @description 설비 QR 라벨 발행 — QR(설비코드) + 설비 정보. window.print + @media print(라벨 사이즈).
 *              키오스크 설비 선택 모달이 설비코드 스캔을 지원하는데 정작 찍을 라벨을 뽑을 곳이 없어
 *              현장에서 외부 도구로 QR 을 만들어 쓰던 문제를 없앤다.
 *              점검항목 라벨(master/equip-inspect/components/InspectItemLabelModal)과 같은 방식이다.
 */

import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import QRCode from "react-qr-code";
import { Modal, Button } from "@/components/ui";
import type { EquipMaster } from "../types";

interface Props {
  isOpen: boolean;
  equip: EquipMaster | null;
  onClose: () => void;
}

export default function EquipLabelModal({ isOpen, equip, onClose }: Props) {
  const { t } = useTranslation();
  const handlePrint = () => window.print();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("master.equip.qrLabelTitle", "설비 QR 라벨")} size="md">
      <div className="flex justify-end mb-3 print:hidden">
        <Button onClick={handlePrint} disabled={!equip} data-testid="equip-label-print">
          <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
        </Button>
      </div>

      {equip && (
        <div
          id="equip-label-area"
          className="mx-auto bg-white text-black border-2 border-black rounded p-3 flex flex-col items-center gap-2"
          style={{ width: 300 }}
        >
          <div className="self-start text-[11px] font-semibold tracking-wide">
            {t("master.equip.qrLabelHeader", "설비")}
          </div>
          {/* QR 값은 설비코드 그대로 — 키오스크 설비 선택 모달이 equipCode 로 매칭한다 */}
          <QRCode value={equip.equipCode} size={128} />
          <div className="font-mono text-base font-bold mt-1">{equip.equipCode}</div>
          <div className="text-center text-sm font-semibold leading-tight">{equip.equipName}</div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px]">
            {equip.lineName && <span>{equip.lineName}</span>}
            {equip.processName && <span>· {equip.processName}</span>}
          </div>
          {equip.modelName && (
            <div className="text-[11px] text-center text-gray-700 leading-tight">{equip.modelName}</div>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #equip-label-area, #equip-label-area * { visibility: visible; }
          #equip-label-area {
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
