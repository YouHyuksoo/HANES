"use client";

/**
 * @file components/ConsumableScanModal.tsx
 * @description 소모품 롯트 바코드(conUid) 스캔 장착 모달 (매핑 기반)
 *
 * 초보자 가이드:
 * - 소모품-설비-모델 매핑(CONSUMABLE_USAGE_MAP)으로 필요 소모품을 조회한다.
 * - 실제 소모품 롯트의 고유 바코드(conUid)를 스캔하면 그 롯트를 설비에 장착(MOUNTED)한다.
 * - 재고 차감이 아니라 사용횟수 관리 — 생산실적 완료 시 장착 롯트의 사용횟수가 누적된다.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Cog, CheckCircle2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { BarcodeScanInput } from '@/components/shared';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import type { ConsumableMapRow } from './MaterialListPanel';

interface ConsumableScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function ConsumableScanModal({ isOpen, onClose, onDone }: ConsumableScanModalProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder, setInterlock, consumableRefreshSeq, bumpConsumableRefresh } = useKioskStore();
  const [items, setItems] = useState<ConsumableMapRow[]>([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedJobOrder?.orderNo) return;
    api.get(`/production/job-orders/${selectedJobOrder.orderNo}/consumables`, {
      params: { equipCode: selectedEquip?.equipCode, includeMounted: 1 },
    })
      .then(res => setItems(res.data?.data ?? []))
      .catch(() => setItems([]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, selectedJobOrder?.orderNo, selectedEquip?.equipCode, consumableRefreshSeq]);

  const allMounted = items.length === 0 || items.every(c => c.mountedConUid != null);
  const unmountedCount = items.filter(c => c.mountedConUid == null).length;
  const completeDisabledReason = allMounted ? '' : t('kiosk.material.remaining', { count: unmountedCount });

  const handleScan = useCallback(async (rawConUid?: string) => {
    const conUid = (rawConUid ?? scanInput).replace(/\r?\n|\r/g, '').trim();
    if (!conUid || !selectedJobOrder?.orderNo) return;
    setScanInput('');

    try {
      const res = await api.post(
        `/production/job-orders/${selectedJobOrder.orderNo}/consumables/scan`,
        { conUid, equipCode: selectedEquip?.equipCode },
      );
      const lot = res.data?.data as { consumableCode: string };
      toast.success(`✓ ${lot.consumableCode}`, { duration: 1000 });
      bumpConsumableRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('오장착')) {
        toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      } else {
        toast.error(msg || t('kiosk.material.lotNotFound'));
      }
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [scanInput, selectedJobOrder, selectedEquip?.equipCode, bumpConsumableRefresh, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.consumableScanTitle')} size="lg">
      <div className="space-y-4">
        {/* 스캔 입력 */}
        <div>
          <BarcodeScanInput
            ref={inputRef}
            value={scanInput}
            onChange={setScanInput}
            onScan={handleScan}
            placeholder={t('kiosk.prep.consumableScanPlaceholder')}
            maintainFocus={isOpen}
            fullWidth
          />
        </div>

        {/* 진행 상황 */}
        <p className="text-sm text-text-muted">
          {items.length === 0
            ? t('kiosk.prep.noConsumables')
            : unmountedCount > 0
              ? t('kiosk.material.remaining', { count: unmountedCount })
              : t('kiosk.material.allLotScanned')}
        </p>

        {/* 매핑 소모품 목록 */}
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map(item => {
            const isMounted = Boolean(item.mountedConUid);
            return (
              <li
                key={item.consumableCode}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded border-2',
                  isMounted ? 'border-green-500 bg-card' : 'border-red-400 bg-card',
                ].join(' ')}
              >
                <Cog className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text">{item.consumableCode}</p>
                  {isMounted
                    ? <p className="text-xs text-green-600 dark:text-green-400">{item.mountedConUid}</p>
                    : <p className="text-xs text-red-500 italic truncate">{item.name}</p>}
                </div>
                {isMounted && item.expectedLife != null && (
                  <span className="text-xs text-text-muted tabular-nums shrink-0">
                    {(item.currentCount ?? 0).toLocaleString()}/{item.expectedLife.toLocaleString()}
                  </span>
                )}
                {isMounted && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
              </li>
            );
          })}
        </ul>

        {/* 완료 버튼 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!allMounted}
            onClick={() => {
              setInterlock('consumableScanDone', true);
              onDone();
            }}
            title={completeDisabledReason || t('kiosk.material.allLotScanned')}
          >
            {allMounted ? t('kiosk.prep.completeScan') : t('kiosk.material.remaining', { count: unmountedCount })}
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
