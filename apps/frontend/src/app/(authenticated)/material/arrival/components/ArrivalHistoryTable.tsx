"use client";

/**
 * @file src/app/(authenticated)/material/arrival/components/ArrivalHistoryTable.tsx
 * @description 입하 이력 테이블 - MAT_IN / MAT_IN_CANCEL 트랜잭션 표시
 *
 * 초보자 가이드:
 * 1. **컬럼**: 트랜잭션번호, 날짜, PO번호, 품목, 수량(+/-), 창고, 상태, 액션
 * 2. **수량 표시**: 입하는 녹색(+), 취소는 빨간색(-)
 * 3. **취소 버튼**: DONE 상태의 MAT_IN만 취소 가능
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { XCircle } from 'lucide-react';
import DataGrid from '@/components/data-grid/DataGrid';
import { Button } from '@/components/ui';
import type { ArrivalRecord } from './types';

interface ArrivalHistoryTableProps {
  data: ArrivalRecord[];
  isLoading?: boolean;
  toolbarLeft?: ReactNode;
  onCancel: (record: ArrivalRecord) => void;
}

export default function ArrivalHistoryTable({ data, isLoading, toolbarLeft, onCancel }: ArrivalHistoryTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ArrivalRecord>[]>(() => [
    { accessorKey: 'transNo', header: t('material.arrival.col.transNo'), size: 180 },
    {
      accessorKey: 'transDate',
      header: t('material.arrival.col.transDate'),
      size: 100,
      cell: ({ getValue }) => (getValue() as string).slice(0, 10),
    },
    {
      id: 'poNo',
      header: t('material.arrival.col.poNo'),
      size: 130,
      cell: ({ row }) => row.original.lot?.poNo || '-',
    },
    {
      accessorKey: 'part.partCode',
      header: t('common.partCode'),
      size: 110,
      cell: ({ row }) => row.original.part?.partCode,
    },
    {
      accessorKey: 'part.partName',
      header: t('common.partName'),
      size: 130,
      cell: ({ row }) => row.original.part?.partName,
    },
    {
      id: 'lotNo',
      header: t('material.col.lotNo'),
      size: 150,
      cell: ({ row }) => row.original.lot?.lotNo || '-',
    },
    {
      accessorKey: 'qty',
      header: t('common.quantity'),
      size: 100,
      cell: ({ row }) => {
        const { qty } = row.original;
        const unit = row.original.part?.unit || '';
        const isPositive = qty > 0;
        return (
          <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{qty.toLocaleString()} {unit}
          </span>
        );
      },
    },
    {
      id: 'warehouse',
      header: t('material.arrival.col.warehouse'),
      size: 100,
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || '-',
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 90,
      cell: ({ row }) => {
        const { status } = row.original;
        const isCancel = status === 'CANCELED';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isCancel
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {isCancel ? t('material.arrival.status.canceled') : t('material.arrival.status.done')}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 70,
      cell: ({ row }) => {
        const record = row.original;
        if (record.transType !== 'MAT_IN' || record.status !== 'DONE') return null;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(record)}
            className="text-red-500 hover:text-red-700"
          >
            <XCircle className="w-4 h-4" />
          </Button>
        );
      },
    },
  ], [t, onCancel]);

  return <DataGrid data={data} columns={columns} isLoading={isLoading} enableExport exportFileName="arrival_history" toolbarLeft={toolbarLeft} />;
}
