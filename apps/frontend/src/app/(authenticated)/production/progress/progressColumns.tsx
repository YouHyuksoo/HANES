import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { ComCodeBadge } from '@/components/ui';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import type { ProgressItem } from './types';

export function createProgressGridColumns(t: TFunction): ColumnDef<ProgressItem>[] {
  return [
    { accessorKey: 'orderNo', header: t('production.progress.orderNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorFn: (row) => row.part?.itemCode, id: 'partCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const } },
    { accessorFn: (row) => row.part?.itemName, id: 'partName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'lineCode', header: t('production.progress.line'), size: 90, meta: { filterType: 'text' as const }, cell: ({ getValue }) => getValue<string | null>() || '-' },
    { accessorKey: 'processCode', header: t('production.order.process'), size: 90, meta: { filterType: 'text' as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string | null>() || '-'}</span> },
    { accessorKey: 'equipCode', header: t('production.order.equip'), size: 100, meta: { filterType: 'text' as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string | null>() || '-'}</span> },
    { accessorKey: 'planQty', header: t('production.progress.planQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => (getValue<number | null>() ?? 0).toLocaleString() },
    { accessorKey: 'goodQty', header: t('production.progress.goodQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400">{(getValue<number | null>() ?? 0).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: t('production.progress.defectQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400">{(getValue<number | null>() ?? 0).toLocaleString()}</span> },
    {
      id: 'progress',
      header: t('production.progress.progressRate'),
      size: 140,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const { planQty, goodQty } = row.original;
        const p = planQty > 0 ? Math.min(Math.round((goodQty / planQty) * 100), 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${p >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${p}%` }} />
            </div>
            <span className="text-xs text-text-muted w-10">{p}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('production.progress.status')} codeType="JOB_ORDER_STATUS" align="center" />,
      size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue<string>()} />,
    },
    { accessorKey: 'planDate', header: t('production.progress.planDate'), size: 100, meta: { filterType: 'date' as const } },
  ];
}
