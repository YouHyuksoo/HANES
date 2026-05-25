"use client";

/**
 * @file components/MaterialScanModal.tsx
 * @description 자재 바코드 스캔 확인 모달 (롯트 기반)
 *
 * 초보자 가이드:
 * - BOM 자재 목록을 표시하고 바코드 스캔으로 롯트 등록
 * - 스캔된 matUid → POST /production/job-orders/:no/material-lots/scan
 * - 모든 자재 롯트 등록 완료 시 materialScanDone 인터락 해제
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Package, CheckCircle2, ScanLine } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import type { BomItem } from './MaterialListPanel';

interface MaterialScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function MaterialScanModal({ isOpen, onClose, onDone }: MaterialScanModalProps) {
  const { t } = useTranslation();
  const {
    selectedJobOrder, scannedMaterialLots,
    addScannedMaterialLot, setInterlock,
  } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedJobOrder?.itemCode) return;
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(res.data?.data ?? []))
      .catch(() => setBomItems([]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, selectedJobOrder?.itemCode]);

  const scannedMap = new Map(scannedMaterialLots.map(l => [`${l.itemCode}::${l.seq}`, l]));
  const allScanned = bomItems.length > 0 && bomItems.every(b => scannedMap.has(`${b.childItemCode}::${b.seq}`));
  const unscannedCount = bomItems.filter(b => !scannedMap.has(`${b.childItemCode}::${b.seq}`)).length;
  const completeDisabledReason = allScanned
    ? ''
    : bomItems.length === 0
      ? t('kiosk.prep.noBomItems')
      : t('kiosk.material.remaining', { count: unscannedCount });

  const handleScan = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const matUid = scanInput.trim();
    if (!matUid || !selectedJobOrder?.orderNo) return;
    setScanInput('');

    try {
      const res = await api.post(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-lots/scan`,
        {
          matUid,
          bomItems: bomItems.map(b => ({ itemCode: b.childItemCode, seq: b.seq })),
        },
      );
      const lot = res.data?.data as { itemCode: string; seq: number; matUid: string; initQty: number };
      addScannedMaterialLot({ itemCode: lot.itemCode, seq: lot.seq, matUid: lot.matUid, initQty: lot.initQty });
      toast.success(t('kiosk.material.scanOk'));

      const currentLots = useKioskStore.getState().scannedMaterialLots;
      const doneAll = bomItems.every(b =>
        currentLots.some(l => l.itemCode === b.childItemCode && l.seq === b.seq)
      );
      if (doneAll) {
        setInterlock('materialScanDone', true);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('오장착')) {
        toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      } else {
        toast.error(msg || t('kiosk.material.lotNotFound'));
      }
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [scanInput, selectedJobOrder, bomItems, addScannedMaterialLot, setInterlock, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.materialScan')} size="lg">
      <div className="space-y-4">
        {/* 스캔 입력 */}
        <div className="flex items-center gap-2 p-3 bg-surface rounded-lg border border-border">
          <ScanLine className="w-5 h-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder={t('kiosk.material.scanPlaceholder')}
            className="flex-1 bg-transparent text-sm outline-none text-text placeholder:text-text-muted"
          />
        </div>

        {/* 진행 상황 */}
        <p className="text-sm text-text-muted">
          {unscannedCount > 0
            ? t('kiosk.material.remaining', { count: unscannedCount })
            : t('kiosk.material.allLotScanned')}
        </p>

        {/* BOM 항목 목록 */}
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {bomItems.map(item => {
            const scanned = scannedMap.get(`${item.childItemCode}::${item.seq}`);
            return (
              <li
                key={`${item.childItemCode}-${item.seq}`}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded border-2',
                  scanned
                    ? 'border-green-500 bg-card'
                    : 'border-red-400 bg-card',
                ].join(' ')}
              >
                <Package className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text">{item.childItemCode}</p>
                  {scanned
                    ? <p className="text-xs text-green-600 dark:text-green-400">{scanned.matUid}</p>
                    : <p className="text-xs text-red-500 italic">{t('kiosk.material.noLot')}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-text">{item.qtyPer}</p>
                  {scanned && <p className="text-xs text-green-600 dark:text-green-400">{scanned.initQty.toLocaleString()}</p>}
                </div>
                {scanned && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              </li>
            );
          })}
        </ul>

        {/* 완료 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!allScanned}
            onClick={() => {
              setInterlock('materialScanDone', true);
              onDone();
            }}
            title={completeDisabledReason || t('kiosk.material.allLotScanned')}
          >
            {allScanned ? t('kiosk.material.allLotScanned') : t('kiosk.material.remaining', { count: unscannedCount })}
          </Button>
        </div>
        {completeDisabledReason && (
          <p className="text-[11px] text-text-muted mt-1" title={completeDisabledReason}>
            {completeDisabledReason}
          </p>
        )}
      </div>
    </Modal>
  );
}
