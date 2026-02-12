"use client";

/**
 * @file src/pages/consumables/stock/components/StockTable.tsx
 * @description 소모품 재고현황 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { ConsumableStock } from '@/hooks/consumables/useStockData';

const categoryLabels: Record<string, string> = {
  MOLD: '금형',
  JIG: '지그',
  TOOL: '공구',
};

interface StockTableProps {
  data: ConsumableStock[];
}

function StockTable({ data }: StockTableProps) {
  const columns = useMemo<ColumnDef<ConsumableStock>[]>(
    () => [
      { accessorKey: 'consumableCode', header: '소모품코드', size: 120 },
      { accessorKey: 'name', header: '소모품명', size: 150 },
      {
        accessorKey: 'category',
        header: '카테고리',
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? categoryLabels[val] ?? val : '-';
        },
      },
      {
        accessorKey: 'stockQty',
        header: '현재고',
        size: 80,
        cell: ({ row }) => {
          const qty = row.original.stockQty;
          const safety = row.original.safetyStock;
          const isLow = qty < safety;
          const isZero = qty === 0;
          return (
            <span className={
              isZero ? 'text-red-600 dark:text-red-400 font-bold' :
              isLow ? 'text-orange-600 dark:text-orange-400 font-semibold' :
              'text-text'
            }>
              {qty}
            </span>
          );
        },
      },
      { accessorKey: 'safetyStock', header: '안전재고', size: 80 },
      {
        id: 'stockStatus',
        header: '재고상태',
        size: 90,
        cell: ({ row }) => {
          const qty = row.original.stockQty;
          const safety = row.original.safetyStock;
          if (qty === 0) {
            return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">재고없음</span>;
          }
          if (qty < safety) {
            return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">부족</span>;
          }
          return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">정상</span>;
        },
      },
      {
        accessorKey: 'unitPrice',
        header: '단가',
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return val != null ? val.toLocaleString() + '원' : '-';
        },
      },
      {
        id: 'stockValue',
        header: '재고금액',
        size: 110,
        cell: ({ row }) => {
          const val = (row.original.unitPrice ?? 0) * row.original.stockQty;
          return val > 0 ? val.toLocaleString() + '원' : '-';
        },
      },
      {
        accessorKey: 'location',
        header: '보관위치',
        size: 80,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'vendor',
        header: '공급업체',
        size: 100,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
    ],
    []
  );

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}

export default StockTable;
