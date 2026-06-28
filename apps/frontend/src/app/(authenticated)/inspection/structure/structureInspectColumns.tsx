import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle } from 'lucide-react';
import type { StructureInspectRecord } from './types';

export function createStructureInspectGridColumns(t: TFunction): ColumnDef<StructureInspectRecord>[] {
  return [
    {
      accessorKey: 'inspectAt',
      header: t('inspection.result.issuedAt', '검사시간'),
      size: 150,
      cell: ({ getValue }) => {
        const inspectAt = getValue<string>();
        return inspectAt
          ? new Date(inspectAt).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '-';
      },
    },
    {
      accessorKey: 'fgBarcode',
      header: t('inspection.result.fgBarcode', 'FG 바코드'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const fgBarcode = getValue<string | null>();
        return fgBarcode ? <span className="font-mono text-xs text-primary">{fgBarcode}</span> : '-';
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
      header: t('inspection.structure.defectType', '불량유형'),
      size: 120,
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
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];
}
