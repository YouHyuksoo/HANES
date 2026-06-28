"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface EquipInspect {
  id: string;
  orderNo: string;
  itemName: string;
  equipName: string;
  matUid: string;
  measuredValue: number;
  lowerLimit: number;
  upperLimit: number;
  passYn: string;
  inspectDate: string;
  inspector: string;
}

interface CreateInputEquipGridColumnsOptions {
  t: TFunction;
}

export function createInputEquipGridColumns({
  t,
}: CreateInputEquipGridColumnsOptions): ColumnDef<EquipInspect>[] {
  return [
    { accessorKey: 'orderNo', header: t('production.inputEquip.orderNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('production.inputEquip.partName'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'equipName', header: t('production.inputEquip.inspectEquip'), size: 110, meta: { filterType: 'text' as const } },
    { accessorKey: 'matUid', header: t('production.inputEquip.matUid'), size: 150, meta: { filterType: 'text' as const } },
    {
      id: 'range', header: t('production.inputEquip.inspectRange'), size: 120,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => <span className="text-text-muted text-xs">{row.original.lowerLimit} ~ {row.original.upperLimit}</span>,
    },
    {
      accessorKey: 'measuredValue', header: t('production.inputEquip.measuredValue'), size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => {
        const { measuredValue, lowerLimit, upperLimit } = row.original;
        const inRange = measuredValue >= lowerLimit && measuredValue <= upperLimit;
        return <span className={inRange ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>{measuredValue}</span>;
      },
    },
    {
      accessorKey: 'passYn', header: t('production.inputEquip.judgment'), size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('production.inputEquip.pass')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('production.inputEquip.fail')}</span>;
      },
    },
    { accessorKey: 'inspector', header: t('production.inputEquip.inspector'), size: 80, meta: { filterType: 'text' as const } },
    { accessorKey: 'inspectDate', header: t('production.inputEquip.inspectDate'), size: 100, meta: { filterType: 'date' as const } },
  ];
}
