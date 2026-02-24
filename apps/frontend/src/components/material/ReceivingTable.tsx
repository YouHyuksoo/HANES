"use client";

/**
 * @file src/pages/material/receiving/components/ReceivingTable.tsx
 * @description 입고 대상/이력 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PackagePlus } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { ReceivingStatusBadge } from '@/components/material';
import type { ReceivingItem } from '@/hooks/material/useReceivingData';
import type { ReceivingStatus } from '@/components/material';

interface ReceivingTableProps {
  data: ReceivingItem[];
  onConfirm: (item: ReceivingItem) => void;
}

export default function ReceivingTable({ data, onConfirm }: ReceivingTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<ReceivingItem>[]>(
    () => [
      { accessorKey: 'receiveNo', header: t('material.col.arrivalNo'), size: 160, meta: { filterType: 'text' as const } },
      { accessorKey: 'arrivalDate', header: t('material.col.arrivalDate'), size: 100, meta: { filterType: 'date' as const } },
      { accessorKey: 'supplierName', header: t('material.col.supplier'), size: 100, meta: { filterType: 'text' as const } },
      { accessorKey: 'partCode', header: t('common.partCode'), size: 110, meta: { filterType: 'text' as const } },
      { accessorKey: 'partName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
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
        accessorKey: 'iqcPassedAt',
        header: t('material.col.iqcPassedAt'),
        size: 130,
        meta: { filterType: 'date' as const },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 100,
        meta: { filterType: 'multi' as const },
        cell: ({ getValue }) => <ReceivingStatusBadge status={getValue() as ReceivingStatus} />,
      },
      {
        accessorKey: 'warehouse',
        header: t('material.col.warehouse'),
        size: 100,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => <span>{(getValue() as string) || '-'}</span>,
      },
      {
        id: 'actions',
        header: t('material.col.receiving'),
        size: 70,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => {
          const item = row.original;
          const canConfirm = item.status === 'PASSED';
          return (
            <button
              className="p-1 hover:bg-surface rounded"
              title={t('material.receive.confirmTitle')}
              disabled={!canConfirm}
              onClick={() => onConfirm(item)}
            >
              <PackagePlus
                className={`w-4 h-4 ${canConfirm ? 'text-primary' : 'text-text-muted opacity-50'}`}
              />
            </button>
          );
        },
      },
    ],
    [onConfirm, t]
  );

  return <DataGrid data={data} columns={columns} pageSize={10} enableColumnFilter />;
}
