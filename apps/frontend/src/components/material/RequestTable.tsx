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
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { ComCodeBadge } from '@/components/ui';
import { IssueRequestStatusBadge } from '@/components/material';
import type { IssueRequest } from '@/hooks/material/useIssueRequestData';
import type { IssueRequestStatus } from '@/components/material';

interface RequestTableProps {
  data: IssueRequest[];
  toolbarLeft?: ReactNode;
  isLoading?: boolean;
  onViewDetail?: (request: IssueRequest) => void;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function totalRequestQty(row: IssueRequest): number {
  return toNumber(row.totalQty ?? row.totalRequestQty) || (row.items ?? []).reduce((sum, item) => sum + toNumber(item.requestQty), 0);
}

function itemSummary(row: IssueRequest): string {
  const items = row.items ?? [];
  const first = items[0];
  if (!first) return '-';
  const label = first.itemName ? `${first.itemCode} ${first.itemName}` : first.itemCode;
  return items.length > 1 ? `${label} +${items.length - 1}` : label;
}

export default function RequestTable({ data, toolbarLeft, isLoading, onViewDetail }: RequestTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<IssueRequest>[]>(() => [
    { accessorKey: 'requestNo', header: t('material.col.requestNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'requestDate', header: t('material.col.requestDate'), size: 100, meta: { filterType: 'date' as const } },
    {
      accessorKey: 'issueType',
      header: t('material.issueAccount'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const value = getValue() as string | null | undefined;
        return value ? <ComCodeBadge groupCode="ISSUE_TYPE" code={value} /> : <span className="text-text-muted">-</span>;
      },
    },
    {
      id: 'workOrderNo', header: t('material.col.workOrder'), size: 160, meta: { filterType: 'text' as const },
      accessorFn: (row) => row.workOrderNo ?? row.orderNo ?? '',
      cell: ({ row }) => {
        const workOrderNo = row.original.workOrderNo ?? row.original.orderNo;
        const isManual = !workOrderNo && row.original.issueType === 'MANUAL';
        return (
          <span className={isManual ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-primary font-medium'}>
            {isManual ? t('material.request.manualRequest') : workOrderNo ?? '-'}
          </span>
        );
      },
    },
    {
      id: 'itemSummary',
      header: t('common.partName'),
      size: 220,
      meta: { filterType: 'text' as const },
      accessorFn: itemSummary,
      cell: ({ row }) => <span className="text-text">{itemSummary(row.original)}</span>,
    },
    {
      id: 'itemCount', header: t('material.col.itemCount'), size: 70, meta: { filterType: 'none' as const },
      cell: ({ row }) => <span>{row.original.items?.length ?? 0}{t('material.request.items')}</span>,
    },
    {
      accessorKey: 'totalQty', header: t('common.totalQty'), size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ row }) => (
        <span className="font-medium">{totalRequestQty(row.original).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'status', header: t('common.status'), size: 90, meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => (
        <IssueRequestStatusBadge status={getValue() as IssueRequestStatus} />
      ),
    },
    { accessorKey: 'requester', header: t('material.col.requester'), size: 80, meta: { filterType: 'text' as const } },
    {
      id: 'actions',
      header: t('material.col.actions'),
      size: 80,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-text-muted transition-colors hover:bg-card-hover hover:text-primary"
          title={t('common.viewDetail')}
          aria-label={t('common.viewDetail')}
          onClick={(event) => {
            event.stopPropagation();
            onViewDetail?.(row.original);
          }}
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ], [onViewDetail, t]);

  return (
    <DataGrid
      sqlQuery={`SELECT *\nFROM MAT_ISSUE_REQUESTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
      data={data}
      columns={columns}
      isLoading={isLoading}
      enableColumnFilter
      enableExport
      exportFileName="issue_request"
      toolbarLeft={toolbarLeft}
      onRowClick={onViewDetail}
    />
  );
}
