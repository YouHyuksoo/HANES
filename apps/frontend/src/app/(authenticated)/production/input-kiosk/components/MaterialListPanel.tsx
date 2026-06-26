"use client";

/**
 * @file components/MaterialListPanel.tsx
 * @description 좌측 패널 — BOM 자재리스트(설비 장착 현황) + 소모성 설비 부품(매핑 기반)
 *
 * 초보자 가이드:
 * - 상단 자재리스트: 작업지시 제품 BOM의 투입자재. 바코드(matUid) 롯트를 "설비에 장착"한다.
 *   장착된 자재는 설비(equipCode)에 귀속(WIP_MAT_STOCKS)되어 작업지시가 바뀌어도 유지된다.
 *   → BOM 요구 품목이 설비에 장착돼 있으면 커버(초록), 없으면 미커버(빨강).
 * - 하단 소모성 설비 부품: 소모품-설비-모델 매핑(CONSUMABLE_USAGE_MAP)으로 필요 소모품을 조회,
 *   바코드(conUid) 스캔으로 실제 롯트를 장착. 재고 차감이 아니라 사용횟수를 관리한다.
 * - 자재/소모품 모두 "설비 기준 장착"으로 동작이 일치한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle, AlertCircle, X, Scan, CheckCircle2, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { ConfirmModal } from '@/components/ui';
import { useKioskStore } from '@/stores/kioskStore';

interface MaterialListPanelProps {
  onOpenMaterialScan?: () => void;
  onOpenConsumableScan?: () => void;
  materialScanDisabledReasons?: string[];
  consumableScanDisabledReasons?: string[];
}

export interface BomItem {
  id: string;
  childItemCode: string;
  childItemName?: string;
  qtyPer: number;
  seq: number;
  processCode?: string;
  childPart?: { itemType?: string | null; itemName?: string | null } | null;
}

/** 설비에 장착된 자재 행 (백엔드 EquipMaterialService.MountedRow) */
export interface MountedMaterial {
  equipCode: string;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  availableQty: number;
}

/**
 * BOM 항목 중 투입자재(원자재·반제품)만 남긴다(소모품 제외).
 * 소모품은 제품 BOM이 아니라 소모품-설비-모델 매핑으로 관리한다.
 */
export function filterBomMaterials(items: BomItem[]): BomItem[] {
  return items.filter((b) => b.childPart?.itemType !== 'CONSUMABLE');
}

/** 매핑 기반 소모품 행 (백엔드 KioskConsumableRow) */
export interface ConsumableMapRow {
  consumableCode: string;
  name: string;
  usagePerUnit: number;
  expectedLife: number | null;
  warningCount: number | null;
  mountedConUid: string | null;
  currentCount: number | null;
  lotStatus: string | null;
}

export default function MaterialListPanel({
  onOpenMaterialScan,
  onOpenConsumableScan,
  materialScanDisabledReasons = [],
  consumableScanDisabledReasons = [],
}: MaterialListPanelProps) {
  const { t } = useTranslation();
  const { selectedEquip, selectedJobOrder, interlock, setInterlock, consumableRefreshSeq, bumpConsumableRefresh, materialMountRefreshSeq, bumpMaterialMountRefresh } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [mounted, setMounted] = useState<MountedMaterial[]>([]);
  const [consumables, setConsumables] = useState<ConsumableMapRow[]>([]);

  // 작업지시 품목의 제품 BOM(투입자재만) 로드
  useEffect(() => {
    if (!selectedJobOrder?.itemCode) { setBomItems([]); return; }
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(filterBomMaterials(res.data?.data ?? [])))
      .catch(() => setBomItems([]));
  }, [selectedJobOrder?.itemCode]);

  // 설비에 장착된 자재(WIP) 로드 — 장착/해제 후 materialMountRefreshSeq 증가로 재조회.
  // 자재는 설비 귀속이므로 작업지시가 아니라 selectedEquip 기준으로 조회한다.
  useEffect(() => {
    if (!selectedEquip?.equipCode) { setMounted([]); return; }
    api.get('/production/equip-material/mounted', {
      params: { equipCode: selectedEquip.equipCode },
    })
      .then(res => setMounted(res.data?.data ?? []))
      .catch(() => setMounted([]));
  }, [selectedEquip?.equipCode, materialMountRefreshSeq]);

  // 소모품 매핑(모델+설비) 로드 — 스캔 장착 후 consumableRefreshSeq 증가로 재조회
  useEffect(() => {
    if (!selectedJobOrder?.orderNo) { setConsumables([]); return; }
    api.get(`/production/job-orders/${selectedJobOrder.orderNo}/consumables`, {
      params: { equipCode: selectedEquip?.equipCode, includeMounted: 1 },
    })
      .then(res => setConsumables(res.data?.data ?? []))
      .catch(() => setConsumables([]));
  }, [selectedJobOrder?.orderNo, selectedEquip?.equipCode, consumableRefreshSeq]);

  // 품목코드별 장착 자재(가용 잔량>0) 매핑 — BOM 라인 커버리지 판정에 사용
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

  // BOM 요구 품목이 모두 설비에 장착되면 자재 인터락 자동 재평가
  useEffect(() => {
    if (bomItems.length === 0) return;
    const allDone = bomItems.every(b => mountedByItem.has(b.childItemCode));
    setInterlock('materialScanDone', allDone);
  }, [bomItems, mountedByItem, setInterlock]);

  // 매핑 소모품이 모두 장착(conUid)되면(또는 매핑 소모품이 없으면) 소모품 인터락 재평가
  useEffect(() => {
    const allDone = consumables.length === 0 || consumables.every(c => c.mountedConUid != null);
    setInterlock('consumableScanDone', allDone);
  }, [consumables, setInterlock]);

  const handleRemoveMaterial = async (mounts: MountedMaterial[]) => {
    if (!selectedEquip?.equipCode || mounts.length === 0) return;
    for (const m of mounts) {
      try {
        await api.post('/production/equip-material/unmount',
          { equipCode: selectedEquip.equipCode, matUid: m.matUid },
          { suppressErrorModal: true },
        );
      } catch {
        // 개별 해제 실패(예약 등)는 무시하고 계속
      }
    }
    bumpMaterialMountRefresh();
  };

  const handleRemoveConsumable = async (item: ConsumableMapRow) => {
    if (!selectedJobOrder?.orderNo || !item.mountedConUid) return;
    try {
      await api.delete(
        `/production/job-orders/${selectedJobOrder.orderNo}/consumables/${item.mountedConUid}`
      );
      bumpConsumableRefresh();
    } catch {
      // 해제 실패 시 무시
    }
  };

  // 자재투입 전체 취소 (설비 장착 자재 일괄 해제)
  const [cancelAllOpen, setCancelAllOpen] = useState(false);
  const handleRemoveAllMounts = async () => {
    if (!selectedEquip?.equipCode) return;
    for (const m of [...mounted]) {
      try {
        await api.post('/production/equip-material/unmount',
          { equipCode: selectedEquip.equipCode, matUid: m.matUid },
          { suppressErrorModal: true },
        );
      } catch {
        // 개별 실패는 무시하고 계속
      }
    }
    bumpMaterialMountRefresh();
    setCancelAllOpen(false);
  };

  const mountedBomCount = bomItems.filter(b => mountedByItem.has(b.childItemCode)).length;
  const mountedConsumCount = consumables.filter(c => c.mountedConUid != null).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* BOM 자재리스트 (설비 장착 현황) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-border flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.bomList')}</span>
          <span className="ml-auto text-xs text-text-muted">
            {mountedBomCount}/{bomItems.length}{t('kiosk.material.unit')}
          </span>
          {onOpenMaterialScan && (
            <button
              onClick={onOpenMaterialScan}
              disabled={!selectedJobOrder}
              title={selectedJobOrder
                ? t('kiosk.prep.materialScan')
                : materialScanDisabledReasons.join(' / ') || t('kiosk.input.disabledReasons.materialScan')}
              className={[
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                interlock.materialScanDone
                  ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                  : 'border-primary bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed',
                !interlock.materialScanDone && selectedJobOrder ? 'animate-pulse' : '',
              ].join(' ')}
            >
              <Scan className="h-3 w-3" />
              {t('kiosk.prep.materialScan')}
              {interlock.materialScanDone && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
            </button>
          )}
          {mounted.length > 0 && (
            <button
              onClick={() => setCancelAllOpen(true)}
              title={t('kiosk.material.cancelAll', '자재투입 전체 취소')}
              className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
              {t('kiosk.material.cancelAll', '투입취소')}
            </button>
          )}
          {!selectedJobOrder && (
            <span
              className="text-[10px] text-text-muted max-w-[140px] truncate"
              title={materialScanDisabledReasons.join(' / ') || t('kiosk.input.disabledReasons.materialScan')}
            >
              {materialScanDisabledReasons.join(' / ') || t('kiosk.input.disabledReasons.materialScan')}
            </span>
          )}
        </div>

        {bomItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <Package className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">{t('kiosk.material.noBom')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {bomItems.map((item) => {
              const coveredMounts = mountedByItem.get(item.childItemCode) ?? [];
              const isMounted = coveredMounts.length > 0;
              const availableQty = coveredMounts.reduce((s, m) => s + (m.availableQty ?? 0), 0);
              const firstUid = coveredMounts[0]?.matUid;
              const extra = coveredMounts.length - 1;
              return (
                <li
                  key={`${item.childItemCode}-${item.seq}`}
                  className={[
                    'flex items-center gap-1.5 px-2 py-1 border-l-2 transition-colors',
                    isMounted ? 'border-l-green-500 bg-green-50/30 dark:bg-green-950/10' : 'border-l-red-400',
                  ].join(' ')}
                >
                  {isMounted
                    ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                    : <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[11px] font-bold text-text truncate leading-none">{item.childItemCode}</span>
                      <span className="text-[11px] font-bold text-text tabular-nums shrink-0 leading-none">{(item.qtyPer ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-0.5">
                      {isMounted ? (
                        <>
                          <span className="text-[10px] text-green-700 dark:text-green-300 truncate leading-none">
                            {firstUid}{extra > 0 ? t('kiosk.material.andMore', { count: extra }) : ''}
                          </span>
                          <span className="text-[10px] text-green-700 dark:text-green-300 tabular-nums shrink-0 leading-none">{availableQty.toLocaleString()}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-red-400 italic leading-none">{t('kiosk.material.noLot')}</span>
                      )}
                    </div>
                  </div>
                  {isMounted && (
                    <button
                      onClick={() => handleRemoveMaterial(coveredMounts)}
                      className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-text-muted hover:text-red-500 transition-colors"
                      title={t('kiosk.material.removeLot')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 소모성 설비 부품 (매핑 기반) */}
      <div className="border-t border-border flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-border flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.consumables')}</span>
          <span className="ml-auto text-xs text-text-muted">
            {mountedConsumCount}/{consumables.length}{t('kiosk.material.unit')}
          </span>
          {onOpenConsumableScan && (
            <button
              onClick={onOpenConsumableScan}
              disabled={consumableScanDisabledReasons.length > 0}
              title={consumableScanDisabledReasons.length === 0
                ? t('kiosk.prep.consumableScan')
                : consumableScanDisabledReasons.join(' / ') || t('kiosk.input.disabledReasons.consumableScan')}
              className={[
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                interlock.consumableScanDone
                  ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                  : 'border-primary bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed',
                !interlock.consumableScanDone && consumableScanDisabledReasons.length === 0 ? 'animate-pulse' : '',
              ].join(' ')}
            >
              <Scan className="h-3 w-3" />
              {t('kiosk.prep.consumableScan')}
              {interlock.consumableScanDone && <CheckCircle2 className="h-3 w-3 text-teal-500" />}
            </button>
          )}
        </div>
        {consumables.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-text-muted">{t('kiosk.material.noConsumables')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {consumables.map((item) => {
              const isMounted = Boolean(item.mountedConUid);
              const over = item.expectedLife != null && item.currentCount != null && item.currentCount >= item.expectedLife;
              const warn = !over && item.warningCount != null && item.currentCount != null && item.currentCount >= item.warningCount;
              return (
                <li
                  key={item.consumableCode}
                  className={[
                    'flex items-center gap-1.5 px-2 py-1 border-l-2 transition-colors',
                    !isMounted ? 'border-l-red-400'
                      : over ? 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10'
                      : warn ? 'border-l-orange-400 bg-orange-50/30 dark:bg-orange-950/10'
                      : 'border-l-green-500 bg-green-50/30 dark:bg-green-950/10',
                  ].join(' ')}
                >
                  {!isMounted
                    ? <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    : over
                    ? <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                    : warn
                    ? <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />
                    : <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[11px] font-bold text-text truncate leading-none">{item.consumableCode}</span>
                      {isMounted && item.expectedLife != null && (
                        <span className={`text-[10px] font-bold tabular-nums shrink-0 leading-none ${over ? 'text-red-600 dark:text-red-400' : warn ? 'text-orange-600 dark:text-orange-400' : 'text-text-muted'}`}>
                          {(item.currentCount ?? 0).toLocaleString()}/{item.expectedLife.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-1 mt-0.5">
                      {isMounted ? (
                        <>
                          <span className="text-[10px] text-green-700 dark:text-green-300 truncate leading-none">{item.mountedConUid}</span>
                          <span className="text-[10px] font-medium text-green-700 dark:text-green-300 shrink-0 leading-none">{t('kiosk.material.mounted')}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-red-400 italic leading-none truncate">{item.name}</span>
                      )}
                    </div>
                  </div>
                  {isMounted && (
                    <button
                      onClick={() => handleRemoveConsumable(item)}
                      className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-text-muted hover:text-red-500 transition-colors"
                      title={t('kiosk.material.removeLot')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 자재투입 전체 취소 확인 */}
      <ConfirmModal
        isOpen={cancelAllOpen}
        onClose={() => setCancelAllOpen(false)}
        onConfirm={handleRemoveAllMounts}
        title={t('kiosk.material.cancelAllTitle', '자재투입 취소')}
        message={t('kiosk.material.cancelAllConfirm', '투입된 자재 {{count}}건을 모두 취소하시겠습니까?', { count: mounted.length })}
        variant="danger"
      />
    </div>
  );
}
