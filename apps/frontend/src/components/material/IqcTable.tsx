"use client";

/**
 * @file src/pages/material/iqc/components/IqcTable.tsx
 * @description IQC 검사 대상 목록 테이블 컴포넌트
 */
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import { IqcStatusBadge } from '@/components/material';
import type { IqcItem } from '@/hooks/material/useIqcData';
import type { IqcStatus } from '@/components/material';
import { useComCodeMap } from '@/hooks/useComCode';

interface IqcTableProps {
  data: IqcItem[];
  onInspect: (item: IqcItem) => void;
  toolbarLeft?: ReactNode;
  isLoading?: boolean;
  sqlQuery?: string;
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('sv-SE').format(date);
};

/** 검사구분(FULL/SKIP) 배지 색상 */
const METHOD_COLORS: Record<string, string> = {
  FULL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  SKIP: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function IqcTable({ data, onInspect, toolbarLeft, isLoading, sqlQuery }: IqcTableProps) {
  const { t } = useTranslation();
  const iqcInspectMethodMap = useComCodeMap('IQC_INSPECT_METHOD');
  const columns = useMemo<ColumnDef<IqcItem>[]>(
    () => [
      {
        id: 'actions',
        header: t('material.col.inspect'),
        size: 100,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => {
          const item = row.original;
          const canInspect = item.status === 'PENDING' || item.status === 'IQC_IN_PROGRESS';
          return (
            <button
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                canInspect
                  ? 'text-primary border-primary hover:bg-primary hover:text-white'
                  : 'text-text-muted border-border opacity-50 cursor-not-allowed'
              }`}
              title={t('material.iqc.iqcInspect')}
              disabled={!canInspect}
              onClick={() => onInspect(item)}
            >
              <ClipboardCheck className="w-4 h-4" />
              {t('material.iqc.iqcInspect')}
            </button>
          );
        },
      },
      { accessorKey: 'arrivalNo', header: t('material.col.arrivalNo'), size: 160, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'poNo',
        header: t('material.col.poNo'),
        size: 140,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => <span>{(getValue() as string | null) || '-'}</span>,
      },
      {
        accessorKey: 'arrivalDate',
        header: t('material.col.arrivalDate'),
        size: 100,
        meta: { filterType: 'date' as const },
        cell: ({ getValue }) => formatDateOnly(getValue() as string | null),
      },
      { accessorKey: 'supplierName', header: t('material.col.supplier'), size: 100, meta: { filterType: 'text' as const } },
      { accessorKey: 'itemCode', header: t('common.partCode'), size: 110, meta: { filterType: 'text' as const } },
      { accessorKey: 'itemName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'inspectMethod',
        header: t('material.iqc.method', '검사구분'),
        size: 90,
        meta: { filterType: 'multi' as const },
        cell: ({ getValue }) => {
          const m = getValue() as string | null;
          if (!m) return <span className="text-text-muted">-</span>;
          const label = ({
            FULL: iqcInspectMethodMap.FULL?.codeName ?? t('master.iqcGroup.methodFull', '검사'),
            SKIP: iqcInspectMethodMap.SKIP?.codeName ?? t('master.iqcGroup.methodSkip', '무검사'),
          } as Record<string, string>)[m] ?? m;
          return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_COLORS[m] ?? ''}`}>{label}</span>;
        },
      },
      {
        accessorKey: 'serialCount',
        header: t('material.iqc.serialCount', '시리얼수'),
        size: 90,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.serialCount.toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'totalQty',
        header: t('material.iqc.totalQty', '총수량'),
        size: 100,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.totalQty.toLocaleString()} {row.original.unit}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 110,
        meta: { filterType: 'multi' as const },
        cell: ({ getValue }) => <IqcStatusBadge status={getValue() as IqcStatus} />,
      },
      {
        accessorKey: 'inspector',
        header: t('material.col.inspector'),
        size: 80,
        meta: { filterType: 'text' as const },
        cell: ({ getValue }) => <span>{(getValue() as string) || '-'}</span>,
      },
    ],
    [onInspect, t, iqcInspectMethodMap]
  );

  return <DataGrid
      sqlQuery={sqlQuery} data={data} columns={columns} isLoading={isLoading} enableColumnFilter enableExport exportFileName="iqc_inspection" toolbarLeft={toolbarLeft} />;
}
