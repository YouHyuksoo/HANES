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
import { Package, CheckCircle2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { BarcodeScanInput } from '@/components/shared';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
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
  const [waitingRows, setWaitingRows] = useState<MountedMaterial[]>([]);
  const [scanInput, setScanInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  // 설비 공정의 장착 대기 공정재고 — 선택 장착 후보
  useEffect(() => {
    if (!isOpen || !selectedEquip?.equipCode) { setWaitingRows([]); return; }
    api.get('/production/equip-material/proc-waiting', {
      params: { equipCode: selectedEquip.equipCode },
    })
      .then(res => setWaitingRows(res.data?.data ?? []))
      .catch(() => setWaitingRows([]));
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
  const unmountedBomCodes = useMemo(() => {
    return new Set(bomItems.filter(b => !mountedByItem.has(b.childItemCode)).map(b => b.childItemCode));
  }, [bomItems, mountedByItem]);
  const waitingRowsToShow = useMemo(() => {
    if (unmountedBomCodes.size === 0) return [];
    return waitingRows.filter(row => unmountedBomCodes.has(row.itemCode) && (row.availableQty ?? 0) > 0);
  }, [unmountedBomCodes, waitingRows]);
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

  const handleScan = useCallback(async (rawMatUid?: string) => {
    const matUid = (rawMatUid ?? scanInput).replace(/\r?\n|\r/g, '').trim();
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
    <Modal isOpen={isOpen} onClose={onClose} title={t('kiosk.prep.materialScan')} size="2xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]">
        <div className="min-h-0 rounded border border-border bg-surface/40">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">
                {t('production.equipMaterial.waitingTitle', '장착 대기 (공정재고)')}
              </p>
              <p className="text-xs text-text-muted">
                {t('kiosk.material.waitingPickHint', '미장착 품목의 LOT를 선택하면 스캔과 동일하게 장착합니다.')}
              </p>
            </div>
            <span className="shrink-0 rounded bg-background px-2 py-1 text-xs font-semibold text-text">
              {waitingRowsToShow.length}
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {unmountedBomCodes.size === 0 ? (
              <p className="rounded border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
                {t('kiosk.material.allLotScanned')}
              </p>
            ) : waitingRowsToShow.length === 0 ? (
              <div className="space-y-2">
                {[...unmountedBomCodes].map(code => (
                  <div key={code} className="rounded border border-red-300 bg-card px-3 py-2">
                    <p className="font-mono text-sm font-bold text-text">{code}</p>
                    <p className="text-xs text-red-500">{t('kiosk.material.noWaitingLot', '장착 대기 LOT 없음')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {waitingRowsToShow.map(row => (
                  <button
                    key={row.matUid}
                    type="button"
                    onClick={() => handleScan(row.matUid)}
                    title={`${row.itemName ?? row.itemCode} · ${row.availableQty.toLocaleString()}`}
                    className="w-full rounded border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm font-bold text-text">{row.itemCode}</span>
                      <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {t('common.select', '선택')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-text-muted">{row.itemName ?? '-'}</span>
                      <span className="shrink-0 font-mono text-text">{row.matUid}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {t('production.equipMaterial.remainQty', '잔량')}: {row.availableQty.toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <BarcodeScanInput
              ref={inputRef}
              value={scanInput}
              onChange={setScanInput}
              onScan={handleScan}
              placeholder={t('kiosk.material.scanPlaceholder')}
              maintainFocus={isOpen}
              fullWidth
            />
          </div>

          <p className="text-sm text-text-muted">
            {unscannedCount > 0
              ? t('kiosk.material.remaining', { count: unscannedCount })
              : t('kiosk.material.allLotScanned')}
          </p>

          <ul className="space-y-1.5 max-h-72 overflow-y-auto">
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
      </div>
    </Modal>
  );
}
