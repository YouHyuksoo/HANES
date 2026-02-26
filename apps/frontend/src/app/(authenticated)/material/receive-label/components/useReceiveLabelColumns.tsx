'use client';

/**
 * @file components/useReceiveLabelColumns.tsx
 * @description 입고라벨 DataGrid 컬럼 정의 훅
 *
 * 초보자 가이드:
 * 1. DataGrid에 표시할 컬럼(LOT번호, 품목코드, 수량 등)을 정의
 * 2. 체크박스 컬럼으로 전체/개별 선택 가능
 * 3. 각 컬럼에 필터 타입(text, number, date) 지정
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';

/** IQC 합격 LOT 아이템 (컬럼 렌더링용) */
export interface PassedLot {
  id: string;
  lotNo: string;
  itemCode: string;
  itemType: string;
  initQty: number;
  currentQty: number;
  recvDate?: string | null;
  poNo?: string | null;
  vendor?: string | null;
  iqcStatus: string;
  receivedQty: number;
  remainingQty: number;
  part: { id: string; itemCode: string; itemName: string; unit: string };
}

interface UseReceiveLabelColumnsParams {
  allSelected: boolean;
  selectedIds: Set<string>;
  toggleAll: (checked: boolean) => void;
  toggleItem: (id: string) => void;
}

/** DataGrid 컬럼 정의 훅 */
export function useReceiveLabelColumns({
  allSelected, selectedIds, toggleAll, toggleItem,
}: UseReceiveLabelColumnsParams) {
  const { t } = useTranslation();

  return useMemo<ColumnDef<PassedLot>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input type="checkbox" checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            className="w-4 h-4 accent-primary" />
        ),
        size: 40,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => (
          <input type="checkbox" checked={selectedIds.has(row.original.id)}
            onChange={() => toggleItem(row.original.id)}
            className="w-4 h-4 accent-primary" />
        ),
      },
      { id: 'lotNo', header: t('material.col.lotNo'), size: 160,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.lotNo}</span> },
      { id: 'partCode', header: t('common.partCode'), size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.part.itemCode },
      { id: 'partName', header: t('common.partName'), size: 150,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.part.itemName },
      { id: 'initQty', header: t('material.receiveLabel.qty'), size: 80,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.initQty.toLocaleString()}</span>
        ) },
      { id: 'labelCount', header: t('material.receiveLabel.labelCount'), size: 80,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => (
          <span className="text-primary font-bold">
            {row.original.initQty.toLocaleString()}{t('material.receiveLabel.sheets')}
          </span>
        ) },
      { id: 'vendor', header: t('material.arrival.col.vendor'), size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.vendor || '-' },
      { id: 'poNo', header: t('material.arrival.col.poNo'), size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.poNo || '-' },
      { id: 'recvDate', header: t('material.col.arrivalDate'), size: 100,
        meta: { filterType: 'date' as const },
        cell: ({ row }) => row.original.recvDate?.slice(0, 10) || '-' },
    ],
    [t, allSelected, selectedIds, toggleAll, toggleItem],
  );
}
