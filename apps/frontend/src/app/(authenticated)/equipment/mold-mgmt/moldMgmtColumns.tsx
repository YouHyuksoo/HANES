import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Trash2 } from 'lucide-react';
import { ComCodeBadge } from '@/components/ui';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import type { MoldMaster } from './types';

interface CreateMoldMgmtGridColumnsOptions {
  t: TFunction;
  onEditMold: (mold: MoldMaster) => void;
  onDeleteMold: (mold: MoldMaster) => void;
}

export function createMoldMgmtGridColumns({
  t,
  onEditMold,
  onDeleteMold,
}: CreateMoldMgmtGridColumnsOptions): ColumnDef<MoldMaster>[] {
  return [
    {
      id: 'actions',
      header: t('common.actions'),
      size: 80,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onEditMold(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
            title={t('common.edit')}
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDeleteMold(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'moldCode',
      header: t('equipment.mold.moldCode'),
      size: 130,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'moldName',
      header: t('equipment.mold.moldName'),
      size: 160,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'moldType',
      header: t('equipment.mold.moldType'),
      size: 110,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="MOLD_TYPE" code={getValue<string>()} />,
    },
    {
      accessorKey: 'itemCode',
      header: t('equipment.mold.itemCode'),
      size: 130,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'cavity',
      header: t('equipment.mold.cavity'),
      size: 80,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{getValue<number>()}</span>,
    },
    {
      accessorKey: 'currentShots',
      header: t('equipment.mold.currentShots'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue<number>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'guaranteedShots',
      header: t('equipment.mold.guaranteedShots'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue<number>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'shotRate',
      header: t('equipment.mold.shotRate'),
      size: 90,
      accessorFn: (row) => row.guaranteedShots > 0
        ? Math.round((row.currentShots / row.guaranteedShots) * 100)
        : 0,
      cell: ({ getValue }) => {
        const rate = getValue<number>();
        const color = rate > 100
          ? 'text-red-600 dark:text-red-400'
          : rate > 90
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400';
        return <span className={`font-mono text-right block font-semibold ${color}`}>{rate}%</span>;
      },
    },
    {
      accessorKey: 'status',
      size: 100,
      header: () => <StatusHeaderHelp label={t('equipment.mold.status')} codeType="MOLD_STATUS" align="center" />,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="MOLD_STATUS" code={getValue<string>()} />,
    },
    {
      accessorKey: 'nextMaintenanceDate',
      header: t('equipment.mold.nextMaint'),
      size: 110,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => getValue<string | null>()?.slice(0, 10) ?? '-',
    },
  ];
}
