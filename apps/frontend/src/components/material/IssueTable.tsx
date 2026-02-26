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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<IssueRecord>[]>(() => [
    { accessorKey: 'requestNo', header: t('material.col.requestNo'), size: 150, meta: { filterType: 'text' as const } },
    { accessorKey: 'requestDate', header: t('material.col.requestDate'), size: 100, meta: { filterType: 'date' as const } },
    {
      accessorKey: 'workOrderNo', header: t('material.col.workOrder'), size: 150, meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('common.partName'), size: 120, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'requestQty', header: t('material.col.requestQty'), size: 90, meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'issuedQty', header: t('material.col.issuedQty'), size: 90, meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: 'status', header: t('common.status'), size: 90, meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <IssueStatusBadge status={getValue() as IssueStatus} />,
    },
    { accessorKey: 'requester', header: t('material.col.requester'), size: 80, meta: { filterType: 'text' as const } },
    {
      id: 'actions', header: t('material.col.actions'), size: 110, meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex gap-1">
            {record.status === 'REQUESTED' && (
              <>
                <button
                  className="p-1 hover:bg-surface rounded"
                  title={t('material.issue.approveAction')}
                  onClick={() => onApprove(record)}
                >
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                </button>
                <button
                  className="p-1 hover:bg-surface rounded"
                  title={t('material.issue.rejectAction')}
                  onClick={() => onReject(record)}
                >
                  <XCircle className="w-4 h-4 text-red-400" />
                </button>
              </>
            )}
            {(record.status === 'APPROVED' || record.status === 'IN_PROGRESS') && (
              <button
                className="p-1 hover:bg-surface rounded"
                title={t('material.issue.processAction')}
                onClick={() => onProcess(record)}
              >
                <Play className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
        );
      },
    },
  ], [onApprove, onReject, onProcess, t]);

  return <DataGrid data={data} columns={columns} pageSize={10} enableColumnFilter />;
}
