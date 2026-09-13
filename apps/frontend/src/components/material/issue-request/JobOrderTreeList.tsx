"use client";

/**
 * @file src/components/material/issue-request/JobOrderTreeList.tsx
 * @description 출고요청 화면 좌측 작업지시 트리 목록 (master)
 *
 * 초보자 가이드:
 * 1. **선택 대상 행**: 필터를 통과한 작업지시. 클릭하면 우측이 해당 지시 내역으로 바뀐다.
 * 2. **그룹 헤더 행**: 필터를 통과하지 못했지만 하위 지시의 계층을 보여주기 위해 남은 행(`_contextOnly`). 선택 불가, 접기/펼치기만 가능하다.
 * 3. **한 행 = 2줄**: 1줄 지시번호·품목코드·유형·상태 / 2줄 품목명·지시일자·계획수량
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { ComCodeBadge } from '@/components/ui';
import type { ProductionJobOrderRow } from '@harness/shared';
import { formatDateOnly } from '@/utils/date';

export type JobOrderListRow = ProductionJobOrderRow & { _depth?: number; _contextOnly?: boolean };

interface JobOrderTreeListProps {
  jobOrders: JobOrderListRow[];
  isLoading?: boolean;
  selectedOrderNo: string;
  onSelect: (order: JobOrderListRow) => void;
}

const toNum = (v: number | null | undefined) => Number(v ?? 0);

const itemTypeBadgeClass: Record<string, string> = {
  FINISHED: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800',
  SEMI_PRODUCT: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800',
};

export default function JobOrderTreeList({
  jobOrders,
  isLoading,
  selectedOrderNo,
  onSelect,
}: JobOrderTreeListProps) {
  const { t } = useTranslation();
  const [collapsedOrderNos, setCollapsedOrderNos] = useState<Set<string>>(() => new Set());

  const toggleOrderCollapse = useCallback((orderNo: string) => {
    setCollapsedOrderNos((prev) => {
      const next = new Set(prev);
      if (next.has(orderNo)) next.delete(orderNo);
      else next.add(orderNo);
      return next;
    });
  }, []);

  // 접힌 조상의 하위 행을 화면에서 제외한다(flat 배열이라 depth 비교로 판단).
  const visibleJobOrders = useMemo(() => {
    const hiddenAncestorDepths: number[] = [];
    return jobOrders.filter((order) => {
      const depth = order._depth ?? 0;
      while (hiddenAncestorDepths.length > 0 && depth <= hiddenAncestorDepths[hiddenAncestorDepths.length - 1]) {
        hiddenAncestorDepths.pop();
      }
      if (hiddenAncestorDepths.length > 0) return false;
      if ((order.children?.length ?? 0) > 0 && collapsedOrderNos.has(order.orderNo)) {
        hiddenAncestorDepths.push(depth);
      }
      return true;
    });
  }, [jobOrders, collapsedOrderNos]);

  const getJobOrderItemTypeMeta = useCallback((itemType?: string | null) => {
    if (!itemType) return null;
    const label = itemType === 'FINISHED'
      ? t('production.order.itemTypeFG', '완제품')
      : itemType === 'SEMI_PRODUCT'
        ? t('production.order.itemTypeWIP', '반제품')
        : itemType;
    return {
      label,
      className: itemTypeBadgeClass[itemType] ?? 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
    };
  }, [t]);

  return (
    <>
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
          {t('material.request.workOrderListTitle')}
          <span className="text-xs font-normal text-text-muted">({visibleJobOrders.length}/{jobOrders.length})</span>
        </h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : jobOrders.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            {t('material.request.noWorkOrder')}
          </div>
        ) : (
          <ul>
            {visibleJobOrders.map((order, index) => {
              const isGroupRow = !!order._contextOnly;
              const active = !isGroupRow && order.orderNo === selectedOrderNo;
              const depth = order._depth ?? 0;
              const childCount = order.children?.length ?? 0;
              const hasChildren = childCount > 0;
              const collapsed = collapsedOrderNos.has(order.orderNo);
              const itemTypeMeta = getJobOrderItemTypeMeta(order.part?.itemType);
              // 실측 데이터가 6단계까지 내려간다. 들여쓰기를 그대로 누적하면 지시번호가 잘리므로
              // 단계당 폭을 줄이고 최대 5단계까지만 들여쓴다(그 아래는 레일로만 구분).
              const indent = 12 + Math.min(depth, 5) * 12;
              const handleRowActivate = () => {
                if (isGroupRow) {
                  if (hasChildren) toggleOrderCollapse(order.orderNo);
                  return;
                }
                onSelect(order);
              };
              return (
                <li
                  key={order.orderNo}
                  className={
                    depth === 0
                      ? (index > 0 ? 'border-t-2 border-border' : '')
                      : 'border-t border-border/40'
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid={isGroupRow ? 'mat-request-order-group' : 'mat-request-order-row'}
                    onClick={handleRowActivate}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleRowActivate();
                      }
                    }}
                    style={{ paddingLeft: `${indent}px` }}
                    className={`relative w-full text-left pr-3 transition-colors border-l-2 ${
                      isGroupRow ? 'py-1.5' : 'py-2.5'
                    } ${
                      active
                        ? 'border-l-primary bg-primary/5'
                        : 'border-l-transparent hover:bg-card-hover'
                    }`}
                  >
                    {/* 계층 가이드 레일 - 상위 지시와 하위 지시를 세로선으로 잇는다 */}
                    {depth > 0 && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 w-px bg-border"
                        style={{ left: `${indent - 6}px` }}
                      />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {hasChildren ? (
                          <button
                            type="button"
                            aria-label={collapsed ? t('common.expand', '펼치기') : t('common.collapse', '접기')}
                            aria-expanded={!collapsed}
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors ${
                              collapsed
                                ? 'border-primary text-primary hover:bg-primary/10'
                                : 'border-border text-text-muted hover:border-text-muted hover:text-text'
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleOrderCollapse(order.orderNo);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleOrderCollapse(order.orderNo);
                              }
                            }}
                          >
                            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="h-6 w-6 shrink-0" />
                        )}
                        <span
                          className={`truncate font-mono ${
                            isGroupRow
                              ? 'text-[11px] font-medium text-text-muted'
                              : `text-xs font-semibold ${active ? 'text-primary' : 'text-text'}`
                          }`}
                        >
                          {order.orderNo}
                        </span>
                        {hasChildren && (
                          <span
                            title={collapsed ? t('common.expand', '펼치기') : t('common.collapse', '접기')}
                            className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none ring-1 ${
                              collapsed ? 'text-primary ring-primary' : 'text-text-muted ring-border'
                            }`}
                          >
                            {collapsed ? `+${childCount}` : childCount}
                          </span>
                        )}
                        {!isGroupRow && itemTypeMeta && (
                          <span
                            title={t('common.itemType', '품목유형')}
                            className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1 ${itemTypeMeta.className}`}
                          >
                            {itemTypeMeta.label}
                          </span>
                        )}
                      </div>
                      {isGroupRow ? (
                        <span className="flex min-w-0 shrink items-center gap-1.5 text-[11px] text-text-muted">
                          <span className="truncate">{order.part?.itemName ?? order.itemCode}</span>
                          {String(order.orderKind ?? 'ITEM').toUpperCase() === 'OPERATION' && (
                            <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none ring-1 text-amber-700 ring-amber-400 dark:text-amber-300 dark:ring-amber-600">
                              {t('production.order.orderKindOperation', '공정')}
                            </span>
                          )}
                        </span>
                      ) : (
                        <ComCodeBadge
                          groupCode="JOB_ORDER_STATUS"
                          code={String(order.status)}
                          className="shrink-0 whitespace-nowrap"
                        />
                      )}
                    </div>
                    {!isGroupRow && (
                      <div className="mt-0.5 flex items-center gap-2 pl-[30px] text-xs">
                        <span className="min-w-0 flex-1 truncate text-text">
                          {order.part?.itemName ?? order.itemCode}
                          {order.part?.itemName && order.itemCode && order.part.itemName !== order.itemCode && (
                            <span className="ml-1.5 font-mono text-[11px] text-text-muted">{order.itemCode}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-text-muted">
                          <CalendarDays className="h-3 w-3" />
                          <span className="font-mono">{formatDateOnly(order.planDate, '-')}</span>
                        </span>
                        <span className="shrink-0 text-text-muted">
                          {t('material.request.planQtyShort')} {toNum(order.planQty).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
