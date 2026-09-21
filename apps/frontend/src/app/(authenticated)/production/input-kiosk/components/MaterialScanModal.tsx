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
import { Package, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { BarcodeScanInput } from '@/components/shared';
import { useCarrierAutoInput } from '@/components/shared/carrier';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';
import { filterBomMaterials, type BomItem, type MountedMaterial } from './MaterialListPanel';

interface MaterialScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
  equipCode: string | null;
  carrierAutoInputYn: boolean;
}

export default function MaterialScanModal({ isOpen, onClose, onDone, equipCode, carrierAutoInputYn }: MaterialScanModalProps) {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder,
    materialMountRefreshSeq, bumpMaterialMountRefresh, setInterlock,
  } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [mounted, setMounted] = useState<MountedMaterial[]>([]);
  const [waitingRows, setWaitingRows] = useState<MountedMaterial[]>([]);
  const [scanInput, setScanInput] = useState('');
  /** 이번 모달에서 장착한 matUid — 취소 시 이것만 되돌린다(열기 전부터 장착돼 있던 건 건드리지 않는다). */
  const mountedHereRef = useRef<string[]>([]);
  /** 선택 장착 진행 중인 LOT — 누른 카드에 스피너를 띄우고 중복 클릭을 막는다(2026-09-21 지적). */
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !selectedJobOrder?.itemCode) return;
    mountedHereRef.current = [];
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

  // BOM 요구 품목이 모두 장착되면 인터락 자동 해제.
  // 닫힌 상태에서는 재평가하지 않는다 — 닫힐 때 mounted 를 비우면서 materialScanDone 을 false 로 덮어써
  // 실적입력 버튼이 비활성으로 남던 결함(2026-09-09 22번, 작업지시를 바꿨다 돌아오면 풀리던 증상). 열린 동안만 이 모달이 판정한다.
  useEffect(() => {
    if (!isOpen || bomItems.length === 0) return;
    setInterlock('materialScanDone', bomItems.every(b => mountedByItem.has(b.childItemCode)));
  }, [isOpen, bomItems, mountedByItem, setInterlock]);

  /** LOT 하나 장착 — 낱개 스캔과 대차 자동장착이 같은 함수를 쓴다. 성공 토스트는 호출자(낱개 경로)가 띄운다. */
  const mountOne = useCallback(async (matUid: string): Promise<boolean> => {
    if (!selectedJobOrder?.orderNo) return false;
    try {
      await api.post(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-mounts/scan`,
        { matUid, equipCode: equipCode ?? selectedEquip?.equipCode },
        { skipSuccessToast: true },
      );
      mountedHereRef.current.push(matUid);
      bumpMaterialMountRefresh();
      return true;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('오장착')) {
        toast.error(`${t('kiosk.material.wrongItem')}: ${msg}`);
      } else {
        toast.error(msg || t('kiosk.material.lotNotFound'));
      }
      return false;
    }
  }, [selectedJobOrder, equipCode, selectedEquip, bumpMaterialMountRefresh, t]);

  const carrierAuto = useCarrierAutoInput({ equipCode, enabled: carrierAutoInputYn, handleBarcode: mountOne });

  const handleScan = useCallback(async (rawMatUid?: string) => {
    const raw = (rawMatUid ?? scanInput).replace(/\r?\n|\r/g, '').trim();
    if (!raw) return;
    setScanInput('');

    const { handled } = await carrierAuto.run(raw);
    if (handled) {
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    const ok = await mountOne(raw);
    if (ok) toast.success(t('kiosk.material.scanOk'));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [scanInput, carrierAuto, mountOne, t]);

  /** 장착 대기 목록에서 고른 LOT 을 장착한다 — 진행 중 스피너를 띄우고 중복 클릭을 막는다. */
  const handlePick = useCallback(async (matUid: string) => {
    if (pendingUid) return;
    setPendingUid(matUid);
    try {
      await handleScan(matUid);
    } finally {
      setPendingUid(null);
    }
  }, [pendingUid, handleScan]);

  /**
   * 닫기 — 장착한 자재를 되돌리지 않는다(2026-09-21 지시).
   *
   * 왜 되돌리지 않나:
   * - 자재 장착은 실물을 설비에 물리는 행위다. 모달을 닫았다고 실물이 빠지지 않는다.
   *   화면만 해제하면 서버 재고와 현장이 어긋난다.
   * - BOM 전체를 못 채우고 닫아도 "여기까지 장착됨"이 맞는 상태다. 다음에 이어서 채운다.
   * - 잘못 장착한 자재는 자재 목록 패널의 전체 취소/개별 해제로 푼다. 그쪽이 해제의 단일 경로다.
   *
   * 예전에는 이번 세션 장착분을 unmount 로 되돌렸는데, 이미 예약(reservedQty)이 걸렸거나
   * 잔량이 없으면 서버가 거부해 "장착 해제하지 못한 자재가 있습니다" 만 남기고 모달이 닫히지도 않았다.
   */
  const handleCancel = useCallback(() => {
    mountedHereRef.current = [];
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={t('kiosk.prep.materialScan')} size="2xl">
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
                {waitingRowsToShow.map(row => {
                  const busy = pendingUid === row.matUid;
                  return (
                    <button
                      key={row.matUid}
                      type="button"
                      onClick={() => void handlePick(row.matUid)}
                      disabled={pendingUid !== null}
                      title={`${row.itemCode} · ${row.itemName ?? '-'} · ${row.matUid} · ${t('production.equipMaterial.remainQty', '잔량')} ${row.availableQty.toLocaleString()}`}
                      className="w-full rounded border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {/* 2줄 고정 — 1줄: 품번 + 품명 + 액션, 2줄: LOT + 잔량 (2026-09-21 지시) */}
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-sm font-bold text-text">{row.itemCode}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{row.itemName ?? '-'}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                          {busy ? t('kiosk.material.mounting', '장착 중') : t('common.select', '선택')}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-mono text-text">{row.matUid}</span>
                        <span className="shrink-0 tabular-nums text-text-muted">
                          {t('production.equipMaterial.remainQty', '잔량')} {row.availableQty.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
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
            <Button variant="ghost" onClick={handleCancel} disabled={pendingUid !== null}>
              {t('common.close')}
            </Button>
            <Button
              variant="primary"
              data-testid="kiosk-material-scan-done"
              disabled={!allScanned}
              onClick={() => {
                mountedHereRef.current = [];
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
