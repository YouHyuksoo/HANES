import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import StatusBadge from '@/components/shared/StatusBadge';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import type { PackResult } from './types';
import { formatDateOnly } from "@/utils/date";

export function createPackResultGridColumns(t: TFunction): ColumnDef<PackResult>[] {
  return [
    {
      accessorKey: 'packDate',
      header: t('production.packResult.packDate'),
      size: 120,
      meta: { filterType: 'date' as const },
      // packDate 는 BOX_MASTERS.CREATED_AT(TIMESTAMP) 이라 UTC ISO 로 내려온다
      cell: ({ getValue }) => formatDateOnly(getValue<string | null>(), '-'),
    },
    {
      accessorKey: 'boxNo',
      header: t('production.packResult.boxNo'),
      size: 170,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue<string>()}</span>,
    },
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
      accessorKey: 'packQty',
      header: t('production.packResult.packQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{getValue<number | null>()?.toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('production.packResult.boxStatus')} codeType="BOX_STATUS" />,
      size: 110,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="BOX_STATUS" value={getValue<string>()} />,
    },
    {
      accessorKey: 'palletNo',
      header: t('production.packResult.palletNo'),
      size: 130,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'oqcStatus',
      header: () => <StatusHeaderHelp label={t('production.packResult.oqcStatus')} codeType="OQC_STATUS" />,
      size: 110,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="OQC_STATUS" value={getValue<string>()} />,
    },
    {
      accessorKey: 'packer',
      header: t('production.packResult.packer'),
      size: 90,
      meta: { filterType: 'text' as const },
    },
  ];
}
