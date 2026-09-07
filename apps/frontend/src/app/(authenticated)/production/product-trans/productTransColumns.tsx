"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface ProductTransactionRow {
  transNo: string;
  transType: string;
  transDate: string | null;
  itemCode: string;
  itemType: string | null;
  qualityStatus: string;
  qty: number;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  orderNo: string | null;
  processCode: string | null;
  refType: string | null;
  refId: string | null;
  workerId: string | null;
  remark: string | null;
  part: { itemCode: string; itemName: string } | null;
  fromWarehouse: { warehouseCode: string; warehouseName: string } | null;
  toWarehouse: { warehouseCode: string; warehouseName: string } | null;
}

/** 거래유형 색상: 입고계열(blue), 출고계열(orange), 취소(red) */
const getTransTypeColor = (type: string) => {
  if (type.endsWith('_CANCEL')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (type.endsWith('_IN')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
  if (type.endsWith('_OUT')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
};

interface CreateProductTransGridColumnsOptions {
  t: TFunction;
  getTransTypeLabel: (type: string) => string;
  getItemTypeLabel: (type: string | null) => string;
  getQualityLabel: (status: string) => string;
}

export function createProductTransGridColumns({
  t,
  getTransTypeLabel,
  getItemTypeLabel,
  getQualityLabel,
}: CreateProductTransGridColumnsOptions): ColumnDef<ProductTransactionRow>[] {
  return [
    {
      accessorKey: 'transDate', header: t('production.productTrans.transDate'), size: 160,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleString() : '-';
      },
    },
    {
      accessorKey: 'transType', header: t('production.productTrans.transType'), size: 130,
      meta: { filterType: 'multi' as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeColor(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: 'itemType', header: t('production.productTrans.itemType'), size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => getItemTypeLabel(getValue() as string | null),
    },
    {
      accessorKey: 'itemCode', header: t('production.productTrans.itemCode'), size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      id: 'itemName', header: t('production.productTrans.itemName'), size: 150,
      accessorFn: (row) => row.part?.itemName ?? '',
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.part?.itemName ?? '-',
    },
    {
      accessorKey: 'qualityStatus', header: t('production.productTrans.qualityStatus'), size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => getQualityLabel(getValue() as string),
    },
    {
      accessorKey: 'qty', header: t('production.productTrans.qty'), size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? 'text-red-600 font-semibold text-right block' : 'text-blue-600 font-semibold text-right block'}>
          {row.original.qty > 0 ? '+' : ''}{(row.original.qty ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'fromWarehouse', header: t('production.productTrans.fromWarehouse'), size: 140,
      accessorFn: (row) => row.fromWarehouse?.warehouseName ?? '',
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.fromWarehouse?.warehouseName ?? '-',
    },
    {
      id: 'toWarehouse', header: t('production.productTrans.toWarehouse'), size: 140,
      accessorFn: (row) => row.toWarehouse?.warehouseName ?? '',
      meta: { filterType: 'text' as const },
      cell: ({ row }) => row.original.toWarehouse?.warehouseName ?? '-',
    },
    {
      accessorKey: 'orderNo', header: t('production.productTrans.orderNo'), size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || '-'}</span>,
    },
    {
      accessorKey: 'processCode', header: t('production.productTrans.processCode'), size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
    {
      id: 'ref', header: t('production.productTrans.refType'), size: 180,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => {
        const { refType, refId } = row.original;
        if (!refType && !refId) return '-';
        return <span className="font-mono text-xs">{[refType, refId].filter(Boolean).join(' / ')}</span>;
      },
    },
    {
      accessorKey: 'workerId', header: t('production.productTrans.worker'), size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
    {
      accessorKey: 'remark', header: t('production.productTrans.remark'), size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
  ];
}
