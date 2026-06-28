import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { ScrapRecord } from './types';

export function createScrapGridColumns(t: TFunction): ColumnDef<ScrapRecord>[] {
  return [
    {
      accessorKey: 'transDate',
      header: t('material.scrap.transDate'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => String(getValue() ?? '').slice(0, 10),
    },
    {
      accessorKey: 'transNo',
      header: t('material.scrap.transNo'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'itemCode',
      header: t('common.partCode'),
      size: 110,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string | null>() || '-'}</span>,
    },
    {
      accessorKey: 'itemName',
      header: t('common.partName'),
      size: 150,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'matUid',
      header: 'LOT No.',
      size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string | null>() || '-'}</span>,
    },
    {
      accessorKey: 'qty',
      header: t('material.scrap.qty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">-{(getValue<number | null>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'warehouseName',
      header: t('material.scrap.warehouse'),
      size: 100,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'remark',
      header: t('material.scrap.reason'),
      size: 180,
      meta: { filterType: 'text' as const },
    },
  ];
}
