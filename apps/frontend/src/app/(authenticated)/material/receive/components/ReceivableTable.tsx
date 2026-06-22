"use client";

/**
 * @file src/app/(authenticated)/material/receive/components/ReceivableTable.tsx
 * @description 입고 가능 LOT 테이블 - 스캔 입고 대상 조회 전용
 *
 * 초보자 가이드:
 * 1. 입고 처리는 별도 스캔 모달에서만 수행한다.
 * 2. 이 테이블은 어떤 LOT이 입고 대상인지 확인하는 조회 화면이다.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { ReceivableLot } from './types';

interface ReceivableTableProps {
  data: ReceivableLot[];
  isLoading?: boolean;
  toolbarLeft?: React.ReactNode;
}

export default function ReceivableTable({ data, isLoading, toolbarLeft }: ReceivableTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ReceivableLot>[]>(() => [
    { id: 'matUid', header: t('material.col.matUid'), size: 150, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.matUid },
    { id: 'poNo', header: t('material.arrival.col.poNo'), size: 120, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.poNo || '-' },
    { id: 'partCode', header: t('common.partCode'), size: 100, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part?.itemCode || '-' },
    { id: 'partName', header: t('common.partName'), size: 130, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part?.itemName || '-' },
    { id: 'vendor', header: t('material.arrival.col.vendor'), size: 130, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.vendorName || row.original.vendor || '-' },
    {
      id: 'recvDate',
      header: t('material.receive.col.recvDate'),
      size: 110,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.recvDate ? String(row.original.recvDate).slice(0, 10) : '-',
    },
    {
      id: 'initQty',
      header: t('material.receive.col.initQty'),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => <span>{row.original.initQty.toLocaleString()}</span>,
    },
    {
      id: 'receivedQty',
      header: t('material.receive.col.receivedQty'),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => (
        <span className="text-blue-600">{row.original.receivedQty.toLocaleString()}</span>
      ),
    },
    {
      id: 'remainingQty',
      header: t('material.receive.col.remainingQty'),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => (
        <span className="text-orange-600 font-medium">{row.original.remainingQty.toLocaleString()}</span>
      ),
    },
    {
      id: 'certStatus',
      header: t('material.receive.certStatus', '성적서'),
      size: 95,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        if (!row.original.certRequired) {
          return <span className="text-xs text-text-muted">{t('material.receive.certNotRequired', '불필요')}</span>;
        }
        if (row.original.certUploaded) {
          return <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{t('material.receive.certAttached', '첨부')}</span>;
        }
        return (
          <span
            className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            title={row.original.receivingBlockedReason || undefined}
          >
            {t('material.receive.certNotAttached', '미첨부')}
          </span>
        );
      },
    },
    {
      id: 'arrivalWarehouse',
      header: t('material.arrival.col.warehouse'),
      size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.arrivalWarehouse?.warehouseName || row.original.arrivalWarehouseCode || '-',
    },
  ], [t]);

  return (
    <DataGrid
      data={data}
      columns={columns}
      pageSize={20}
      isLoading={isLoading}
      enableColumnFilter
      enableExport
      exportFileName={t('material.receive.title')}
      toolbarLeft={toolbarLeft}
    
    sqlQuery={`SELECT *\nFROM MAT_RECEIVES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
  );
}
