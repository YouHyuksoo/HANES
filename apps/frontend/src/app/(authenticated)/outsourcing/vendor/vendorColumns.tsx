import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2 } from 'lucide-react';
import type { Vendor } from './types';

interface CreateVendorGridColumnsOptions {
  t: TFunction;
  onEditVendor: (vendor: Vendor) => void;
}

function getVendorTypeLabel(t: TFunction, vendorType: string) {
  const labels: Record<string, string> = {
    SUBCON: t('outsourcing.vendor.typeSubcon'),
    SUPPLIER: t('outsourcing.vendor.typeSupplier'),
  };

  return labels[vendorType] ?? vendorType;
}

export function createVendorGridColumns({
  t,
  onEditVendor,
}: CreateVendorGridColumnsOptions): ColumnDef<Vendor>[] {
  return [
    {
      id: 'actions',
      header: t('common.manage'),
      size: 70,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => (
        <button onClick={() => onEditVendor(row.original)} className="p-1 hover:bg-surface rounded">
          <Edit2 className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: 'vendorCode',
      header: t('outsourcing.vendor.vendorCode'),
      size: 100,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'vendorName',
      header: t('outsourcing.vendor.vendorName'),
      size: 150,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'vendorType',
      header: t('outsourcing.vendor.type'),
      size: 70,
      cell: ({ getValue }) => {
        const vendorType = getValue<string>();
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${vendorType === 'SUBCON' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
            {getVendorTypeLabel(t, vendorType)}
          </span>
        );
      },
    },
    { accessorKey: 'bizNo', header: t('outsourcing.vendor.bizNo'), size: 120 },
    { accessorKey: 'ceoName', header: t('outsourcing.vendor.ceoName'), size: 80 },
    { accessorKey: 'contactPerson', header: t('outsourcing.vendor.contactPerson'), size: 80 },
    { accessorKey: 'tel', header: t('outsourcing.vendor.tel'), size: 120 },
    { accessorKey: 'address', header: t('outsourcing.vendor.address'), size: 180 },
    {
      accessorKey: 'useYn',
      header: t('outsourcing.vendor.useYn'),
      size: 60,
      cell: ({ getValue }) => <span className={getValue<string>() === 'Y' ? 'text-green-600' : 'text-gray-400'}>{getValue<string>() === 'Y' ? '●' : '○'}</span>,
    },
  ];
}
