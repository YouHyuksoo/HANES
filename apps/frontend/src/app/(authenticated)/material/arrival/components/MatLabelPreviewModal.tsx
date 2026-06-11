"use client";

/**
 * @file MatLabelPreviewModal.tsx
 * @description 발급된 시리얼 라벨 미리보기 (자재라벨) + 숨김 iframe 인쇄
 *
 * 초보자 가이드:
 * 1. 시리얼당 라벨 1장. 입하 라벨 표준 형식(80mm x 40mm) 사용
 * 2. 모달 DOM을 직접 window.print() 하면 Modal 조상(fixed inset-0,
 *    overflow-y-auto max-h-[75vh], body overflow:hidden)에 클리핑되어
 *    첫 페이지 1장만 인쇄된다.
 * 3. window.open 새 창 인쇄는 팝업 차단 시 조용히 무반응이 된다.
 *    → 팝업 차단과 무관한 숨김 iframe에 라벨 HTML을 복사해 인쇄한다.
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/ui';
import MaterialArrivalLabel, {
  MATERIAL_ARRIVAL_LABEL_WIDTH_MM,
  MATERIAL_ARRIVAL_LABEL_HEIGHT_MM,
} from '@/components/material/MaterialArrivalLabel';
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
  const printRef = useRef<HTMLDivElement>(null);

  const PRINT_IFRAME_ID = 'mat-label-print-iframe';

  const handlePrint = () => {
    if (!printRef.current) return;
    // 이전 인쇄 iframe 잔존 시 제거
    document.getElementById(PRINT_IFRAME_ID)?.remove();

    const iframe = document.createElement('iframe');
    iframe.id = PRINT_IFRAME_ID;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(`<html><head><title>${t('material.arrival.label.title')}</title>
      <style>*{box-sizing:border-box}body{margin:0;font-family:Arial,"Malgun Gothic",sans-serif;background:#fff}.label-grid{display:flex;flex-wrap:wrap;gap:0;padding:0}
      .material-arrival-label{width:${MATERIAL_ARRIVAL_LABEL_WIDTH_MM}mm!important;height:${MATERIAL_ARRIVAL_LABEL_HEIGHT_MM}mm!important;page-break-inside:avoid;break-inside:avoid}
      img{max-width:100%;max-height:100%}@page{size:${MATERIAL_ARRIVAL_LABEL_WIDTH_MM}mm ${MATERIAL_ARRIVAL_LABEL_HEIGHT_MM}mm;margin:0}</style>
      </head><body><div class="label-grid">${printRef.current.innerHTML}</div></body></html>`);
    doc.close();

    // 인쇄 대화상자 종료 후 iframe 정리
    win.addEventListener('afterprint', () => iframe.remove());
    // QR 이미지는 data URL이라 doc.close() 시점에 로드 완료 — 바로 인쇄
    win.focus();
    win.print();
  };

  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.label.title')} size="xl">
      <div className="flex justify-end mb-2">
        <Button onClick={handlePrint}>🖨 {t('material.arrival.label.print')}</Button>
      </div>
      <div ref={printRef} className="flex flex-wrap gap-2 bg-white p-2">
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
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  );
}
