import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, RotateCcw, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import StatusHeaderHelp from '@/components/shared/StatusHeaderHelp';
import StatusBadge from '@/components/shared/StatusBadge';
import type { InterLog } from './types';

interface CreateInterfaceLogGridColumnsOptions {
  t: TFunction;
  messageTypeLabels: Record<string, string>;
  onShowDetail: (log: InterLog) => void;
  onRetry: (logId: string) => void;
}

export function createInterfaceLogGridColumns({
  t,
  messageTypeLabels,
  onShowDetail,
  onRetry,
}: CreateInterfaceLogGridColumnsOptions): ColumnDef<InterLog>[] {
  return [
    {
      id: 'actions',
      header: t('common.manage'),
      size: 100,
      meta: { align: 'center' as const, filterType: 'none' as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => onShowDetail(row.original)} className="p-1 hover:bg-surface rounded" title={t('common.detail')}>
            <Eye className="w-4 h-4 text-primary" />
          </button>
          {row.original.status === 'FAIL' && (
            <button onClick={() => onRetry(row.original.id)} className="p-1 hover:bg-surface rounded" title={t('interface.log.retry')}>
              <RotateCcw className="w-4 h-4 text-yellow-500" />
            </button>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'direction',
      header: t('interface.log.direction'),
      size: 70,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const direction = getValue<string>();
        return (
          <div className="flex items-center gap-1">
            {direction === 'IN'
              ? <><ArrowDownCircle className="w-4 h-4 text-blue-500" /><span className="text-xs">{t('interface.dashboard.inbound')}</span></>
              : <><ArrowUpCircle className="w-4 h-4 text-purple-500" /><span className="text-xs">{t('interface.dashboard.outbound')}</span></>}
          </div>
        );
      },
    },
    {
      accessorKey: 'messageType',
      header: t('interface.log.messageType'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const messageType = getValue<string>();
        return messageTypeLabels[messageType] || messageType;
      },
    },
    {
      accessorKey: 'interfaceId',
      header: t('interface.log.interfaceId'),
      size: 120,
      meta: { filterType: 'text' as const },
    },
    {
      accessorKey: 'status',
      header: () => <StatusHeaderHelp label={t('common.status')} codeType="IF_LOG_STATUS" align="center" />,
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <StatusBadge codeType="IF_LOG_STATUS" value={getValue<string>()} />,
    },
    {
      accessorKey: 'retryCount',
      header: t('interface.log.retryCount'),
      size: 70,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => {
        const count = getValue<number>();
        return count > 0 ? <span className="text-yellow-600 dark:text-yellow-400">{count}{t('common.count')}</span> : '-';
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('common.createdAt'),
      size: 140,
      meta: { filterType: 'date' as const },
    },
    {
      accessorKey: 'errorMsg',
      header: t('interface.log.errorMsg'),
      size: 150,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => {
        const message = getValue<string | null>();
        return message ? <span className="text-red-600 dark:text-red-400 text-xs">{message}</span> : '-';
      },
    },
  ];
}
