import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { CalibrationRow } from './types';

export function createCalibrationHistoryGridColumns(t: TFunction): ColumnDef<CalibrationRow>[] {
  return [
    {
      accessorKey: 'calibrationDate',
      header: t('equipment.calibrationHistory.date', '교정일'),
      size: 100,
      meta: { filterType: 'date' as const },
    },
    {
      accessorKey: 'calibrationNo',
      header: t('equipment.calibrationHistory.calNo', '교정번호'),
      size: 130,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'gaugeCode',
      header: t('equipment.calibrationHistory.gaugeCode', '계측기코드'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'gaugeName',
      header: t('equipment.calibrationHistory.gaugeName', '계측기명'),
      size: 150,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'result',
      size: 80,
      header: () => <StatusHeaderHelp label={t('equipment.calibrationHistory.result', '결과')} codeType="CAL_RESULT" align="center" />,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="CAL_RESULT" value={getValue<string>()} />,
    },
    {
      accessorKey: 'calibrationOrg',
      header: t('equipment.calibrationHistory.org', '교정기관'),
      size: 120,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'calibrator',
      header: t('equipment.calibrationHistory.calibrator', '교정자'),
      size: 90,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'certificateNo',
      header: t('equipment.calibrationHistory.certNo', '성적서번호'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'measuredValue',
      header: t('equipment.calibrationHistory.measured', '측정값'),
      size: 80,
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'referenceValue',
      header: t('equipment.calibrationHistory.reference', '기준값'),
      size: 80,
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];
}
