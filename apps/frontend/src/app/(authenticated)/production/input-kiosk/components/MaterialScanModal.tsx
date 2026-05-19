"use client";

/**
 * @file components/MaterialScanModal.tsx
 * @description 자재 바코드 스캔 확인 모달
 *
 * 초보자 가이드:
 * - BOM 자재 목록을 표시하고 작업자가 바코드 스캔으로 하나씩 확인
 * - 스캔된 값이 BOM 자재 코드와 일치하면 체크 처리
 * - 모든 자재가 확인되면 materialScanDone 인터락 해제
 * - BOM이 없는 경우 바로 완료 처리 가능
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Package, CheckCircle2, ScanLine, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface BomItem {
  id: string;
  childItemCode: string;
  childItemName?: string;
  qtyPer: number;
}

interface MaterialScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function MaterialScanModal({ isOpen, onClose, onDone }: MaterialScanModalProps) {
  const { t } = useTranslation();
  const { selectedJobOrder, scannedMaterialLots, addScannedMaterialLot, setInterlock } = useKioskStore();
  const scannedMaterials = scannedMaterialLots.map(l => l.itemCode);
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

  const scannedCodes = new Set(scannedMaterials);
  const allScanned = bomItems.length > 0 && bomItems.every(b => scannedCodes.has(b.childItemCode));
  const unscannedCount = bomItems.filter(b => !scannedCodes.has(b.childItemCode)).length;

  const handleScan = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = scanInput.trim();
    if (!code) return;

    const matched = bomItems.find(b => b.childItemCode === code || code.includes(b.childItemCode));
    if (matched) {
      addScannedMaterialLot({ itemCode: matched.childItemCode, seq: 0, matUid: code, initQty: 0 });
      toast.success(`✓ ${matched.childItemCode}`, { duration: 1000 });
    } else {
      toast.error(t('kiosk.prep.materialNotInBom', { code }), { duration: 2000 });
    }
    setScanInput('');
  }, [scanInput, bomItems, addScannedMaterialLot, t]);

  const handleComplete = useCallback(() => {
    setInterlock('materialScanDone', true);
    toast.success(t('kiosk.prep.materialScanDone'));
    onDone();
  }, [setInterlock, onDone, t]);

  const handleSkip = useCallback(() => {
    setInterlock('materialScanDone', true);
    onDone();
  }, [setInterlock, onDone]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('kiosk.prep.materialScanTitle')}
      size="lg"
    >
      <div className="space-y-4">
        {/* 진행률 */}
        <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
          <Package className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-text">{t('kiosk.prep.scanProgress')}</span>
              <span className="text-primary font-bold">
                {bomItems.length - unscannedCount} / {bomItems.length}
              </span>
            </div>
            <div className="w-full bg-surface-secondary rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: bomItems.length > 0 ? `${((bomItems.length - unscannedCount) / bomItems.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* 스캔 입력 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={handleScan}
              placeholder={t('kiosk.prep.scanPlaceholder')}
              className="w-full pl-9 pr-3 py-2.5 border border-primary rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        </div>

        {/* BOM 자재 목록 */}
        {bomItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t('kiosk.prep.noBomItems')}</p>
            <Button onClick={handleSkip}>{t('kiosk.prep.skipScan')}</Button>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {bomItems.map(item => {
              const done = scannedCodes.has(item.childItemCode);
              return (
                <div key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    done
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-surface border-border'
                  }`}>
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : <Package className="w-5 h-5 text-text-muted opacity-50 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-mono font-medium ${done ? 'text-green-700 dark:text-green-300' : 'text-text'}`}>
                      {item.childItemCode}
                    </p>
                    {item.childItemName && (
                      <p className="text-xs text-text-muted truncate">{item.childItemName}</p>
                    )}
                  </div>
                  <span className="text-xs text-text-muted tabular-nums shrink-0">×{item.qtyPer}</span>
                  {done && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
                      {t('kiosk.prep.confirmed')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-between pt-2 border-t border-border">
          <Button variant="outline" onClick={handleSkip} className="text-text-muted">
            {t('kiosk.prep.skipScan')}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleComplete} disabled={!allScanned}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {t('kiosk.prep.completeScan')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
