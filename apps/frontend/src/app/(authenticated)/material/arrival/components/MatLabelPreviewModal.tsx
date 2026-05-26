"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 발급된 시리얼 라벨 미리보기 (자재라벨) + window.print
 *
 * 초보자 가이드:
 * 1. 시리얼당 라벨 1장. CODE128 바코드 사용 (jsbarcode)
 * 2. @media print CSS로 모달 외 영역 숨김
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode';
import { Modal, Button } from '@/components/ui';
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

  useEffect(() => {
    if (!isOpen || !data) return;
    // 다음 paint 사이클에서 바코드 렌더 (SVG 요소가 DOM에 마운트된 후)
    const t1 = setTimeout(() => {
      data.serials.forEach((s) => {
        const el = document.getElementById(`bc-${s.matUid}`);
        if (el) {
          try {
            JsBarcode(el, s.matUid, { format: 'CODE128', width: 1.5, height: 40, displayValue: false });
          } catch { /* 무시 */ }
        }
      });
    }, 0);
    return () => clearTimeout(t1);
  }, [isOpen, data]);

  const handlePrint = () => window.print();

  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.label.title')} size="xl">
      <div className="flex justify-end mb-2 print:hidden">
        <Button onClick={handlePrint}>🖨 {t('material.arrival.label.print')}</Button>
      </div>
      <div id="label-print-area" className="grid grid-cols-2 gap-3">
        {data.serials.map((s) => (
          <div key={s.matUid} className="border border-gray-300 p-3 rounded text-sm bg-white">
            <div className="font-mono font-bold text-base text-slate-900">{s.matUid}</div>
            <div className="mt-1">{s.itemCode} / {itemName}</div>
            <div className="text-xs text-slate-600">
              {t('material.arrival.col.receivedDate')}: {receivedDate} · {s.initQty} EA
            </div>
            <div className="text-xs text-slate-600">
              {t('material.arrival.col.mfgPartner')}: {mfgPartnerLabel}
            </div>
            <svg id={`bc-${s.matUid}`} className="mt-1 w-full" />
          </div>
        ))}
      </div>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #label-print-area, #label-print-area * { visibility: visible; }
          #label-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
      <div className="flex justify-end pt-4 border-t border-gray-200 mt-4 print:hidden">
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
