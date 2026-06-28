"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface WipMatStockRow {
  equipCode: string;
  equipName: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  availableQty: number;
  reservedQty: number;
  lotCount: number;
}

interface CreateWipMaterialStockGridColumnsOptions {
  t: TFunction;
}

export function createWipMaterialStockGridColumns({
  t,
}: CreateWipMaterialStockGridColumnsOptions): ColumnDef<WipMatStockRow>[] {
  return [
    {
      accessorKey: 'equipCode',
      header: t('production.wipMaterialStock.equipCode', '설비코드'),
      size: 130,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: 'equipName',
      header: t('production.wipMaterialStock.equipName'),
      size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'itemCode',
      header: t('production.wipMaterialStock.partCode'),
      size: 110,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: 'itemName',
      header: t('common.partName'),
      size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'qty',
      header: t('production.wipMaterialStock.qty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <span className={`font-medium text-right block ${v > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-text-muted'}`}>
            {(v ?? 0).toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: 'availableQty',
      header: t('production.wipMaterialStock.availableQty'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <span className={`text-right block ${v > 0 ? 'text-green-600 dark:text-green-400' : 'text-text-muted'}`}>
            {(v ?? 0).toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: 'lotCount',
      header: t('production.wipMaterialStock.lotCount', 'LOT 수'),
      size: 70,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => (
        <span className="text-center block text-text-muted text-sm">{(getValue() as number) ?? 0}</span>
      ),
    },
  ];
}
