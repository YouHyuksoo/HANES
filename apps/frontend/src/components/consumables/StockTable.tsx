"use client";

/**
 * @file src/pages/consumables/stock/components/StockTable.tsx
 * @description 소모품 재고현황 테이블 컴포넌트
 */
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { ComCodeBadge } from '@/components/ui';
import type { ConsumableStock } from '@/hooks/consumables/useStockData';

interface StockTableProps {
  data: ConsumableStock[];
  toolbarLeft?: ReactNode;
  isLoading?: boolean;
}

function StockTable({ data, toolbarLeft, isLoading }: StockTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ConsumableStock>[]>(
    () => [
      { accessorKey: 'consumableCode', header: t('consumables.comp.consumableCode'), size: 120 },
      { accessorKey: 'consumableName', header: t('consumables.comp.consumableName'), size: 150 },
      {
        accessorKey: 'category',
        header: t('consumables.comp.category'),
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={val} /> : '-';
        },
      },
      {
        accessorKey: 'stockQty',
        header: t('consumables.comp.currentStock'),
        size: 80,
        meta: { filterType: 'number' },
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
      { accessorKey: 'safetyStock', header: t('consumables.comp.safetyStock'), size: 80, meta: { filterType: 'number' } },
      {
        id: 'stockStatus',
        header: t('consumables.comp.stockStatus'),
        size: 90,
        cell: ({ row }) => {
          const qty = row.original.stockQty;
          const safety = row.original.safetyStock;
          if (qty === 0) {
            return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">{t('consumables.stock.statusOutOfStock')}</span>;
          }
          if (qty < safety) {
            return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">{t('consumables.stock.statusShortage')}</span>;
          }
          return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{t('consumables.stock.statusNormal')}</span>;
        },
      },
      {
        accessorKey: 'unitPrice',
        header: t('consumables.comp.unitPrice'),
        size: 100,
        meta: { filterType: 'number' },
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return val != null ? val.toLocaleString() + t('common.won') : '-';
        },
      },
      {
        id: 'stockValue',
        header: t('consumables.comp.stockValue'),
        size: 110,
        cell: ({ row }) => {
          const val = (row.original.unitPrice ?? 0) * row.original.stockQty;
          return val > 0 ? val.toLocaleString() + t('common.won') : '-';
        },
      },
      {
        accessorKey: 'location',
        header: t('consumables.comp.location'),
        size: 80,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'vendor',
        header: t('consumables.comp.vendor'),
        size: 100,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
    ],
    [t]
  );

  return <DataGrid data={data} columns={columns} isLoading={isLoading} enableExport exportFileName="consumable_stock" toolbarLeft={toolbarLeft} />;
}

export default StockTable;
