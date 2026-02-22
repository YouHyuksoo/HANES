"use client";

/**
 * @file src/pages/consumables/issuing/components/IssuingTable.tsx
 * @description 출고 이력 테이블 컴포넌트
 */
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import type { IssuingLog } from '@/hooks/consumables/useIssuingData';

const logTypeColors: Record<string, string> = {
  OUT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  OUT_RETURN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

interface IssuingTableProps {
  data: IssuingLog[];
  toolbarLeft?: ReactNode;
  isLoading?: boolean;
}

function IssuingTable({ data, toolbarLeft, isLoading }: IssuingTableProps) {
  const { t } = useTranslation();

  const logTypeLabels: Record<string, string> = {
    OUT: t('consumables.issuing.typeOut'),
    OUT_RETURN: t('consumables.issuing.typeOutReturn'),
  };

  const issueReasonLabels: Record<string, string> = {
    PRODUCTION: t('consumables.issuing.reasonProduction'),
    REPAIR: t('consumables.issuing.reasonRepair'),
    OTHER: t('consumables.issuing.reasonOther'),
  };

  const columns = useMemo<ColumnDef<IssuingLog>[]>(
    () => [
      { accessorKey: 'createdAt', header: t('consumables.comp.dateTime'), size: 140 },
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
          const isReturn = row.original.logType === 'OUT_RETURN';
          return (
            <span className={isReturn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {isReturn ? '+' : '-'}{row.original.qty}
            </span>
          );
        },
      },
      {
        accessorKey: 'department',
        header: t('consumables.comp.department'),
        size: 100,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'lineId',
        header: t('consumables.comp.line'),
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'equipId',
        header: t('consumables.comp.equipment'),
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'issueReason',
        header: t('consumables.comp.issueReason'),
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? issueReasonLabels[val] ?? val : '-';
        },
      },
      {
        accessorKey: 'remark',
        header: t('common.remark'),
        size: 160,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
    ],
    [t]
  );

  return <DataGrid data={data} columns={columns} isLoading={isLoading} enableExport exportFileName="consumable_issuing" toolbarLeft={toolbarLeft} />;
}

export default IssuingTable;
