import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Trash2 } from 'lucide-react';
import { ComCodeBadge } from '@/components/ui';
import type { PmPlanRow } from './types';

interface CreatePmPlanGridColumnsOptions {
  t: TFunction;
  isPanelOpen: boolean;
  onEditPlan: (plan: PmPlanRow, shouldAnimate: boolean) => void;
  onDeletePlan: (plan: PmPlanRow) => void;
}

export function createPmPlanGridColumns({
  t,
  isPanelOpen,
  onEditPlan,
  onDeletePlan,
}: CreatePmPlanGridColumnsOptions): ColumnDef<PmPlanRow>[] {
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
              onEditPlan(row.original, !isPanelOpen);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDeletePlan(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'planCode',
      header: t('equipment.pmPlan.planCode'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-medium">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'equip',
      header: t('equipment.pmPlan.equipCode'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const equip = getValue<PmPlanRow['equip']>();
        return equip ? (
          <span className="font-mono text-xs">{equip.equipCode}</span>
        ) : '-';
      },
    },
    {
      id: 'equipName',
      header: t('equipment.pmPlan.equipName'),
      size: 140,
      meta: { filterType: 'text' as const },
      accessorFn: (row) => row.equip?.equipName ?? '-',
    },
    {
      accessorKey: 'planName',
      header: t('equipment.pmPlan.planName'),
      size: 180,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'pmType',
      header: t('equipment.pmPlan.pmType'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PM_TYPE" code={getValue<string>()} />
      ),
    },
    {
      accessorKey: 'cycleType',
      header: t('equipment.pmPlan.cycleType'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PM_CYCLE_TYPE" code={getValue<string>()} />
      ),
    },
    {
      accessorKey: 'itemCount',
      header: t('equipment.pmPlan.itemsTitle'),
      size: 80,
      meta: { align: 'center' as const, filterType: 'number' as const },
      cell: ({ getValue }) => {
        const count = getValue<number>();
        return (
          <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-xs font-medium ${
            count > 0
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
          }`}
          >
            {count}
          </span>
        );
      },
    },
    {
      accessorKey: 'nextDueAt',
      header: t('equipment.pmPlan.nextDueAt'),
      size: 120,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const nextDueAt = getValue<string | null>();
        if (!nextDueAt) return '-';
        return new Date(nextDueAt).toLocaleDateString();
      },
    },
    {
      accessorKey: 'useYn',
      header: t('common.status'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const useYn = getValue<string>();
        return (
          <span className={`w-2 h-2 rounded-full inline-block ${useYn === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
        );
      },
    },
  ];
}
