"use client";

/**
 * @file src/pages/material/arrival/components/ArrivalTable.tsx
 * @description 입하 목록 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { ArrivalStatusBadge } from '@/components/material';
import type { ArrivalItem } from '@/hooks/material/useArrivalData';
import type { ArrivalStatus } from '@/components/material';

interface ArrivalTableProps {
  data: ArrivalItem[];
}

export default function ArrivalTable({ data }: ArrivalTableProps) {
  const columns = useMemo<ColumnDef<ArrivalItem>[]>(
    () => [
      { accessorKey: 'arrivalNo', header: '입하번호', size: 160 },
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
        accessorKey: 'status',
        header: '상태',
        size: 100,
        cell: ({ getValue }) => (
          <ArrivalStatusBadge status={getValue() as ArrivalStatus} />
        ),
      },
      {
        accessorKey: 'remark',
        header: '비고',
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-text-muted">{(getValue() as string) || '-'}</span>
        ),
      },
    ],
    []
  );

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}
