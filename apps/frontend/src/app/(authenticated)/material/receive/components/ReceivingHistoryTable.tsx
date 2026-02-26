"use client";

/**
 * @file src/app/(authenticated)/material/receive/components/ReceivingHistoryTable.tsx
 * @description 입고 이력 테이블 - MAT_RECEIVINGS 기반 입고 이력 표시
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { ReceivingRecord } from './types';

interface ReceivingHistoryTableProps {
  data: ReceivingRecord[];
}

export default function ReceivingHistoryTable({ data }: ReceivingHistoryTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ReceivingRecord>[]>(() => [
    { accessorKey: 'receiveNo', header: t('material.receive.col.receiveNo', '입고번호'), size: 180, meta: { filterType: "text" as const } },
    {
      accessorKey: 'transDate',
      header: t('material.receive.col.receivedDate'),
      size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string).slice(0, 10),
    },
    { id: 'lotNo', header: t('material.col.lotNo'), size: 150, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.lot?.lotNo || '-' },
    { id: 'poNo', header: t('material.arrival.col.poNo'), size: 120, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.lot?.poNo || '-' },
    { id: 'partCode', header: t('common.partCode'), size: 100, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part?.itemCode },
    { id: 'partName', header: t('common.partName'), size: 130, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part?.itemName },
    {
      accessorKey: 'qty',
      header: t('common.quantity'),
      size: 100,
      meta: { filterType: "number" as const },
      cell: ({ row }) => (
        <span className="text-green-600 font-medium">
          +{row.original.qty.toLocaleString()} {row.original.part?.unit}
        </span>
      ),
    },
    {
      id: 'warehouse',
      header: t('material.arrival.col.warehouse'),
      size: 100,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || '-',
    },
    {
      accessorKey: 'remark',
      header: t('common.remark'),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-text-muted">{(getValue() as string) || '-'}</span>,
    },
  ], [t]);

  return <DataGrid data={data} columns={columns} pageSize={10} enableColumnFilter />;
}
