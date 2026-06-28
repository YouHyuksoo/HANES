"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface InspectInput {
  id: string;
  orderNo: string;
  itemName: string;
  matUid: string;
  inspectQty: number;
  passQty: number;
  failQty: number;
  passYn: string;
  inspectDate: string;
  inspector: string;
  remark: string;
}

interface CreateInputInspectGridColumnsOptions {
  t: TFunction;
}

export function createInputInspectGridColumns({
  t,
}: CreateInputInspectGridColumnsOptions): ColumnDef<InspectInput>[] {
  return [
    { accessorKey: 'orderNo', header: t('production.inputInspect.orderNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('production.inputInspect.partName'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'matUid', header: t('production.inputInspect.matUid'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'inspectQty', header: t('production.inputInspect.inspectQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString() },
    { accessorKey: 'passQty', header: t('production.inputInspect.pass'), size: 80, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: 'failQty', header: t('production.inputInspect.fail'), size: 80, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    {
      accessorKey: 'passYn', header: t('production.inputInspect.judgment'), size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('production.inputInspect.pass')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('production.inputInspect.fail')}</span>;
      },
    },
    { accessorKey: 'inspector', header: t('production.inputInspect.inspector'), size: 80, meta: { filterType: 'text' as const } },
    { accessorKey: 'inspectDate', header: t('production.inputInspect.inspectDate'), size: 100, meta: { filterType: 'date' as const } },
  ];
}
