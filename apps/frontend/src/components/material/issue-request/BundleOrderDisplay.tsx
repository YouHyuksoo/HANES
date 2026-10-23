"use client";

/**
 * @file src/components/material/issue-request/BundleOrderDisplay.tsx
 * @description 묶음 출고요청 표시 공용 조각 — 묶인 작업지시 목록(배지)과 품목별 작업지시 수량 줄
 *
 * 초보자 가이드:
 * 1. 묶음 요청 = 같은 공정 작업지시 여러 건을 품목 합산 요청 1건으로 묶은 것(헤더 작업지시 없음).
 * 2. BundleOrderBadge: "묶음 N건" + 작업지시번호 목록. 출고요청 내역/목록/상세/출고 모달이 같이 쓴다.
 * 3. ItemOrderBreakdown: 품목 1줄 아래 "작업지시 요청/출고" 내역. focusOrderNo 를 주면 그 작업지시를 강조한다.
 */
import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';

export interface ItemOrderQty {
  orderNo: string;
  requestQty: number;
  issuedQty?: number;
}

const toNum = (v: number | null | undefined) => Number(v ?? 0);

export function BundleOrderBadge({ orderNos, className = '' }: { orderNos?: string[] | null; className?: string }) {
  const { t } = useTranslation();
  if (!orderNos || orderNos.length === 0) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`} title={orderNos.join(', ')}>
      <span className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none ring-1 ring-primary text-primary">
        <Layers className="h-3 w-3" />
        {t('material.request.bundleCount', { count: orderNos.length, defaultValue: '묶음 {{count}}건' })}
      </span>
      <span className="truncate font-mono text-xs text-text">{orderNos.join(', ')}</span>
    </span>
  );
}

export function ItemOrderBreakdown({
  orders,
  focusOrderNo,
  showIssued = true,
}: {
  orders?: ItemOrderQty[] | null;
  focusOrderNo?: string;
  showIssued?: boolean;
}) {
  if (!orders || orders.length === 0) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
      {orders.map((row) => (
        <span key={row.orderNo} className={row.orderNo === focusOrderNo ? 'font-semibold text-primary' : ''}>
          <span className="font-mono">{row.orderNo}</span>{' '}
          {toNum(row.requestQty).toLocaleString()}
          {showIssued && <> / {toNum(row.issuedQty).toLocaleString()}</>}
        </span>
      ))}
    </div>
  );
}
