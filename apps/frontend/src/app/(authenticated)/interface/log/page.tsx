"use client";

/**
 * @file src/pages/interface/LogPage.tsx
 * @description ERP 인터페이스 이력 조회 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search, Eye, RotateCcw, Download, ArrowDownCircle, ArrowUpCircle, Network } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface InterLog {
  id: string;
  direction: string;
  messageType: string;
  interfaceId: string;
  status: string;
  retryCount: number;
  errorMsg: string | null;
  createdAt: string;
  sendAt: string | null;
  recvAt: string | null;
}

const mockData: InterLog[] = [
  {
    id: '1',
    direction: 'IN',
    messageType: 'JOB_ORDER',
    interfaceId: 'JO-2025-001',
    status: 'SUCCESS',
    retryCount: 0,
    errorMsg: null,
    createdAt: '2025-01-27 10:30:15',
    sendAt: '2025-01-27 10:30:15',
    recvAt: '2025-01-27 10:30:16',
  },
  {
    id: '2',
    direction: 'OUT',
    messageType: 'PROD_RESULT',
    interfaceId: 'PR-2025-001',
    status: 'SUCCESS',
    retryCount: 0,
    errorMsg: null,
    createdAt: '2025-01-27 10:25:00',
    sendAt: '2025-01-27 10:25:00',
    recvAt: '2025-01-27 10:25:01',
  },
  {
    id: '3',
    direction: 'OUT',
    messageType: 'PROD_RESULT',
    interfaceId: 'PR-2025-002',
    status: 'FAIL',
    retryCount: 2,
    errorMsg: 'ERP 연결 시간 초과',
    createdAt: '2025-01-27 10:15:00',
    sendAt: '2025-01-27 10:15:00',
    recvAt: null,
  },
  {
    id: '4',
    direction: 'IN',
    messageType: 'BOM_SYNC',
    interfaceId: 'BOM-001',
    status: 'SUCCESS',
    retryCount: 0,
    errorMsg: null,
    createdAt: '2025-01-27 10:10:00',
    sendAt: '2025-01-27 10:10:00',
    recvAt: '2025-01-27 10:10:02',
  },
  {
    id: '5',
    direction: 'OUT',
    messageType: 'STOCK_SYNC',
    interfaceId: 'STK-001',
    status: 'PENDING',
    retryCount: 0,
    errorMsg: null,
    createdAt: '2025-01-27 10:05:00',
    sendAt: null,
    recvAt: null,
  },
];

const statusColors: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  RETRY: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

function InterfaceLogPage() {
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    SUCCESS: t('interface.log.statusSuccess'),
    FAIL: t('interface.log.statusFail'),
    PENDING: t('interface.log.statusPending'),
    RETRY: t('interface.log.statusRetry'),
  };

  const messageTypeLabels: Record<string, string> = {
    JOB_ORDER: t('interface.dashboard.msgJobOrder'),
    PROD_RESULT: t('interface.dashboard.msgProdResult'),
    BOM_SYNC: t('interface.dashboard.msgBomSync'),
    PART_SYNC: t('interface.dashboard.msgPartSync'),
    STOCK_SYNC: t('interface.log.msgStockSync'),
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<InterLog | null>(null);

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.interfaceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.messageType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDirection = !directionFilter || item.direction === directionFilter;
      const matchStatus = !statusFilter || item.status === statusFilter;
      return matchSearch && matchDirection && matchStatus;
    });
  }, [searchTerm, directionFilter, statusFilter]);

  const columns = useMemo<ColumnDef<InterLog>[]>(
    () => [
      {
        accessorKey: 'direction',
        header: t('interface.log.direction'),
        size: 70,
        cell: ({ getValue }) => {
          const dir = getValue() as string;
          return (
            <div className="flex items-center gap-1">
              {dir === 'IN' ? (
                <>
                  <ArrowDownCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-xs">{t('interface.dashboard.inbound')}</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="w-4 h-4 text-purple-500" />
                  <span className="text-xs">{t('interface.dashboard.outbound')}</span>
                </>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'messageType',
        header: t('interface.log.messageType'),
        size: 100,
        cell: ({ getValue }) => messageTypeLabels[getValue() as string] || getValue(),
      },
      { accessorKey: 'interfaceId', header: t('interface.log.interfaceId'), size: 120 },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>
          );
        },
      },
      {
        accessorKey: 'retryCount',
        header: t('interface.log.retryCount'),
        size: 70,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return count > 0 ? (
            <span className="text-yellow-600 dark:text-yellow-400">{count}회</span>
          ) : '-';
        },
      },
      { accessorKey: 'createdAt', header: t('common.createdAt'), size: 140 },
      {
        accessorKey: 'errorMsg',
        header: t('interface.log.errorMsg'),
        size: 150,
        cell: ({ getValue }) => {
          const msg = getValue() as string | null;
          return msg ? (
            <span className="text-red-600 dark:text-red-400 text-xs">{msg}</span>
          ) : '-';
        },
      },
      {
        id: 'actions',
        header: t('common.manage'),
        size: 100,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => { setSelectedLog(row.original); setIsDetailModalOpen(true); }}
              className="p-1 hover:bg-surface rounded"
              title={t('common.detail')}
            >
              <Eye className="w-4 h-4 text-primary" />
            </button>
            {row.original.status === 'FAIL' && (
              <button className="p-1 hover:bg-surface rounded" title={t('interface.log.retry')}>
                <RotateCcw className="w-4 h-4 text-yellow-500" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Network className="w-7 h-7 text-primary" />{t('interface.log.title')}</h1>
          <p className="text-text-muted mt-1">{t('interface.log.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
          </Button>
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('interface.log.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: t('interface.log.allDirections') }, { value: 'IN', label: t('interface.log.directionIn') }, { value: 'OUT', label: t('interface.log.directionOut') }]} value={directionFilter} onChange={setDirectionFilter} placeholder={t('interface.log.direction')} />
            <Select options={[{ value: '', label: t('common.allStatus') }, { value: 'SUCCESS', label: t('interface.log.statusSuccess') }, { value: 'FAIL', label: t('interface.log.statusFail') }, { value: 'PENDING', label: t('interface.log.statusPending') }, { value: 'RETRY', label: t('interface.log.statusRetry') }]} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 상세 모달 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={t('interface.log.detailTitle')}
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-muted">{t('interface.log.direction')}</p>
                <p className="font-medium text-text flex items-center gap-2">
                  {selectedLog.direction === 'IN' ? (
                    <>
                      <ArrowDownCircle className="w-5 h-5 text-blue-500" />
                      {t('interface.log.directionInDetail')}
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-5 h-5 text-purple-500" />
                      {t('interface.log.directionOutDetail')}
                    </>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('interface.log.messageType')}</p>
                <p className="font-medium text-text">{messageTypeLabels[selectedLog.messageType]}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('interface.log.interfaceId')}</p>
                <p className="font-medium text-text">{selectedLog.interfaceId}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('common.status')}</p>
                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[selectedLog.status]}`}>
                  {statusLabels[selectedLog.status]}
                </span>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('common.createdAt')}</p>
                <p className="font-medium text-text">{selectedLog.createdAt}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('interface.log.recvTime')}</p>
                <p className="font-medium text-text">{selectedLog.recvAt || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('interface.log.retryCount')}</p>
                <p className="font-medium text-text">{selectedLog.retryCount}회</p>
              </div>
            </div>

            {selectedLog.errorMsg && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('interface.log.errorMsg')}</p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{selectedLog.errorMsg}</p>
              </div>
            )}

            <div className="p-4 bg-surface rounded-lg">
              <p className="text-sm font-medium text-text mb-2">{t('interface.log.payload')}</p>
              <pre className="text-xs text-text-muted bg-background p-3 rounded overflow-auto max-h-48">
{`{
  "interfaceId": "${selectedLog.interfaceId}",
  "messageType": "${selectedLog.messageType}",
  "data": {
    "orderNo": "JO-2025-001",
    "partCode": "WH-001",
    "qty": 1000
  }
}`}
              </pre>
            </div>

            {selectedLog.status === 'FAIL' && (
              <div className="flex justify-end">
                <Button>
                  <RotateCcw className="w-4 h-4 mr-1" /> {t('interface.log.retry')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default InterfaceLogPage;
