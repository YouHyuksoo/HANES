'use client';

/**
 * @file components/useReceiveLabelColumns.tsx
 * @description 입고라벨 DataGrid 컬럼 정의 훅 (입하 기반)
 *
 * 초보자 가이드:
 * 1. DataGrid에 표시할 컬럼(입하번호, 품목코드, 수량 등)을 정의
 * 2. 체크박스 컬럼으로 전체/개별 선택 가능
 * 3. 각 컬럼에 필터 타입(text, number, date) 지정
 * 4. LabelableArrival 인터페이스는 GET /material/receive-label/arrivals 응답과 일치
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';

/** IQC 합격 입하 건 (API 응답과 일치하는 flat 구조) */
export interface LabelableArrival {
  id: number;
  arrivalNo: string;
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  poNo: string | null;
  vendor: string | null;
  supUid: string | null;
  invoiceNo: string | null;
  iqcStatus: string;
  arrivalDate: string | Date;
  labelPrinted: boolean;
}

interface UseReceiveLabelColumnsParams {
  /** 전체 선택 여부 */
  allSelected: boolean;
  /** 선택된 arrival id Set */
  selectedIds: Set<number>;
  /** 전체 선택/해제 토글 */
  toggleAll: (checked: boolean) => void;
  /** 개별 선택 토글 */
  toggleItem: (id: number) => void;
}

/** DataGrid 컬럼 정의 훅 */
export function useReceiveLabelColumns({
  allSelected, selectedIds, toggleAll, toggleItem,
}: UseReceiveLabelColumnsParams) {
  const { t } = useTranslation();

  return useMemo<ColumnDef<LabelableArrival>[]>(
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
      {
        id: 'arrivalNo', accessorKey: 'arrivalNo',
        header: t('material.receiveLabel.col.arrivalNo'), size: 140,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.arrivalNo}</span>
        ),
      },
      {
        id: 'itemCode', accessorKey: 'itemCode',
        header: t('common.partCode'), size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.itemCode || '-',
      },
      {
        id: 'itemName', accessorKey: 'itemName',
        header: t('common.partName'), size: 150,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.itemName || '-',
      },
      {
        id: 'qty', accessorKey: 'qty',
        header: t('material.receiveLabel.qty'), size: 80,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.qty.toLocaleString()}</span>
        ),
      },
      {
        id: 'vendor', accessorKey: 'vendor',
        header: t('material.arrival.col.vendor'), size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.vendor || '-',
      },
      {
        id: 'poNo', accessorKey: 'poNo',
        header: t('material.arrival.col.poNo'), size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ row }) => row.original.poNo || '-',
      },
      {
        id: 'arrivalDate', accessorKey: 'arrivalDate',
        header: t('material.col.arrivalDate'), size: 100,
        meta: { filterType: 'date' as const },
        cell: ({ row }) => row.original.arrivalDate?.toString().slice(0, 10) || '-',
      },
      {
        id: 'labelPrinted', accessorKey: 'labelPrinted',
        header: t('material.receiveLabel.col.labelStatus'), size: 100,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => {
          const printed = row.original.labelPrinted;
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              printed
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>
              {printed
                ? t('material.receiveLabel.labelIssued')
                : t('material.receiveLabel.labelNotIssued')}
            </span>
          );
        },
      },
    ],
    [t, allSelected, selectedIds, toggleAll, toggleItem],
  );
}
