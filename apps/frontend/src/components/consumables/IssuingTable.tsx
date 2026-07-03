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

  const columns = useMemo<ColumnDef<IssuingLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: t('consumables.comp.dateTime'),
        size: 160,
        meta: { filterType: 'date' },
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleString() : "-";
        },
      },
      { accessorKey: 'consumableCode', header: t('consumables.comp.consumableCode'), size: 110 },
      { accessorKey: 'consumableName', header: t('consumables.comp.consumableName'), size: 140 },
      { accessorKey: 'conUid', header: 'UID', size: 150,
        cell: ({ getValue }) => {
          const uid = getValue() as string | null;
          return uid ? <span className="font-mono text-xs">{uid}</span> : <span className="text-text-muted">-</span>;
        },
      },
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
              {isReturn ? '+' : '-'}{(row.original.qty ?? 0).toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: 'lineCode',
        header: t('consumables.comp.line'),
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'processCode',
        header: t('consumables.issuing.processLabel', '출고 공정'),
        size: 100,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
      },
      {
        accessorKey: 'equipCode',
        header: t('consumables.comp.equipment'),
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? '-',
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

  return <DataGrid
      sqlQuery={`SELECT *\nFROM CONSUMABLE_LOGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`} data={data} columns={columns} isLoading={isLoading} enableExport exportFileName="consumable_issuing" toolbarLeft={toolbarLeft} />;
}

export default IssuingTable;
