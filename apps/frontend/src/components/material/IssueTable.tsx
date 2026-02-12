"use client";

/**
 * @file src/pages/material/issue/components/IssueTable.tsx
 * @description 출고 처리 대상 테이블 - 자재창고 담당자 관점
 *
 * 초보자 가이드:
 * 1. **REQUESTED**: 승인 또는 반려 가능
 * 2. **APPROVED**: 출고처리(수량 입력) 가능
 * 3. **IN_PROGRESS**: 추가 출고 가능
 * 4. **COMPLETED/REJECTED**: 조회만 가능
 */
import { useMemo } from 'react';
import { CheckCircle, Play, XCircle } from 'lucide-react';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { IssueStatusBadge } from '@/components/material';
import type { IssueRecord } from '@/hooks/material/useIssueData';
import type { IssueStatus } from '@/components/material';

interface IssueTableProps {
  data: IssueRecord[];
  onApprove: (record: IssueRecord) => void;
  onReject: (record: IssueRecord) => void;
  onProcess: (record: IssueRecord) => void;
}

export default function IssueTable({ data, onApprove, onReject, onProcess }: IssueTableProps) {
  const columns = useMemo<ColumnDef<IssueRecord>[]>(() => [
    { accessorKey: 'requestNo', header: '요청번호', size: 150 },
    { accessorKey: 'requestDate', header: '요청일', size: 100 },
    {
      accessorKey: 'workOrderNo', header: '작업지시', size: 150,
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 120 },
    {
      accessorKey: 'requestQty', header: '요청수량', size: 90,
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'issuedQty', header: '출고수량', size: 90,
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'status', header: '상태', size: 90,
      cell: ({ getValue }) => <IssueStatusBadge status={getValue() as IssueStatus} />,
    },
    { accessorKey: 'requester', header: '요청자', size: 80 },
    {
      id: 'actions', header: '처리', size: 110,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex gap-1">
            {record.status === 'REQUESTED' && (
              <>
                <button
                  className="p-1 hover:bg-surface rounded"
                  title="승인"
                  onClick={() => onApprove(record)}
                >
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                </button>
                <button
                  className="p-1 hover:bg-surface rounded"
                  title="반려"
                  onClick={() => onReject(record)}
                >
                  <XCircle className="w-4 h-4 text-red-400" />
                </button>
              </>
            )}
            {(record.status === 'APPROVED' || record.status === 'IN_PROGRESS') && (
              <button
                className="p-1 hover:bg-surface rounded"
                title="출고처리"
                onClick={() => onProcess(record)}
              >
                <Play className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
        );
      },
    },
  ], [onApprove, onReject, onProcess]);

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}
