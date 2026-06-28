"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface WipMatTransactionRow {
  transNo: string;
  transType: string;
  equipCode: string;
  equipName: string | null;
  itemCode: string;
  itemName: string | null;
  matUid: string;
  qty: number;
  fromWarehouseId: string | null;
  orderNo: string | null;
  refType: string | null;
  refId: string | null;
  cancelRefId: string | null;
  status: string;
  remark: string | null;
  workerId: string | null;
  createdAt: string | null;
}

/** 거래유형 색상: +수량=입고계열(blue), 소비=주황, 취소=빨강 */
const getTransTypeColor = (type: string) => {
  if (type.endsWith('_CANCEL')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (type === 'WIP_IN') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (type === 'PROD_CONSUME') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
};

interface CreateWipMaterialTransGridColumnsOptions {
  t: TFunction;
  getTransTypeLabel: (type: string) => string;
}

export function createWipMaterialTransGridColumns({
  t,
  getTransTypeLabel,
}: CreateWipMaterialTransGridColumnsOptions): ColumnDef<WipMatTransactionRow>[] {
  return [
    {
      accessorKey: 'createdAt', header: t('production.wipMaterialTrans.transDate'), size: 160,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleString() : '-';
      },
    },
    {
      accessorKey: 'transType', header: t('production.wipMaterialTrans.transType'), size: 130,
      meta: { filterType: 'multi' as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeColor(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: 'equipCode', header: t('common.equipCode', '설비코드'), size: 110,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'equipName', header: t('common.equipName', '설비명'), size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? '-',
    },
    {
      accessorKey: 'itemCode', header: t('common.partCode'), size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'itemName', header: t('common.partName'), size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? '-',
    },
    {
      accessorKey: 'matUid', header: t('production.wipMaterialTrans.lot'), size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'qty', header: t('production.wipMaterialTrans.qty'), size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? 'text-red-600 font-semibold text-right block' : 'text-blue-600 font-semibold text-right block'}>
          {row.original.qty > 0 ? '+' : ''}{(row.original.qty ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'refType', header: t('production.wipMaterialTrans.ref'), size: 180,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => {
        const { refType, refId } = row.original;
        if (!refType && !refId) return '-';
        return <span className="font-mono text-xs">{[refType, refId].filter(Boolean).join(' / ')}</span>;
      },
    },
    {
      accessorKey: 'remark', header: t('production.wipMaterialTrans.remark'), size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
  ];
}
