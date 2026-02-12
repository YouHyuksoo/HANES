"use client";

/**
 * @file src/pages/material/issue-request/components/RequestTable.tsx
 * @description 내 출고요청 목록 테이블
 *
 * 초보자 가이드:
 * 1. **요청 목록**: 내가 등록한 출고요청 건들을 표시
 * 2. **상태 표시**: 대기/승인/출고완료/반려 상태 배지
 * 3. **품목수/총수량**: 요청에 포함된 품목 수와 전체 수량
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { IssueRequestStatusBadge } from '@/components/material';
import type { IssueRequest } from '@/hooks/material/useIssueRequestData';
import type { IssueRequestStatus } from '@/components/material';

interface RequestTableProps {
  data: IssueRequest[];
}

export default function RequestTable({ data }: RequestTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<IssueRequest>[]>(() => [
    { accessorKey: 'requestNo', header: t('material.col.requestNo'), size: 160 },
    { accessorKey: 'requestDate', header: t('material.col.requestDate'), size: 100 },
    {
      accessorKey: 'workOrderNo', header: t('material.col.workOrder'), size: 160,
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    {
      id: 'itemCount', header: t('material.col.itemCount'), size: 70,
      cell: ({ row }) => <span>{row.original.items.length}{t('material.request.items')}</span>,
    },
    {
      accessorKey: 'totalQty', header: t('common.totalQty'), size: 100,
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'status', header: t('common.status'), size: 90,
      cell: ({ getValue }) => (
        <IssueRequestStatusBadge status={getValue() as IssueRequestStatus} />
      ),
    },
    { accessorKey: 'requester', header: t('material.col.requester'), size: 80 },
  ], [t]);

  return <DataGrid data={data} columns={columns} pageSize={10} />;
}
