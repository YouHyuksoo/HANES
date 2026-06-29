import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { CustomsLot } from './types';

export function createCustomsStockGridColumns(t: TFunction): ColumnDef<CustomsLot>[] {
  return [
    { accessorKey: 'entryNo', header: t('customs.entry.entryNo'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'matUid', header: t('customs.stock.matUid'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('common.partName'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'origin', header: t('customs.entry.origin'), size: 70, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'qty',
      header: t('customs.stock.receivedQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    {
      accessorKey: 'usedQty',
      header: t('customs.stock.usedQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    {
      accessorKey: 'remainQty',
      header: t('customs.stock.remainQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return <span className={value === 0 ? 'text-text-muted' : 'font-semibold text-primary'}>{value.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="CUSTOMS_LOT_STATUS" align="center" />,
      size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="CUSTOMS_LOT_STATUS" value={getValue<string>()} />,
    },
    {
      accessorKey: 'declarationDate',
      header: t('customs.entry.declarationDate'),
      size: 100,
      meta: { filterType: 'date' as const },
    },
  ];
}
