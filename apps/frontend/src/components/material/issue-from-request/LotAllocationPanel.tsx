'use client';

/**
 * @file components/material/issue-from-request/LotAllocationPanel.tsx
 * @description 출고 모달 우측 — 선택 품목의 FIFO(입고일 오름차순) LOT 배분 패널.
 *
 * 배분은 수량 계산이다. 실물 LOT 분할(신규 시리얼 발번)은 모달의 [분할 및 라벨발행] 단계에서 한다.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Scissors, RotateCcw, Wand2 } from 'lucide-react';
import type { AllocationSlice } from '@harness/shared';
import { Button } from '@/components/ui';
import { QtyInput } from '@/components/shared';
import type { AvailableStock, IssueRow } from './types';
import { fmtRecvDate, stockAvailableQty } from './types';

interface Props {
  row: IssueRow | null;
  lots: AvailableStock[];
  slices: AllocationSlice[];
  isLoading: boolean;
  /** 분할/조회 시도 실패 메시지 — 분할 가능 여부는 서버가 판정하므로 그 메시지를 그대로 노출한다 */
  warning?: string | null;
  onChange: (matUid: string, qty: number) => void;
  onAutoAllocate: () => void;
  onReset: () => void;
}

export default function LotAllocationPanel({
  row, lots, slices, isLoading, warning, onChange, onAutoAllocate, onReset,
}: Props) {
  const { t } = useTranslation();
  const qtyOf = (matUid: string) => slices.find((s) => s.matUid === matUid)?.qty ?? 0;

  if (!row) {
    return (
      <div className="h-full flex items-center justify-center border border-border rounded-lg text-xs text-text-muted">
        {t('material.issue.selectRequestItem', { defaultValue: '좌측에서 품목을 선택하세요.' })}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden border border-border rounded-lg">
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-semibold text-text truncate">
          {row.itemName}
          <span className="ml-1.5 font-normal text-text-muted">
            {t('material.issue.targetQty', { defaultValue: '실출고' })} {row.packRemainQty.toLocaleString()} {row.unit}
          </span>
        </span>
        <div className="ml-auto flex gap-1.5">
          <Button variant="secondary" size="sm" onClick={onReset} className="h-7 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" />
            {t('material.issue.resetAllocation', { defaultValue: '배분 초기화' })}
          </Button>
          <Button size="sm" onClick={onAutoAllocate} className="h-7 text-xs">
            <Wand2 className="w-3 h-3 mr-1" />
            {t('material.issue.autoAllocate', { defaultValue: 'FIFO 자동배분' })}
          </Button>
        </div>
      </div>

      {warning && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 border-b border-border">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {warning}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            {t('material.issue.lotLoading', { defaultValue: 'LOT 조회 중' })}
          </div>
        ) : lots.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 mx-auto mb-1" />
            {t('material.issue.noAvailableLot', { defaultValue: '출고 가능 LOT 없음 (창고재고 0)' })}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted dark:bg-slate-800 sticky top-0 z-10">
              <tr className="text-left text-text-muted">
                <th className="px-2 py-1.5 w-8">#</th>
                <th className="px-2 py-1.5">{t('material.col.matUid', { defaultValue: 'LOT' })}</th>
                <th className="px-2 py-1.5">{t('material.col.recvDate', { defaultValue: '입고일' })}</th>
                <th className="px-2 py-1.5 text-right">{t('material.issue.availableQty', { defaultValue: '가용' })}</th>
                <th className="px-2 py-1.5 text-right w-32">{t('material.issue.allocateQty', { defaultValue: '배분수량' })}</th>
                <th className="px-2 py-1.5 text-right">{t('material.issue.lotRemainQty', { defaultValue: '잔량' })}</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, i) => {
                const available = stockAvailableQty(lot);
                const qty = qtyOf(lot.matUid);
                const lotRemain = available - qty;
                return (
                  <tr key={lot.matUid} className="border-t border-border">
                    <td className="px-2 py-1.5 text-text-muted">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className="font-mono font-medium text-text truncate">{lot.matUid}</div>
                      <div className="text-[10px] text-text-muted truncate">
                        {lot.warehouseName ?? lot.warehouseCode}
                        {i === 0 && (
                          <span className="ml-1 px-1 rounded border border-primary/40 text-primary">
                            {t('material.issue.fifoFirst', { defaultValue: '선입' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">{fmtRecvDate(lot.recvDate)}</td>
                    <td className="px-2 py-1.5 text-right text-text whitespace-nowrap">{available.toLocaleString()}</td>
                    <td className="px-2 py-1.5">
                      <QtyInput
                        value={qty}
                        onChange={(next) => onChange(lot.matUid, next)}
                        maxValue={available}
                        className="text-right h-8"
                        fullWidth
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {qty > 0 && lotRemain > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Scissors className="w-3 h-3" />
                          {lotRemain.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-text-muted">{lotRemain.toLocaleString()}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
