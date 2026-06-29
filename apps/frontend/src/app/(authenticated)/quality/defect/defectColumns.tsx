import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, ComCodeBadge } from '@/components/ui';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import type { Defect } from './types';

interface CreateDefectGridColumnsOptions {
  t: TFunction;
  onOpenStatusModal: (defect: Defect) => void;
  onOpenDeleteModal: (defect: Defect) => void;
}

export function createDefectGridColumns({
  t,
  onOpenStatusModal,
  onOpenDeleteModal,
}: CreateDefectGridColumnsOptions): ColumnDef<Defect>[] {
  return [
    {
      id: 'actions',
      header: t('common.manage'),
      size: 150,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => onOpenStatusModal(row.original)}>
            {t('quality.defect.changeStatus')}
          </Button>
          <Button size="sm" variant="danger" onClick={() => onOpenDeleteModal(row.original)}>
            {t('quality.defect.cancelRegistration', '등록취소')}
          </Button>
        </div>
      ),
    },
    {
      accessorKey: 'occurAt',
      header: t('quality.defect.occurredAt'),
      size: 150,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return value ? new Date(value).toLocaleString() : '-';
      },
    },
    {
      accessorKey: 'workOrderNo',
      header: t('quality.defect.workOrder'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue<string | null>() || '-'}</span>,
    },
    {
      accessorKey: 'defectCode',
      header: t('quality.defect.defectCode'),
      size: 90,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>() || '-'}</span>,
    },
    {
      accessorKey: 'defectName',
      header: t('quality.defect.defectName'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'qty',
      header: t('quality.defect.quantity'),
      size: 70,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span className="font-mono">{getValue<number>()?.toLocaleString() ?? 0}</span>,
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="DEFECT_LOG_STATUS" align="center" />,
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_LOG_STATUS" code={getValue<string>()} />,
    },
    {
      accessorKey: 'operator',
      header: t('quality.defect.operator'),
      size: 90,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'cause',
      header: t('quality.defect.cause'),
      size: 140,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];
}
