"use client";

/**
 * @file src/pages/consumables/issuing/components/IssuingTable.tsx
 * @description 출고 이력 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { IssuingLog } from '@/hooks/consumables/useIssuingData';

const logTypeColors: Record<string, string> = {
  OUT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  OUT_RETURN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

const logTypeLabels: Record<string, string> = {
  OUT: '출고',
  OUT_RETURN: '출고반품',
};

const issueReasonLabels: Record<string, string> = {
  PRODUCTION: '생산투입',
  REPAIR: '수리',
  OTHER: '기타',
};

interface IssuingTableProps {
  data: IssuingLog[];
}

function IssuingTable({ data }: IssuingTableProps) {
  const columns = useMemo<ColumnDef<IssuingLog>[]>(
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
          const isReturn = row.original.logType === 'OUT_RETURN';
          return (
            <span className={isReturn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {isReturn ? '+' : '-'}{row.original.qty}
            </span>
          );
        },
      },
      {
        accessorKey: 'department',
        header: '출고부서',
        size: 100,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'lineId',
        header: '라인',
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'equipmentId',
        header: '설비',
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'issueReason',
        header: '출고사유',
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? issueReasonLabels[val] ?? val : '-';
        },
      },
      {
        accessorKey: 'remark',
        header: '비고',
        size: 160,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
    ],
    []
  );

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}

export default IssuingTable;
