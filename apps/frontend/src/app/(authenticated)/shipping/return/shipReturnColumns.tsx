import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReturnRow, ShippedOrder, ShipType } from './types';

type ShipTypeLabel = (shipType: ShipType) => string;

export function createShipReturnOrderGridColumns(
  t: TFunction,
  typeLabel: ShipTypeLabel,
): ColumnDef<ShippedOrder>[] {
  return [
    {
      accessorKey: 'shipOrderNo',
      header: t('shipping.return.shipOrderNo', '출하지시번호'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono font-medium">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'customerName',
      header: t('shipping.return.customer', '고객사'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'shipDate',
      header: t('shipping.return.shipDate', '출하일'),
      size: 100,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        return value ? String(value).slice(0, 10) : '-';
      },
    },
    {
      accessorKey: 'shipType',
      header: t('shipping.return.shipType', '출하유형'),
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ getValue }) => <span className="text-xs font-medium text-text">{typeLabel(getValue<ShipType>())}</span>,
    },
    {
      accessorKey: 'shippedQty',
      header: t('shipping.return.shippedQty', '출하수량'),
      size: 90,
      meta: { align: 'right' as const, filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-medium">{(getValue<number>() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: 'palletCount',
      header: t('shipping.return.palletCount', '팔레트수'),
      size: 80,
      meta: { align: 'center' as const },
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    {
      accessorKey: 'boxCount',
      header: t('shipping.return.boxCount', '박스수'),
      size: 80,
      meta: { align: 'center' as const },
      cell: ({ getValue }) => (getValue<number>() ?? 0).toLocaleString(),
    },
    {
      accessorKey: 'hasErpSynced',
      header: 'ERP',
      size: 60,
      meta: { align: 'center' as const },
      cell: ({ getValue }) => (getValue<boolean>() ? 'Y' : '-'),
    },
  ];
}

export function createShipReturnHistoryGridColumns(t: TFunction): ColumnDef<ReturnRow>[] {
  return [
    {
      accessorKey: 'returnNo',
      header: t('shipping.return.returnNo', '반품번호'),
      size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'shipmentId',
      header: t('shipping.return.shipOrderNo', '출하지시번호'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'returnDate',
      header: t('shipping.return.returnDate', '반품일'),
      size: 100,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => {
        const value = getValue<string | null>();
        return value ? String(value).slice(0, 10) : '-';
      },
    },
    {
      accessorKey: 'returnReason',
      header: t('shipping.return.cancelReason', '취소 사유'),
      size: 200,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      size: 100,
      meta: { filterType: 'text' as const },
    },
  ];
}
