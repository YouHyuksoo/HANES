"use client";

/**
 * @file src/pages/material/iqc/components/IqcTable.tsx
 * @description IQC 검사 대상 목록 테이블 컴포넌트
 */
import { useMemo } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { IqcStatusBadge } from '@/components/material';
import type { IqcItem } from '@/hooks/material/useIqcData';
import type { IqcStatus } from '@/components/material';

interface IqcTableProps {
  data: IqcItem[];
  onInspect: (item: IqcItem) => void;
}

export default function IqcTable({ data, onInspect }: IqcTableProps) {
  const columns = useMemo<ColumnDef<IqcItem>[]>(
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
        accessorKey: 'status',
        header: '상태',
        size: 110,
        cell: ({ getValue }) => <IqcStatusBadge status={getValue() as IqcStatus} />,
      },
      {
        accessorKey: 'inspector',
        header: '검사자',
        size: 80,
        cell: ({ getValue }) => <span>{(getValue() as string) || '-'}</span>,
      },
      {
        id: 'actions',
        header: '검사',
        size: 70,
        cell: ({ row }) => {
          const item = row.original;
          const canInspect = item.status === 'PENDING' || item.status === 'IQC_IN_PROGRESS';
          return (
            <button
              className="p-1 hover:bg-surface rounded"
              title="IQC 검사"
              disabled={!canInspect}
              onClick={() => onInspect(item)}
            >
              <ClipboardCheck
                className={`w-4 h-4 ${canInspect ? 'text-primary' : 'text-text-muted opacity-50'}`}
              />
            </button>
          );
        },
      },
    ],
    [onInspect]
  );

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}
