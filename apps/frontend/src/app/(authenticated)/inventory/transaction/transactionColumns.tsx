"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface TransactionData {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  fromWarehouseCode?: string;
  toWarehouseCode?: string;
  itemCode: string;
  matUid?: string;
  qty: number;
  unitPrice?: number;
  totalAmount?: number;
  refType?: string;
  refId?: string;
  cancelRefId?: string;
  status: string;
  workerId?: string;
  remark?: string;
  fromWarehouse?: { warehouseCode: string; warehouseName: string };
  toWarehouse?: { warehouseCode: string; warehouseName: string };
  part: { itemCode: string; itemName: string };
  lot?: { matUid: string };
  cancelRef?: { transNo: string };
}

const getTransTypeColor = (type: string) => {
  const isCancel = type.includes('CANCEL');
  const isIn = type.includes('IN') || type.includes('PLUS') || type === 'RECEIVE';
  const isOut = type.includes('OUT') || type.includes('MINUS') || type.includes('SCRAP');

  if (isCancel) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (isIn) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (type === 'PROD_CONSUME' || isOut) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  if (type === 'TRANSFER' || type === 'WIP_MOVE') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
};

interface CreateTransactionGridColumnsOptions {
  t: TFunction;
  getTransTypeLabel: (type: string) => string;
}

export function createTransactionGridColumns({
  t,
  getTransTypeLabel,
}: CreateTransactionGridColumnsOptions): ColumnDef<TransactionData>[] {
  return [
    {
      accessorKey: 'transNo',
      header: t('inventory.transaction.transNo'),
      size: 160,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'transType',
      header: t('inventory.transaction.transType'),
      size: 130,
      meta: { filterType: 'multi' as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeColor(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: 'transDate',
      header: t('inventory.transaction.transDate'),
      size: 150,
      meta: { filterType: 'date' as const },
      cell: ({ row }) => new Date(row.original.transDate).toLocaleString(),
    },
    {
      accessorKey: 'fromWarehouse',
      header: t('inventory.transaction.fromWarehouse'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.fromWarehouse?.warehouseCode || '-',
    },
    {
      accessorKey: 'toWarehouse',
      header: t('inventory.transaction.toWarehouse'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.toWarehouse?.warehouseCode || '-',
    },
    {
      accessorKey: 'itemCode',
      header: t('inventory.transaction.partCode'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.part.itemCode,
    },
    {
      accessorKey: 'itemName',
      header: t('inventory.transaction.partName'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.part.itemName,
    },
    {
      accessorKey: 'matUid',
      header: t('inventory.transaction.lot'),
      size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.lot?.matUid || '-',
    },
    {
      accessorKey: 'qty',
      header: t('inventory.transaction.qty'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold'}>
          {row.original.qty > 0 ? '+' : ''}{row.original.qty.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('inventory.transaction.status')} codeType="PROD_RESULT_STATUS" align="center" />,
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="PROD_RESULT_STATUS" value={getValue() as string} />,
    },
    {
      accessorKey: 'cancelRef',
      header: t('inventory.transaction.original'),
      size: 130,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.cancelRef?.transNo || '-',
    },
    {
      accessorKey: 'remark',
      header: t('inventory.transaction.remark'),
      size: 150,
      meta: { filterType: 'text' as const },
    },
  ];
}
