import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { FileSearch } from 'lucide-react';
import { ComCodeBadge } from '@/components/ui';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import type { ReworkOrder } from './types';

interface CreateReworkInspectGridColumnsOptions {
  t: TFunction;
  onOpenInspectPanel: (row: ReworkOrder) => void;
}

export function createReworkInspectGridColumns({
  t,
  onOpenInspectPanel,
}: CreateReworkInspectGridColumnsOptions): ColumnDef<ReworkOrder>[] {
  return [
    {
      id: 'actions',
      header: '',
      size: 60,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInspectPanel(row.original);
          }}
          className="p-1 hover:bg-surface rounded transition-colors"
          title={t('common.detail', '상세')}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: 'reworkNo',
      header: t('quality.rework.reworkNo'),
      size: 170,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue<string>()}</span>,
    },
    { accessorKey: 'itemCode', header: t('quality.rework.itemCode'), size: 120, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('quality.rework.itemName'), size: 160, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'reworkQty',
      header: t('quality.rework.reworkQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue<number | null>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'resultQty',
      header: t('quality.rework.resultQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue<number | null>() ?? 0).toLocaleString()}</span>,
    },
    { accessorKey: 'workerId', header: t('quality.rework.worker'), size: 100, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'endAt',
      header: t('quality.rework.complete'),
      size: 140,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const v = getValue<string | null>();
        return v ? new Date(v).toLocaleString() : '-';
      },
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="REWORK_STATUS" align="center" />,
      size: 110,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="REWORK_STATUS" code={getValue<string>()} />,
    },
  ];
}
