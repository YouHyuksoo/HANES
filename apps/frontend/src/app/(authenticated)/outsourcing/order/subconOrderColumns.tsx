import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { SubconOrder } from './types';

interface CreateSubconOrderGridColumnsOptions {
  t: TFunction;
  onShowDetail: (order: SubconOrder) => void;
}

export function createSubconOrderGridColumns({
  t,
  onShowDetail,
}: CreateSubconOrderGridColumnsOptions): ColumnDef<SubconOrder>[] {
  return [
    {
      id: 'actions',
      header: t('common.manage'),
      size: 70,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => (
        <button onClick={() => onShowDetail(row.original)} className="p-1 hover:bg-surface rounded">
          <Eye className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: 'orderNo',
      header: t('outsourcing.order.orderNo'),
      size: 130,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'vendorName',
      header: t('outsourcing.order.vendor'),
      size: 130,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'itemCode',
      header: t('common.partCode'),
      size: 100,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'itemName',
      header: t('common.partName'),
      size: 130,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'orderQty',
      header: t('outsourcing.order.orderQty'),
      size: 80,
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    {
      accessorKey: 'deliveredQty',
      header: t('outsourcing.order.deliveredQty'),
      size: 80,
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    {
      accessorKey: 'receivedQty',
      header: t('outsourcing.order.receivedQty'),
      size: 80,
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    { accessorKey: 'orderDate', header: t('outsourcing.order.orderDate'), size: 100 },
    { accessorKey: 'dueDate', header: t('outsourcing.order.dueDate'), size: 100 },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="SUBCON_ORDER_STATUS" align="center" />,
      size: 90,
      cell: ({ getValue }) => <StatusBadge codeType="SUBCON_ORDER_STATUS" value={getValue<string>()} />,
    },
  ];
}
