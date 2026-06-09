"use client";

/**
 * @file components/ConsumableScanModal.tsx
 * @description 소모성 설비 부품 바코드 스캔 확인 모달
 *
 * 초보자 가이드:
 * - 장착된 소모품 조회: GET /equipment/consumables/mounted/:equipCode
 * - 바코드 스캔으로 소모품 코드 확인
 * - 수명 경고 부품은 빨간색으로 강조 표시
 * - 소모품 없으면 바로 완료 처리 가능
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Cog, CheckCircle2, ScanLine, AlertTriangle, AlertCircle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface ConsumableItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  currentCount: number;
  maxCount: number;
}

interface ConsumableApiItem {
  id?: string;
  consumableCode: string;
  consumableName: string;
  currentCount?: number | string | null;
  maxCount?: number | string | null;
  expectedLife?: number | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeConsumable(item: ConsumableApiItem): ConsumableItem {
  return {
    id: item.id ?? item.consumableCode,
    consumableCode: item.consumableCode,
    consumableName: item.consumableName,
    currentCount: toNumber(item.currentCount),
    maxCount: toNumber(item.maxCount ?? item.expectedLife),
  };
}

interface ConsumableScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function ConsumableScanModal({ isOpen, onClose, onDone }: ConsumableScanModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, scannedConsumables, addScannedConsumable, setInterlock } = useKioskStore();
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedEquip?.equipCode) return;
    api.get(`/equipment/consumables/mounted/${selectedEquip.equipCode}`)
      .then(res => {
        const data: ConsumableApiItem[] = res.data?.data ?? [];
        setItems(data.map(normalizeConsumable));
      })
      .catch(() => setItems([]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, selectedEquip?.equipCode]);

  const scannedCodes = new Set(scannedConsumables);
  const allScanned = items.length > 0 && items.every(c => scannedCodes.has(c.consumableCode));
  const unscannedCount = items.filter(c => !scannedCodes.has(c.consumableCode)).length;
  const completeDisabledReason = allScanned
    ? ''
    : items.length === 0
      ? t('kiosk.prep.noConsumables')
      : t('kiosk.material.remaining', { count: unscannedCount });

  const handleScan = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = scanInput.trim();
    if (!code) return;

    const matched = items.find(c => c.consumableCode === code || code.includes(c.consumableCode));
    if (matched) {
      // 수명 경고 체크
      if (matched.maxCount > 0 && matched.currentCount >= matched.maxCount) {
        toast.error(t('kiosk.prep.consumableLifeExceeded', { name: matched.consumableName }), { duration: 3000 });
      } else {
        addScannedConsumable(matched.consumableCode);
        toast.success(`✓ ${matched.consumableName}`, { duration: 1000 });
      }
    } else {
      toast.error(t('kiosk.prep.consumableNotFound', { code }), { duration: 2000 });
    }
    setScanInput('');
  }, [scanInput, items, addScannedConsumable, t]);

  const handleComplete = useCallback(() => {
    setInterlock('consumableScanDone', true);
    toast.success(t('kiosk.prep.consumableScanDone'));
    onDone();
  }, [setInterlock, onDone, t]);

  const handleSkip = useCallback(() => {
    setInterlock('consumableScanDone', true);
    onDone();
  }, [setInterlock, onDone]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('kiosk.prep.consumableScanTitle')}
      size="lg"
    >
      <div className="space-y-4">
        {/* 진행률 */}
        <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
          <Cog className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-text">{t('kiosk.prep.scanProgress')}</span>
              <span className="text-primary font-bold">
                {items.length - unscannedCount} / {items.length}
              </span>
            </div>
            <div className="w-full bg-surface-secondary rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: items.length > 0 ? `${((items.length - unscannedCount) / items.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* 스캔 입력 */}
        <div className="relative">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScan}
            placeholder={t('kiosk.prep.consumableScanPlaceholder')}
            className="w-full pl-9 pr-3 py-2.5 border border-primary rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>

        {/* 소모품 목록 */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-text-muted">
            <AlertTriangle className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t('kiosk.prep.noConsumables')}</p>
            <Button onClick={handleSkip}>{t('kiosk.prep.skipScan')}</Button>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {items.map(item => {
              const done = scannedCodes.has(item.consumableCode);
              const lifeRatio = item.maxCount > 0 ? item.currentCount / item.maxCount : 0;
              const isExpired = lifeRatio >= 1;
              const isWarning = lifeRatio >= 0.8 && !isExpired;

              return (
                <div key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    done
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : isExpired
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : isWarning
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                      : 'bg-surface border-border'
                  }`}>
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : isExpired
                    ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    : isWarning
                    ? <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                    : <Cog className="w-5 h-5 text-text-muted opacity-50 shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      done ? 'text-green-700 dark:text-green-300'
                      : isExpired ? 'text-red-700 dark:text-red-300'
                      : 'text-text'}`}>
                      {item.consumableName}
                    </p>
                    <p className="text-xs text-text-muted font-mono">{item.consumableCode}</p>
                  </div>

                  {item.maxCount > 0 && (
                    <span className={`text-xs tabular-nums shrink-0 font-medium ${
                      isExpired ? 'text-red-600 dark:text-red-400'
                      : isWarning ? 'text-orange-600 dark:text-orange-400'
                      : 'text-text-muted'}`}>
                      {item.currentCount.toLocaleString()} / {item.maxCount.toLocaleString()}
                    </span>
                  )}

                  {done && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
                      {t('kiosk.prep.confirmed')}
                    </span>
                  )}
                  {isExpired && !done && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-bold shrink-0">
                      {t('kiosk.prep.lifeExpired')}
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
            <Button
              onClick={handleComplete}
              disabled={!allScanned}
              title={completeDisabledReason || t('kiosk.prep.completeScan')}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {t('kiosk.prep.completeScan')}
            </Button>
          </div>
        </div>
        {completeDisabledReason && (
          <p className="text-[11px] text-text-muted mt-2" title={completeDisabledReason}>
            {completeDisabledReason}
          </p>
        )}
      </div>
    </Modal>
  );
}
