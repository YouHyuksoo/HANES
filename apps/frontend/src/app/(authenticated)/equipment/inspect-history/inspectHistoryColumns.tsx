import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { ComCodeBadge } from '@/components/ui';
import type { InspectHistory } from './types';

const formatInspectDate = (value: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

export function createInspectHistoryGridColumns(t: TFunction): ColumnDef<InspectHistory>[] {
  return [
    {
      accessorKey: 'inspectDate',
      header: t('equipment.inspectHistory.inspectDate'),
      size: 110,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => formatInspectDate(getValue()),
    },
    {
      accessorKey: 'inspectType',
      header: t('equipment.inspectHistory.inspectType'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_CHECK_TYPE" code={getValue<string>()} />,
    },
    {
      accessorKey: 'equipCode',
      header: t('equipment.inspectHistory.equipCode'),
      size: 130,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'equipName',
      header: t('equipment.inspectHistory.equipName'),
      size: 140,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'equipType',
      header: t('equipment.inspectHistory.equipType', '설비유형'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="EQUIP_TYPE" code={getValue<string>()} />,
    },
    {
      accessorKey: 'inspectorName',
      header: t('equipment.inspectHistory.inspector'),
      size: 90,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'overallResult',
      header: t('equipment.inspectHistory.result'),
      size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_JUDGE" code={getValue<string>()} />,
    },
    {
      accessorKey: 'remark',
      header: t('common.remark'),
      size: 180,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];
}
