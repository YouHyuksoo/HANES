"use client";

/**
 * @file src/app/(authenticated)/material/receive/components/ReceivingHistoryTable.tsx
 * @description 입고 이력 테이블 - MAT_RECEIVINGS 기반 입고 이력 표시
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { ReceivingRecord } from './types';

interface ReceivingHistoryTableProps {
  data: ReceivingRecord[];
  isLoading?: boolean;
  toolbarLeft?: ReactNode;
}

export default function ReceivingHistoryTable({ data, isLoading, toolbarLeft }: ReceivingHistoryTableProps) {
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
    { id: 'matUid', header: t('material.col.matUid'), size: 150, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.lot?.matUid || '-' },
    { id: 'poNo', header: t('material.arrival.col.poNo'), size: 120, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.lot?.poNo || '-' },
    { id: 'partCode', header: t('common.partCode'), size: 100, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part?.itemCode },
    { id: 'partName', header: t('common.partName'), size: 130, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part?.itemName },
    {
      id: 'materialClass',
      header: t('material.receiveHistory.materialClass', '구분'),
      size: 80,
      meta: { filterType: "multi" as const, align: "center" as const },
      accessorFn: (row) => (row.materialClass === 'MRO' ? 'MRO' : 'PROD'),
      cell: ({ row }) => {
        const isMro = row.original.materialClass === 'MRO';
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
            isMro ? 'text-amber-600 border-amber-500' : 'text-primary border-primary'
          }`}>
            {isMro ? t('material.receiveHistory.mro', 'MRO') : t('material.receiveHistory.prod', '양산')}
          </span>
        );
      },
    },
    {
      id: 'isConcession',
      header: t('material.receiveHistory.concessionYn', '특채여부'),
      size: 90,
      meta: { filterType: "multi" as const, align: "center" as const },
      accessorFn: (row) => (row.isConcession ? 'Y' : 'N'),
      cell: ({ row }) => {
        const isConcession = row.original.isConcession === true;
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
            isConcession ? 'text-amber-600 border-amber-500' : 'text-text-muted border-border'
          }`}>
            {isConcession ? t('material.receiveHistory.concession', '특채') : t('material.receiveHistory.normal', '일반')}
          </span>
        );
      },
    },
    { id: 'vendor', header: t('material.col.supplier', '공급처'), size: 130, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.vendorName || row.original.vendor || '-' },
    { id: 'manufacturer', header: t('common.manufacturer', '제조사'), size: 110, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.manufacturer || '-' },
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

  return <DataGrid data={data} columns={columns} pageSize={10} enableColumnFilter isLoading={isLoading} toolbarLeft={toolbarLeft}
  sqlQuery={`SELECT *\nFROM MAT_RECEIVE_HISTORIES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>;
}
