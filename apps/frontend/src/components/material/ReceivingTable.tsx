"use client";

/**
 * @file src/pages/material/receiving/components/ReceivingTable.tsx
 * @description 입고 대상/이력 테이블 컴포넌트
 */
import { useMemo } from 'react';
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
  const columns = useMemo<ColumnDef<ReceivingItem>[]>(
    () => [
      { accessorKey: 'receiveNo', header: '입하번호', size: 160 },
      { accessorKey: 'arrivalDate', header: '입하일', size: 100 },
      { accessorKey: 'supplierName', header: '공급업체', size: 100 },
      { accessorKey: 'partCode', header: '품목코드', size: 110 },
      { accessorKey: 'partName', header: '품목명', size: 130 },
      { accessorKey: 'lotNo', header: 'LOT번호', size: 150 },
      {
        accessorKey: 'quantity',
        header: '수량',
        size: 100,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.quantity.toLocaleString()} {row.original.unit}
          </span>
        ),
      },
      {
        accessorKey: 'iqcPassedAt',
        header: 'IQC합격일',
        size: 130,
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 100,
        cell: ({ getValue }) => <ReceivingStatusBadge status={getValue() as ReceivingStatus} />,
      },
      {
        accessorKey: 'warehouse',
        header: '창고',
        size: 100,
        cell: ({ getValue }) => <span>{(getValue() as string) || '-'}</span>,
      },
      {
        id: 'actions',
        header: '입고',
        size: 70,
        cell: ({ row }) => {
          const item = row.original;
          const canConfirm = item.status === 'PASSED';
          return (
            <button
              className="p-1 hover:bg-surface rounded"
              title="입고확정"
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
    [onConfirm]
  );

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}
