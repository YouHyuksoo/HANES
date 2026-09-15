'use client';

/**
 * @file components/material/issue-from-request/LotAllocationPanel.tsx
 * @description 출고 모달 우측 — 선택 품목의 FIFO(서버 정렬 순서) LOT 배분 패널.
 *
 * 정렬 기준일은 서버가 sys-config FIFO_CRITERIA 로 정하고 행마다 내려준다(입고일 또는 제조일자).
 * 출고 정책이 FIFO 위반을 판정하는 기준과 같아야 하므로 프론트는 재정렬하지 않고 그 순서를 그대로 쓴다.
 *
 * 배분은 수량 계산이다. 실물 LOT 분할(신규 시리얼 발번)은 모달의 [분할 및 라벨발행] 단계에서 한다.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Scissors, RotateCcw, Wand2 } from 'lucide-react';
import type { AllocationSlice } from '@harness/shared';
import { Button } from '@/components/ui';
import { QtyInput } from '@/components/shared';
import type { AvailableStock, IssueRow } from './types';
import { fifoCriteriaOf, fifoDateOf, fmtRecvDate, stockAvailableQty } from './types';

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
  const fifoCriteria = fifoCriteriaOf(lots);

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
                <th className="px-2 py-1.5">
                  {fifoCriteria === 'MFG_DATE'
                    ? t('material.col.manufactureDate', { defaultValue: '제조일자' })
                    : t('material.col.recvDate', { defaultValue: '입고일' })}
                </th>
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
                    <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">
                      {fmtRecvDate(fifoDateOf(lot, fifoCriteria))}
                    </td>
                    <td className="px-2 py-1.5 text-right text-text whitespace-nowrap">
                      {available.toLocaleString()}
                      {/* 소수 가용분은 배분하지 않는다(출고 수량은 정수만 허용). 왜 0 으로 남는지 보여준다 */}
                      {available < 1 && (
                        <span className="ml-1 text-[10px] text-text-muted">
                          {t('material.issue.fractionUnusable', { defaultValue: '1 미만 · 배분 불가' })}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <QtyInput
                        value={qty}
                        onChange={(next) => onChange(lot.matUid, next)}
                        // 소수 가용분으로 클램프하면 정수 입력이 소수로 잘려 출고가 400 이 된다
                        // (issueQty 는 @IsInt). 배분 가능한 정수분까지만 허용한다.
                        maxValue={Math.floor(available)}
                        className="text-right h-8"
                        fullWidth
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {/*
                        분할 뱃지 조건은 모달의 splitTargets 와 같아야 한다. 잔량이 1 미만이면
                        자식 LOT 의 INIT_QTY(정수 컬럼)를 만들 수 없어 분할하지 않고 그대로
                        부분 출고되므로, 라벨 수량이 실물과 어긋난다는 것을 여기서 알린다(설계 §9).
                      */}
                      {qty > 0 && lotRemain >= 1 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Scissors className="w-3 h-3" />
                          {lotRemain.toLocaleString()}
                        </span>
                      ) : qty > 0 && lotRemain > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {t('material.issue.splitNotPossible', { defaultValue: '분할불가 · 라벨수량 불일치' })}
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
