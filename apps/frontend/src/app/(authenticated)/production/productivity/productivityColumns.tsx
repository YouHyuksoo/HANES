/**
 * @file src/app/(authenticated)/production/productivity/productivityColumns.tsx
 * @description 생산성분석 그리드 컬럼 정의
 */
import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { ProductivityRow } from './types';

/** 높을수록 좋은 지표 색상 (100% 기준) */
function goodRateCell(value: number) {
  if (!value) return <span className="text-text-muted">-</span>;
  const cls =
    value >= 100
      ? 'text-green-600 dark:text-green-400'
      : value >= 85
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';
  return <span className={`font-medium ${cls}`}>{value}%</span>;
}

/** 낮을수록 좋은 지표 색상 */
function badRateCell(value: number) {
  const cls =
    value <= 2
      ? 'text-green-600 dark:text-green-400'
      : value <= 5
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';
  return <span className={`font-medium ${cls}`}>{value}%</span>;
}

function num(value: number | null | undefined, digits = 0) {
  const v = value ?? 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function createProductivityGridColumns(t: TFunction): ColumnDef<ProductivityRow>[] {
  return [
    {
      accessorKey: 'itemCode',
      header: t('common.partCode'),
      size: 150,
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
      accessorKey: 'processName',
      header: t('production.productivity.process'),
      size: 110,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => getValue<string>() || '-',
    },
    {
      accessorKey: 'lineCode',
      header: t('production.progress.line'),
      size: 90,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string>() || '-',
    },
    {
      accessorKey: 'totalQty',
      header: t('production.productivity.totalQty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span className="font-medium">{num(getValue<number>())}</span>,
    },
    {
      accessorKey: 'goodQty',
      header: t('production.resultSummary.goodQty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">{num(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: 'defectQty',
      header: t('production.resultSummary.defectQty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => {
        const v = getValue<number>() ?? 0;
        return <span className={v > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-text-muted'}>{num(v)}</span>;
      },
    },
    {
      accessorKey: 'yieldRate',
      header: t('production.resultSummary.yieldRate'),
      size: 85,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => goodRateCell(getValue<number>()),
    },
    {
      accessorKey: 'defectRate',
      header: t('production.resultSummary.defectRate'),
      size: 85,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => badRateCell(getValue<number>() ?? 0),
    },
    {
      accessorKey: 'workHours',
      header: t('production.productivity.workHours'),
      size: 110,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ row, getValue }) => {
        const v = getValue<number>() ?? 0;
        if (v <= 0) return <span className="text-text-muted">-</span>;
        const src = row.original.workTimeSource;
        return (
          <span className="inline-flex items-center gap-1">
            {num(v, 2)}
            {src === 'JOB_ORDER' && (
              <span
                className="px-1 text-[10px] rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                title={t('production.productivity.srcJobOrderHint')}
              >
                {t('production.productivity.srcJobOrder')}
              </span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: 'manHours',
      header: t('production.productivity.manHours'),
      size: 100,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span>{num(getValue<number>(), 2)}</span>,
    },
    {
      accessorKey: 'workerCnt',
      header: t('production.productivity.workerCnt'),
      size: 80,
      meta: { filterType: 'number' as const, align: 'center' as const },
    },
    {
      accessorKey: 'equipCnt',
      header: t('production.productivity.equipCnt'),
      size: 80,
      meta: { filterType: 'number' as const, align: 'center' as const },
    },
    {
      accessorKey: 'actualUph',
      header: t('production.productivity.actualUph'),
      size: 95,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span className="font-medium">{num(getValue<number>(), 1)}</span>,
    },
    {
      accessorKey: 'stdUph',
      header: t('production.productivity.stdUph'),
      size: 95,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => {
        const v = getValue<number>() ?? 0;
        return v > 0 ? <span>{num(v, 1)}</span> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: 'uphAchieveRate',
      header: t('production.productivity.uphAchieveRate'),
      size: 105,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => goodRateCell(getValue<number>()),
    },
    {
      accessorKey: 'actualTactTime',
      header: t('production.productivity.actualTactTime'),
      size: 105,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span>{num(getValue<number>(), 1)}</span>,
    },
    {
      accessorKey: 'stdTactTime',
      header: t('production.productivity.stdTactTime'),
      size: 105,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => {
        const v = getValue<number>() ?? 0;
        return v > 0 ? <span>{num(v, 1)}</span> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: 'perManUph',
      header: t('production.productivity.perManUph'),
      size: 110,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-semibold">{num(getValue<number>(), 1)}</span>
      ),
    },
    {
      accessorKey: 'efficiencyRate',
      header: t('production.productivity.efficiencyRate'),
      size: 95,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => goodRateCell(getValue<number>()),
    },
    {
      accessorKey: 'operationRate',
      header: t('production.productivity.operationRate'),
      size: 95,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => goodRateCell(getValue<number>()),
    },
    {
      accessorKey: 'oee',
      header: t('production.productivity.oee'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => goodRateCell(getValue<number>()),
    },
    {
      accessorKey: 'planQty',
      header: t('production.resultSummary.planQty'),
      size: 95,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span className="text-text-muted">{num(getValue<number>())}</span>,
    },
    {
      accessorKey: 'orderCount',
      header: t('production.resultSummary.orderCount'),
      size: 80,
      meta: { filterType: 'number' as const, align: 'center' as const },
      cell: ({ getValue }) => <span className="text-text-muted">{num(getValue<number>())}</span>,
    },
    {
      accessorKey: 'hasStandard',
      header: t('production.productivity.hasStandard'),
      size: 90,
      meta: { filterType: 'multi' as const, align: 'center' as const },
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {t('production.productivity.standardRegistered')}
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {t('production.productivity.standardMissing')}
          </span>
        ),
    },
  ];
}
