"use client";

/**
 * @file components/MaterialScanModal.tsx
 * @description 자재 바코드 스캔 확인 모달 (설비 장착 기반)
 *
 * 초보자 가이드:
 * - BOM 자재 목록을 표시하고 바코드(matUid) 스캔으로 설비에 장착한다.
 * - 스캔된 matUid → POST /production/job-orders/:no/material-mounts/scan (BOM 오장착 검증)
 *   → 자재가 설비(equipCode)에 귀속 장착(WIP_MAT_STOCKS)되어 작업지시가 바뀌어도 유지된다.
 * - 장착 현황은 GET /production/equip-material/mounted?equipCode 로 조회.
 * - BOM 요구 품목이 모두 설비에 장착되면 materialScanDone 인터락 해제.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Package, CheckCircle2, ScanLine } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { useScanInputFocus } from '@/hooks/useScanInputFocus';
import { filterBomMaterials, type BomItem, type MountedMaterial } from './MaterialListPanel';

interface MaterialScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function MaterialScanModal({ isOpen, onClose, onDone }: MaterialScanModalProps) {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder,
    materialMountRefreshSeq, bumpMaterialMountRefresh, setInterlock,
  } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [mounted, setMounted] = useState<MountedMaterial[]>([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // 모달 열린 동안 스캔 입력창 항상 포커스 유지
  useScanInputFocus(inputRef, isOpen);

  useEffect(() => {
    if (!isOpen || !selectedJobOrder?.itemCode) return;
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(filterBomMaterials(res.data?.data ?? [])))
      .catch(() => setBomItems([]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, selectedJobOrder?.itemCode]);

  // 설비 장착 자재 — 스캔/해제(materialMountRefreshSeq) 후 재조회
  useEffect(() => {
    if (!isOpen || !selectedEquip?.equipCode) { setMounted([]); return; }
    api.get('/production/equip-material/mounted', {
      params: { equipCode: selectedEquip.equipCode },
    })
      .then(res => setMounted(res.data?.data ?? []))
      .catch(() => setMounted([]));
  }, [isOpen, selectedEquip?.equipCode, materialMountRefreshSeq]);

  // 품목코드별 장착 자재(가용 잔량>0) 매핑 — BOM 라인 커버리지 판정
  const mountedByItem = useMemo(() => {
    const map = new Map<string, MountedMaterial[]>();
    for (const m of mounted) {
      if ((m.availableQty ?? 0) <= 0) continue;
      const list = map.get(m.itemCode) ?? [];
      list.push(m);
      map.set(m.itemCode, list);
    }
    return map;
  }, [mounted]);

  const allScanned = bomItems.length > 0 && bomItems.every(b => mountedByItem.has(b.childItemCode));
  const unscannedCount = bomItems.filter(b => !mountedByItem.has(b.childItemCode)).length;
  const completeDisabledReason = allScanned
    ? ''
    : bomItems.length === 0
      ? t('kiosk.prep.noBomItems')
      : t('kiosk.material.remaining', { count: unscannedCount });

  // BOM 요구 품목이 모두 장착되면 인터락 자동 해제
  useEffect(() => {
    if (bomItems.length === 0) return;
    setInterlock('materialScanDone', bomItems.every(b => mountedByItem.has(b.childItemCode)));
  }, [bomItems, mountedByItem, setInterlock]);

  const handleScan = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const matUid = scanInput.trim();
    if (!matUid || !selectedJobOrder?.orderNo) return;
    setScanInput('');

    try {
      await api.post(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-mounts/scan`,
        { matUid, equipCode: selectedEquip?.equipCode },
      );
      bumpMaterialMountRefresh();
      toast.success(t('kiosk.material.scanOk'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('오장착')) {
        toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      } else {
        toast.error(msg || t('kiosk.material.lotNotFound'));
      }
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [scanInput, selectedJobOrder, selectedEquip, bumpMaterialMountRefresh, t]);

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
            const coveredMounts = mountedByItem.get(item.childItemCode) ?? [];
            const isMounted = coveredMounts.length > 0;
            const availableQty = coveredMounts.reduce((s, m) => s + (m.availableQty ?? 0), 0);
            const firstUid = coveredMounts[0]?.matUid;
            const extra = coveredMounts.length - 1;
            return (
              <li
                key={`${item.childItemCode}-${item.seq}`}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded border-2',
                  isMounted
                    ? 'border-green-500 bg-card'
                    : 'border-red-400 bg-card',
                ].join(' ')}
              >
                <Package className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text">{item.childItemCode}</p>
                  {isMounted
                    ? <p className="text-xs text-green-600 dark:text-green-400 truncate">{firstUid}{extra > 0 ? t('kiosk.material.andMore', { count: extra }) : ''}</p>
                    : <p className="text-xs text-red-500 italic">{t('kiosk.material.noLot')}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-text">{(item.qtyPer ?? 0).toLocaleString()}</p>
                  {isMounted && <p className="text-xs text-green-600 dark:text-green-400">{availableQty.toLocaleString()}</p>}
                </div>
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
