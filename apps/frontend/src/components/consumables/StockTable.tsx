"use client";

/**
 * @file src/components/consumables/StockTable.tsx
 * @description 소모품 재고현황 테이블 — conUid별 개별 인스턴스 표시
 *
 * 초보자 가이드:
 * 1. conUid: 개별 인스턴스 식별자 (라벨에 인쇄된 바코드)
 * 2. status: CON_STOCK_STATUS 공통코드로 배지 표시
 * 3. currentCount: 현재 사용횟수 / expectedLife: 기대수명
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
      {
        accessorKey: 'conUid',
        header: t('consumables.stock.conUid'),
        size: 150,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'consumableCode',
        header: t('consumables.comp.consumableCode'),
        size: 120,
        meta: { filterType: 'text' as const },
      },
      {
        accessorKey: 'consumableName',
        header: t('consumables.comp.consumableName'),
        size: 150,
        meta: { filterType: 'text' as const },
      },
      {
        accessorKey: 'category',
        header: t('consumables.comp.category'),
        size: 80,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={val} /> : '-';
        },
      },
      {
        accessorKey: 'status',
        header: t('consumables.stock.instanceStatus'),
        size: 100,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return <ComCodeBadge groupCode="CON_STOCK_STATUS" code={val} />;
        },
      },
      {
        accessorKey: 'currentCount',
        header: t('consumables.stock.shotCount'),
        size: 100,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => {
          const count = row.original.currentCount;
          const life = row.original.expectedLife;
          if (!life) return count.toLocaleString();
          const ratio = count / life;
          const color = ratio >= 1
            ? 'text-red-600 dark:text-red-400 font-bold'
            : ratio >= 0.8
              ? 'text-orange-600 dark:text-orange-400 font-semibold'
              : 'text-text';
          return (
            <span className={color}>
              {count.toLocaleString()} / {life.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: 'location',
        header: t('consumables.comp.location'),
        size: 80,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'mountedEquipCode',
        header: t('consumables.stock.mountedEquip'),
        size: 110,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'recvDate',
        header: t('consumables.stock.recvDate'),
        size: 110,
        meta: { filterType: 'date' as const },
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? val.toString().slice(0, 10) : '-';
        },
      },
      {
        accessorKey: 'vendorName',
        header: t('consumables.comp.vendorName'),
        size: 100,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'unitPrice',
        header: t('consumables.comp.unitPrice'),
        size: 90,
        meta: { filterType: 'number' as const },
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return val != null ? val.toLocaleString() + t('common.won') : '-';
        },
      },
    ],
    [t]
  );

  return (
    <DataGrid
      data={data}
      columns={columns}
      isLoading={isLoading}
      enableColumnFilter
      enableExport
      exportFileName="consumable_stock"
      toolbarLeft={toolbarLeft}
    />
  );
}

export default StockTable;
