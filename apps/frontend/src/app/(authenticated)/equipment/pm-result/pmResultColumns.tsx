import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { WoRow } from './types';

const resultColors: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const priorityColors: Record<string, string> = {
  HIGH: 'text-red-600 dark:text-red-400',
  MEDIUM: 'text-yellow-600 dark:text-yellow-400',
  LOW: 'text-text-muted',
};

export function createPmResultGridColumns(t: TFunction): ColumnDef<WoRow>[] {
  return [
    {
      accessorKey: 'workOrderNo',
      header: t('equipment.pmResult.woNo', 'WO번호'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'scheduledDate',
      header: t('equipment.pmResult.scheduledDate', '예정일'),
      size: 100,
      meta: { filterType: 'date' as const },
    },
    {
      id: 'equipCode',
      header: t('equipment.pmResult.equipCode', '설비코드'),
      size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.equip?.equipCode || row.original.equipCode}</span>,
    },
    {
      id: 'equipName',
      header: t('equipment.pmResult.equipName', '설비명'),
      size: 140,
      cell: ({ row }) => row.original.equip?.equipName || '-',
    },
    {
      accessorKey: 'status',
      size: 90,
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="PM_WO_STATUS" align="center" />,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="PM_WO_STATUS" value={getValue<string>()} />,
    },
    {
      accessorKey: 'overallResult',
      header: t('equipment.pmResult.result', '결과'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const result = getValue<string | null>();
        if (!result) return <span className="text-xs text-text-muted">-</span>;
        return <span className={`px-2 py-0.5 text-xs rounded font-medium ${resultColors[result] || ''}`}>{result}</span>;
      },
    },
    {
      accessorKey: 'priority',
      header: t('equipment.pmResult.priority', '우선순위'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const priority = getValue<string>();
        return <span className={`text-xs font-medium ${priorityColors[priority] || ''}`}>{priority}</span>;
      },
    },
    {
      accessorKey: 'completedAt',
      header: t('equipment.pmResult.completedAt', '완료일'),
      size: 100,
      cell: ({ getValue }) => {
        const completedAt = getValue<string | null>();
        return completedAt ? <span className="text-xs">{completedAt.split('T')[0]}</span> : '-';
      },
    },
    {
      accessorKey: 'remark',
      header: t('common.remark'),
      size: 160,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];
}
