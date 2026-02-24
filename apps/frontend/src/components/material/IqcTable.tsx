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

interface IqcTableProps {
  data: IqcItem[];
  onInspect: (item: IqcItem) => void;
  toolbarLeft?: ReactNode;
  isLoading?: boolean;
}

export default function IqcTable({ data, onInspect, toolbarLeft, isLoading }: IqcTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnDef<IqcItem>[]>(
    () => [
      { accessorKey: 'receiveNo', header: t('material.col.arrivalNo'), size: 160, meta: { filterType: 'text' as const } },
      { accessorKey: 'arrivalDate', header: t('material.col.arrivalDate'), size: 100, meta: { filterType: 'date' as const } },
      { accessorKey: 'supplierName', header: t('material.col.supplier'), size: 100, meta: { filterType: 'text' as const } },
      { accessorKey: 'partCode', header: t('common.partCode'), size: 110, meta: { filterType: 'text' as const } },
      { accessorKey: 'partName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
      { accessorKey: 'lotNo', header: t('material.col.lotNo'), size: 150, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'quantity',
        header: t('common.quantity'),
        size: 100,
        meta: { filterType: 'number' as const },
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.quantity.toLocaleString()} {row.original.unit}
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
      {
        id: 'actions',
        header: t('material.col.inspect'),
        size: 70,
        meta: { filterType: 'none' as const },
        cell: ({ row }) => {
          const item = row.original;
          const canInspect = item.status === 'PENDING' || item.status === 'IQC_IN_PROGRESS';
          return (
            <button
              className="p-1 hover:bg-surface rounded"
              title={t('material.iqc.iqcInspect')}
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
    [onInspect, t]
  );

  return <DataGrid data={data} columns={columns} isLoading={isLoading} enableColumnFilter enableExport exportFileName="iqc_inspection" toolbarLeft={toolbarLeft} />;
}
