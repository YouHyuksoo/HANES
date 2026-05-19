"use client";

/**
 * @file components/MaterialListPanel.tsx
 * @description 좌측 패널 — BOM 자재리스트 + 소모성 설비 부품 현황
 *
 * 초보자 가이드:
 * - BOM: GET /master/boms/parent/:itemCode (작업지시의 품목코드 기준)
 * - 소모성 부품: GET /equipment/consumables/mounted/:equipCode (설비에 장착된 소모품)
 * - 수명 경고: currentCount / maxCount 기준으로 80% 이상이면 주황, 100% 이상이면 빨강
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, AlertTriangle, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import { useKioskStore } from '@/stores/kioskStore';

interface BomItem {
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
  imageUrl?: string;
}

function lifeColor(current: number, max: number): string {
  if (max <= 0) return '';
  const ratio = current / max;
  if (ratio >= 1) return 'text-red-600 dark:text-red-400';
  if (ratio >= 0.8) return 'text-orange-500 dark:text-orange-400';
  return 'text-text-muted';
}

function lifeBarColor(current: number, max: number): string {
  if (max <= 0) return 'bg-gray-300';
  const ratio = current / max;
  if (ratio >= 1) return 'bg-red-500';
  if (ratio >= 0.8) return 'bg-orange-400';
  return 'bg-green-500';
}

export default function MaterialListPanel() {
  const { t } = useTranslation();
  const { selectedJobOrder, selectedEquip } = useKioskStore();
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* BOM 자재리스트 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="sticky top-0 bg-card px-3 py-2 border-b border-border/50 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-text">{t('kiosk.material.bomList')}</span>
          <span className="ml-auto text-xs text-text-muted">{bomItems.length}{t('kiosk.material.unit')}</span>
        </div>
        {bomItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted">
            <Package className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">{t('kiosk.material.noBom')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {bomItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface/50 transition-colors">
                {/* 품목 이미지 자리 */}
                <div className="w-9 h-9 rounded bg-surface border border-border flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-text-muted opacity-50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{item.childItemCode}</p>
                  {item.childItemName && (
                    <p className="text-xs text-text-muted truncate">{item.childItemName}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-text shrink-0 tabular-nums">
                  {item.qtyPer.toLocaleString()}
                </span>
              </li>
            ))}
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
                    <span className={`text-xs font-bold tabular-nums shrink-0 ${lifeColor(item.currentCount, item.maxCount)}`}>
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
