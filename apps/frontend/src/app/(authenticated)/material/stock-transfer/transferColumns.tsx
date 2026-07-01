import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { TransferRecord } from './types';

export function createTransferGridColumns(t: TFunction): ColumnDef<TransferRecord>[] {
  return [
    {
      accessorKey: 'transDate',
      header: t('material.transfer.transDate'),
      size: 100,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => String(getValue() ?? '').slice(0, 10),
    },
    {
      accessorKey: 'transNo',
      header: t('material.transfer.transNo'),
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
      header: t('material.transfer.qty'),
      size: 90,
      meta: { filterType: 'number' as const, align: 'right' as const },
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue<number | null>() ?? 0).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'fromWarehouseName',
      header: t('material.transfer.fromWarehouse'),
      size: 120,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'toWarehouseName',
      header: t('material.transfer.toWarehouse'),
      size: 120,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'remark',
      header: t('common.remark'),
      size: 180,
      meta: { filterType: 'text' as const },
    },
  ];
}
