import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { ProductSummary } from './types';

function rateCell(value: number, good: boolean) {
  const cls = good
    ? value >= 95 ? 'text-green-600 dark:text-green-400' : value >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
    : value <= 2 ? 'text-green-600 dark:text-green-400' : value <= 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  return <span className={`font-medium ${cls}`}>{value}%</span>;
}

export function createResultSummaryGridColumns(t: TFunction): ColumnDef<ProductSummary>[] {
  return [
    {
      accessorKey: 'itemCode',
      header: t('common.partCode'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'itemName',
      header: t('common.partName'),
      size: 160,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'itemType',
      header: t('production.resultSummary.partType'),
      size: 70,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const v = getValue<string>();
        const cls = v === 'FINISHED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          : v === 'SEMI_PRODUCT' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        const label = v === 'FINISHED' ? t('production.order.itemTypeFG', '완제품')
          : v === 'SEMI_PRODUCT' ? t('production.order.itemTypeWIP', '반제품')
            : v || '-';
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{label}</span>;
      },
    },
    {
      accessorKey: 'lineCode',
      header: t('production.progress.line'),
      size: 90,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'totalPlanQty',
      header: t('production.resultSummary.planQty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span>{(getValue<number | null>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'totalGoodQty',
      header: t('production.resultSummary.goodQty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue<number | null>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'totalDefectQty',
      header: t('production.resultSummary.defectQty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => {
        const v = getValue<number>() ?? 0;
        return <span className={v > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-text-muted'}>{v.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'achieveRate',
      header: t('production.resultSummary.achieveRate'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => rateCell(getValue<number>(), true),
    },
    {
      accessorKey: 'yieldRate',
      header: t('production.resultSummary.yieldRate'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => rateCell(getValue<number>(), true),
    },
    {
      accessorKey: 'defectRate',
      header: t('production.resultSummary.defectRate'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => rateCell(getValue<number>(), false),
    },
    {
      accessorKey: 'orderCount',
      header: t('production.resultSummary.orderCount'),
      size: 70,
      meta: { filterType: 'number' as const, align: 'center' as const },
      cell: ({ getValue }) => <span className="text-text-muted">{(getValue<number | null>() ?? 0).toLocaleString()}</span>,
    },
  ];
}
