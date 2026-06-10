"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 발급된 시리얼 라벨 미리보기 (자재라벨) + window.print
 *
 * 초보자 가이드:
 * 1. 시리얼당 라벨 1장. 입하 라벨 표준 형식(80mm x 40mm) 사용
 * 2. @media print CSS로 모달 외 영역 숨김
 */

import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/ui';
import MaterialArrivalLabel from '@/components/material/MaterialArrivalLabel';
import type { PoLineReceiptResponse } from './types';

interface Props {
  isOpen: boolean;
  data: PoLineReceiptResponse | null;
  itemName?: string;
  mfgPartnerLabel?: string;
  receivedDate?: string;
  onClose: () => void;
}

export default function MatLabelPreviewModal({
  isOpen, data, itemName = '', mfgPartnerLabel = '', receivedDate = '', onClose,
}: Props) {
  const { t } = useTranslation();

  const handlePrint = () => window.print();

  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.label.title')} size="xl">
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={handlePrint}>🖨 {t('material.arrival.label.print')}</Button>
      </div>
      <div id="label-print-area" className="flex flex-wrap gap-2 bg-white p-2">
        {data.serials.map((s) => (
          <MaterialArrivalLabel
            key={s.matUid}
            item={{
              matUid: s.matUid,
              itemCode: s.itemCode,
              itemName,
              qty: s.initQty,
              unit: 'EA',
              vendor: mfgPartnerLabel,
              arrivalDate: receivedDate,
              lotNo: data.arrivalNo,
            }}
          />
        ))}
      </div>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #label-print-area, #label-print-area * { visibility: visible; }
          /* position:absolute 컨테이너는 페이지 분할이 안 돼 1장만 출력됨 → 정상 흐름(block)으로 전환 */
          #label-print-area { display: block; width: 100%; padding: 0; gap: 0; overflow: visible; }
          /* 시리얼당 1페이지: 라벨마다 페이지 넘김(마지막 라벨 뒤 빈 페이지 방지) */
          #label-print-area > * { page-break-after: always; break-after: page; }
          #label-print-area > *:last-child { page-break-after: auto; break-after: auto; }
          .material-arrival-label { page-break-inside: avoid; break-inside: avoid; }
          @page { size: 80mm 40mm; margin: 0; }
        }
      `}</style>
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
