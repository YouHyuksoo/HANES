"use client";

/**
 * @file src/pages/consumables/receiving/components/ReceivingTable.tsx
 * @description 입고 이력 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { ReceivingLog } from '@/hooks/consumables/useReceivingData';

const logTypeColors: Record<string, string> = {
  IN: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  IN_RETURN: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

const logTypeLabels: Record<string, string> = {
  IN: '입고',
  IN_RETURN: '입고반품',
};

const incomingTypeLabels: Record<string, string> = {
  NEW: '신규',
  REPLACEMENT: '교체',
};

interface ReceivingTableProps {
  data: ReceivingLog[];
}

function ReceivingTable({ data }: ReceivingTableProps) {
  const columns = useMemo<ColumnDef<ReceivingLog>[]>(
    () => [
      { accessorKey: 'createdAt', header: '일시', size: 140 },
      { accessorKey: 'consumableCode', header: '소모품코드', size: 110 },
      { accessorKey: 'consumableName', header: '소모품명', size: 140 },
      {
        accessorKey: 'logType',
        header: '유형',
        size: 90,
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${logTypeColors[type] ?? ''}`}>
              {logTypeLabels[type] ?? type}
            </span>
          );
        },
      },
      {
        accessorKey: 'qty',
        header: '수량',
        size: 70,
        cell: ({ row }) => {
          const isReturn = row.original.logType === 'IN_RETURN';
          return (
            <span className={isReturn ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
              {isReturn ? '-' : '+'}{row.original.qty}
            </span>
          );
        },
      },
      { accessorKey: 'vendorCode', header: '공급업체코드', size: 110 },
      { accessorKey: 'vendorName', header: '공급업체명', size: 110 },
      {
        accessorKey: 'unitPrice',
        header: '단가',
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return val != null ? val.toLocaleString() + '원' : '-';
        },
      },
      {
        accessorKey: 'incomingType',
        header: '입고구분',
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? incomingTypeLabels[val] ?? val : '-';
        },
      },
      {
        accessorKey: 'remark',
        header: '비고',
        size: 180,
        cell: ({ getValue }) => getValue() as string ?? '-',
      },
    ],
    []
  );

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}

export default ReceivingTable;
