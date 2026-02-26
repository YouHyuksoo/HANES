"use client";

/**
 * @file src/pages/material/arrival/components/ArrivalTable.tsx
 * @description 입하 목록 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { ArrivalStatusBadge } from '@/components/material';
import type { ArrivalItem } from '@/hooks/material/useArrivalData';
import type { ArrivalStatus } from '@/components/material';

interface ArrivalTableProps {
  data: ArrivalItem[];
}

export default function ArrivalTable({ data }: ArrivalTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<ArrivalItem>[]>(
    () => [
      { accessorKey: 'arrivalNo', header: t('material.col.arrivalNo'), size: 160, meta: { filterType: 'text' as const } },
      { accessorKey: 'arrivalDate', header: t('material.col.arrivalDate'), size: 100, meta: { filterType: 'date' as const } },
      { accessorKey: 'supplierName', header: t('material.col.supplier'), size: 100, meta: { filterType: 'text' as const } },
      { accessorKey: 'itemCode', header: t('common.partCode'), size: 110, meta: { filterType: 'text' as const } },
      { accessorKey: 'itemName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
      { accessorKey: 'lotNo', header: t('material.col.lotNo'), size: 150, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'quantity',
        header: t('common.quantity'),
        size: 100,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.quantity.toLocaleString()} {row.original.unit}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 100,
        meta: { filterType: 'multi' as const },
        cell: ({ getValue }) => (
          <ArrivalStatusBadge status={getValue() as ArrivalStatus} />
        ),
      },
      {
        accessorKey: 'remark',
        header: t('common.remark'),
        size: 120,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => (
          <span className="text-text-muted">{(getValue() as string) || '-'}</span>
        ),
      },
    ],
    [t]
  );

  return <DataGrid data={data} columns={columns} pageSize={10} enableColumnFilter />;
}
