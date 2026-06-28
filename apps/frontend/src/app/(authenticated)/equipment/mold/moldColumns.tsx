import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import StatusBadge from '@/components/shared/StatusBadge';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import type { Mold } from '@/types/mold';

export function createMoldGridColumns(t: TFunction): ColumnDef<Mold>[] {
  return [
    { accessorKey: 'moldCode', header: t('crimping.mold.code'), size: 100, meta: { filterType: 'text' as const } },
    { accessorKey: 'moldName', header: t('crimping.mold.name'), size: 150, meta: { filterType: 'text' as const } },
    { accessorKey: 'terminalName', header: t('crimping.terminal'), size: 120, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'currentShots',
      header: t('crimping.mold.currentShots'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => Number(getValue()).toLocaleString(),
    },
    {
      accessorKey: 'expectedLife',
      header: t('crimping.mold.expectedLife'),
      size: 100,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => Number(getValue()).toLocaleString(),
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="MOLD_LIFE_STATUS" align="center" />,
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="MOLD_LIFE_STATUS" value={getValue<string>()} />,
    },
  ];
}
