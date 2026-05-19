"use client";

/**
 * @file components/MaterialListPanel.tsx
 * @description 좌측 패널 — BOM 자재리스트(롯트 스캔 현황) + 소모성 설비 부품
 *
 * 초보자 가이드:
 * - 작업지시 선택 시 BOM 항목 자동 로드
 * - 각 카드: 이미지 + 품목코드 + 소요수량 / 롯트번호 + 입고수량
 * - 초록 테두리: 롯트 스캔 완료 / 빨강 테두리: 미스캔
 * - 상단 헤더 바코드 스캔으로 롯트 등록 (EquipHeader에서 처리)
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle, AlertCircle, X } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

export interface BomItem {
  id: string;
  childItemCode: string;
  childItemName?: string;
  qtyPer: number;
  seq: number;
  processCode?: string;
}

interface ConsumableItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  currentCount: number;
  maxCount: number;
  category: string;
}

function lifeBarColor(current: number, max: number): string {
  if (max <= 0) return 'bg-gray-300';
  const ratio = current / max;
  if (ratio >= 1) return 'bg-red-500';
  if (ratio >= 0.8) return 'bg-orange-400';
  return 'bg-green-500';
}

function lifeTextColor(current: number, max: number): string {
  if (max <= 0) return '';
  const ratio = current / max;
  if (ratio >= 1) return 'text-red-600 dark:text-red-400';
  if (ratio >= 0.8) return 'text-orange-500 dark:text-orange-400';
  return 'text-text-muted';
}

export default function MaterialListPanel() {
  const { t } = useTranslation();
  const { selectedJobOrder, selectedEquip, scannedMaterialLots, removeScannedMaterialLot, addScannedMaterialLot } = useKioskStore();
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);

  useEffect(() => {
    if (!selectedJobOrder?.itemCode) { setBomItems([]); return; }
    api.get(`/master/boms/parent/${selectedJobOrder.itemCode}`)
      .then(res => setBomItems(res.data?.data ?? []))
      .catch(() => setBomItems([]));
  }, [selectedJobOrder?.itemCode]);

  useEffect(() => {
    if (!selectedEquip?.equipCode) { setConsumables([]); return; }
    api.get(`/equipment/consumables/mounted/${selectedEquip.equipCode}`)
      .then(res => setConsumables(res.data?.data ?? []))
      .catch(() => setConsumables([]));
  }, [selectedEquip?.equipCode]);

  // 작업지시 변경 시 기존 스캔 내역 서버에서 로드
  useEffect(() => {
    if (!selectedJobOrder?.orderNo) return;
    api.get(`/production/job-orders/${selectedJobOrder.orderNo}/material-lots`)
      .then(res => {
        const lots: { itemCode: string; seq: number; matUid: string; initQty: number }[] = res.data?.data ?? [];
        lots.forEach(l => {
          addScannedMaterialLot({ itemCode: l.itemCode, seq: l.seq, matUid: l.matUid, initQty: l.initQty });
        });
      })
      .catch(() => {});
  }, [selectedJobOrder?.orderNo, addScannedMaterialLot]);

  const scannedMap = new Map(
    scannedMaterialLots.map(l => [`${l.itemCode}::${l.seq}`, l])
  );

  const handleRemoveLot = async (item: BomItem) => {
    if (!selectedJobOrder?.orderNo) return;
    try {
      await api.delete(
        `/production/job-orders/${selectedJobOrder.orderNo}/material-lots/${item.childItemCode}/${item.seq}`
      );
      removeScannedMaterialLot(item.childItemCode, item.seq);
    } catch {
      // 삭제 실패 시 무시
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* BOM 자재리스트 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-card px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.bomList')}</span>
          <span className="ml-auto text-xs text-text-muted">
            {scannedMaterialLots.length}/{bomItems.length}{t('kiosk.material.unit')}
          </span>
        </div>

        {bomItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <Package className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">{t('kiosk.material.noBom')}</span>
          </div>
        ) : (
          <ul className="p-1.5 space-y-1.5">
            {bomItems.map((item) => {
              const scanned = scannedMap.get(`${item.childItemCode}::${item.seq}`);
              const isScanned = Boolean(scanned);
              return (
                <li
                  key={`${item.childItemCode}-${item.seq}`}
                  className={[
                    'flex items-center gap-2 px-2 py-1.5 rounded border-2 transition-colors',
                    isScanned
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                      : 'border-red-400 bg-red-50 dark:bg-red-900/10',
                  ].join(' ')}
                >
                  {/* 이미지 자리 */}
                  <div className="w-10 h-10 rounded bg-surface border border-border flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-text-muted opacity-40" />
                  </div>

                  {/* 정보 영역 */}
                  <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-2">
                    {/* 품목코드 | 소요수량 */}
                    <span className="text-xs font-bold text-text truncate">{item.childItemCode}</span>
                    <span className="text-xs font-bold text-text tabular-nums">{item.qtyPer}</span>

                    {/* 롯트번호 | 롯트수량 */}
                    {isScanned ? (
                      <>
                        <span className="text-xs text-green-700 dark:text-green-300 truncate font-medium">{scanned!.matUid}</span>
                        <span className="text-xs text-green-700 dark:text-green-300 tabular-nums font-medium">
                          {scanned!.initQty.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-red-500 dark:text-red-400 italic">{t('kiosk.material.noLot')}</span>
                        <span className="text-xs text-red-400">—</span>
                      </>
                    )}
                  </div>

                  {/* 롯트 취소 버튼 (스캔된 경우만) */}
                  {isScanned && (
                    <button
                      onClick={() => handleRemoveLot(item)}
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

      {/* 소모성 설비 부품 */}
      <div className="border-t border-border flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 bg-card px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.consumables')}</span>
        </div>
        {consumables.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs text-text-muted">{t('kiosk.material.noConsumables')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {consumables.map((item) => {
              const ratio = item.maxCount > 0 ? item.currentCount / item.maxCount : 0;
              const isWarning = ratio >= 0.8;
              return (
                <li key={item.id} className={`px-3 py-2 ${isWarning ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {ratio >= 1 && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    {ratio >= 0.8 && ratio < 1 && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
                    <span className="text-xs font-medium text-text truncate flex-1">{item.consumableName}</span>
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${lifeTextColor(item.currentCount, item.maxCount)}`}>
                      {item.currentCount.toLocaleString()} / {item.maxCount.toLocaleString()}
                    </span>
                  </div>
                  {item.maxCount > 0 && (
                    <div className="w-full bg-surface rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all ${lifeBarColor(item.currentCount, item.maxCount)}`}
                        style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
