"use client";

/**
 * @file src/pages/consumables/receiving/components/ReceivingTable.tsx
 * @description 입고 이력 테이블 컴포넌트
 */
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { ReceivingLog } from '@/hooks/consumables/useReceivingData';

const logTypeColors: Record<string, string> = {
  IN: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  IN_RETURN: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

interface ReceivingTableProps {
  data: ReceivingLog[];
  toolbarLeft?: ReactNode;
  isLoading?: boolean;
}

function ReceivingTable({ data, toolbarLeft, isLoading }: ReceivingTableProps) {
  const { t } = useTranslation();

  const logTypeLabels: Record<string, string> = {
    IN: t('consumables.receiving.typeIn'),
    IN_RETURN: t('consumables.receiving.typeInReturn'),
  };

  const incomingTypeLabels: Record<string, string> = {
    NEW: t('consumables.receiving.typeNew'),
    REPLACEMENT: t('consumables.receiving.typeReplacement'),
  };

  const columns = useMemo<ColumnDef<ReceivingLog>[]>(
    () => [
      { accessorKey: 'createdAt', header: t('consumables.comp.dateTime'), size: 140, meta: { filterType: 'date' } },
      { accessorKey: 'consumableCode', header: t('consumables.comp.consumableCode'), size: 110 },
      { accessorKey: 'consumableName', header: t('consumables.comp.consumableName'), size: 140 },
      {
        accessorKey: 'logType',
        header: t('consumables.comp.logType'),
        size: 90,
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${logTypeColors[type] ?? ''}`}>
              {logTypeLabels[type] ?? type}
            </span>
          );
        },
      },
      {
        accessorKey: 'qty',
        header: t('common.quantity'),
        size: 70,
        cell: ({ row }) => {
          const isReturn = row.original.logType === 'IN_RETURN';
          return (
            <span className={isReturn ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
              {isReturn ? '-' : '+'}{row.original.qty}
            </span>
          );
        },
      },
      { accessorKey: 'vendorCode', header: t('consumables.comp.vendorCode'), size: 110 },
      { accessorKey: 'vendorName', header: t('consumables.comp.vendorName'), size: 110 },
      {
        accessorKey: 'unitPrice',
        header: t('consumables.comp.unitPrice'),
        size: 100,
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          return val != null ? val.toLocaleString() + t('common.won') : '-';
        },
      },
      {
        accessorKey: 'incomingType',
        header: t('consumables.comp.incomingType'),
        size: 80,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? incomingTypeLabels[val] ?? val : '-';
        },
      },
      {
        accessorKey: 'remark',
        header: t('common.remark'),
        size: 180,
        cell: ({ getValue }) => getValue() as string ?? '-',
      },
    ],
    [t]
  );

  return <DataGrid data={data} columns={columns} isLoading={isLoading} enableExport exportFileName="consumable_receiving" toolbarLeft={toolbarLeft} />;
}

export default ReceivingTable;
