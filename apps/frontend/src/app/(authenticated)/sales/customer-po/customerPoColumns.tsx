import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Trash2 } from 'lucide-react';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { CustomerOrder } from './components/CustomerPoFormPanel';

interface CreateCustomerPoGridColumnsOptions {
  t: TFunction;
  isPanelOpen: boolean;
  onEditOrder: (order: CustomerOrder, shouldAnimate: boolean) => void;
  onDeleteOrder: (order: CustomerOrder) => void;
}

export function createCustomerPoGridColumns({
  t,
  isPanelOpen,
  onEditOrder,
  onDeleteOrder,
}: CreateCustomerPoGridColumnsOptions): ColumnDef<CustomerOrder>[] {
  return [
    {
      id: 'actions',
      header: '',
      size: 80,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onEditOrder(row.original, !isPanelOpen);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDeleteOrder(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'orderNo',
      header: t('shipping.customerPo.orderNo'),
      size: 160,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'customerName',
      header: t('shipping.customerPo.customer'),
      size: 120,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'orderDate',
      header: t('shipping.customerPo.orderDate'),
      size: 100,
      meta: { filterType: 'date' as const },
    },
    {
      accessorKey: 'dueDate',
      header: t('shipping.customerPo.dueDate'),
      size: 100,
      meta: { filterType: 'date' as const },
    },
    {
      accessorKey: 'itemCount',
      header: t('shipping.customerPo.itemCount'),
      size: 70,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-medium">{getValue<number>()}</span>,
    },
    {
      accessorKey: 'totalAmount',
      header: t('shipping.customerPo.totalAmount'),
      size: 120,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-medium">{(getValue<number>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="CUSTOMER_PO_STATUS" align="center" />,
      size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="CUSTOMER_PO_STATUS" value={getValue<string>()} />,
    },
  ];
}
