import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle } from 'lucide-react';
import type { InspectHistoryRow } from './types';

const inspectTypeClass: Record<string, string> = {
  VISUAL: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  TERMINAL: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  CONTINUITY: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
};

function getInspectTypeLabel(t: TFunction, inspectType: string) {
  const labels: Record<string, string> = {
    VISUAL: t('inspection.history.typeVisual', '외관검사'),
    TERMINAL: t('inspection.history.typeTerminal', '단자검사'),
    CONTINUITY: t('inspection.history.typeContinuity', '통전검사'),
  };

  return labels[inspectType] ?? inspectType;
}

export function createInspectionHistoryGridColumns(t: TFunction): ColumnDef<InspectHistoryRow>[] {
  return [
    {
      accessorKey: 'inspectAt',
      header: t('inspection.result.issuedAt', '검사시간'),
      size: 150,
      cell: ({ getValue }) => {
        const inspectAt = getValue<string>();
        return inspectAt
          ? new Date(inspectAt).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '-';
      },
    },
    {
      accessorKey: 'inspectType',
      header: t('inspection.history.inspectType', '검사유형'),
      size: 110,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const inspectType = String(getValue() ?? '').toUpperCase();
        if (!inspectType) return <span className="text-text-muted">-</span>;
        return (
          <span className={`inline-flex h-6 items-center rounded border px-2 text-xs font-medium ${inspectTypeClass[inspectType] ?? 'border-border bg-surface text-text'}`}>
            {getInspectTypeLabel(t, inspectType)}
          </span>
        );
      },
    },
    {
      accessorKey: 'fgBarcode',
      header: t('inspection.result.fgBarcode', 'FG 바코드'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const fgBarcode = getValue<string | null>();
        return fgBarcode
          ? <span className="font-mono text-xs text-primary">{fgBarcode}</span>
          : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: 'passYn',
      header: t('quality.inspect.judgement', '판정'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const passYn = getValue<string>();
        return passYn === 'Y'
          ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="w-4 h-4" />{t('quality.inspect.pass')}</span>
          : <span className="flex items-center gap-1 text-red-500 dark:text-red-400"><XCircle className="w-4 h-4" />{t('quality.inspect.fail')}</span>;
      },
    },
    {
      accessorKey: 'errorCode',
      header: t('quality.inspect.mainDefectCode', '불량코드'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const errorCode = getValue<string | null>();
        return errorCode ? <span className="text-red-500 font-mono text-xs">{errorCode}</span> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: 'errorDetail',
      header: t('quality.inspect.detailReason', '상세사유'),
      size: 200,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || <span className="text-text-muted">-</span>,
    },
    {
      accessorKey: 'inspectorId',
      header: t('quality.inspect.inspector', '검사원'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || <span className="text-text-muted">-</span>,
    },
    {
      accessorKey: 'inspectScope',
      header: t('master.part.inspectMethod', '검사구분'),
      size: 80,
      cell: ({ getValue }) => {
        const inspectScope = getValue<string | null>();
        return inspectScope === 'FULL'
          ? t('inspection.history.scopeFull', '전수')
          : inspectScope === 'SAMPLE'
            ? t('inspection.history.scopeSample', '샘플')
            : inspectScope || '-';
      },
    },
  ];
}
