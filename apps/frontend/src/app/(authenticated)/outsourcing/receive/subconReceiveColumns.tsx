import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { SubconReceive } from './types';

export function createSubconReceiveGridColumns(t: TFunction): ColumnDef<SubconReceive>[] {
  return [
    { accessorKey: 'receiveNo', header: t('outsourcing.receive.receiveNo'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'orderNo', header: t('outsourcing.order.orderNo'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'vendorName', header: t('outsourcing.order.vendor'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'qty', header: t('outsourcing.receive.receiveQty'), size: 80, cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString() },
    {
      accessorKey: 'goodQty',
      header: t('outsourcing.receive.goodQty'),
      size: 80,
      cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400">{(getValue<number>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'defectQty',
      header: t('outsourcing.receive.defectQty'),
      size: 80,
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value > 0 ? <span className="text-red-600 dark:text-red-400">{value.toLocaleString()}</span> : '-';
      },
    },
    {
      accessorKey: 'inspectResult',
      header: () => <StatusHeaderHelp label={t('outsourcing.receive.inspectResult')} codeType="SUBCON_INSPECT_RESULT" align="center" />,
      size: 90,
      cell: ({ getValue }) => <StatusBadge codeType="SUBCON_INSPECT_RESULT" value={getValue<string>()} />,
    },
    { accessorKey: 'receivedAt', header: t('outsourcing.receive.receiveDate'), size: 130 },
    { accessorKey: 'workerName', header: t('outsourcing.receive.worker'), size: 80 },
  ];
}
