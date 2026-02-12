"use client";

/**
 * @file src/pages/outsourcing/OrderPage.tsx
 * @description 외주발주 관리 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Eye, RefreshCw, Search, FileText, Truck, Package, CheckCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface SubconOrder {
  id: string;
  orderNo: string;
  vendorName: string;
  partCode: string;
  partName: string;
  orderQty: number;
  deliveredQty: number;
  receivedQty: number;
  defectQty: number;
  orderDate: string;
  dueDate: string;
  status: string;
}

const mockData: SubconOrder[] = [
  {
    id: '1',
    orderNo: 'SCO20250127001',
    vendorName: '(주)하네스파트너',
    partCode: 'WH-001',
    partName: '와이어하네스 A타입',
    orderQty: 1000,
    deliveredQty: 1000,
    receivedQty: 950,
    defectQty: 10,
    orderDate: '2025-01-20',
    dueDate: '2025-01-27',
    status: 'PARTIAL_RECV',
  },
  {
    id: '2',
    orderNo: 'SCO20250126001',
    vendorName: '성진커넥터',
    partCode: 'WH-002',
    partName: '와이어하네스 B타입',
    orderQty: 500,
    deliveredQty: 500,
    receivedQty: 500,
    defectQty: 5,
    orderDate: '2025-01-18',
    dueDate: '2025-01-26',
    status: 'RECEIVED',
  },
  {
    id: '3',
    orderNo: 'SCO20250125001',
    vendorName: '(주)하네스파트너',
    partCode: 'WH-003',
    partName: '와이어하네스 C타입',
    orderQty: 2000,
    deliveredQty: 2000,
    receivedQty: 0,
    defectQty: 0,
    orderDate: '2025-01-22',
    dueDate: '2025-01-30',
    status: 'DELIVERED',
  },
  {
    id: '4',
    orderNo: 'SCO20250124001',
    vendorName: '성진커넥터',
    partCode: 'WH-004',
    partName: '와이어하네스 D타입',
    orderQty: 300,
    deliveredQty: 0,
    receivedQty: 0,
    defectQty: 0,
    orderDate: '2025-01-24',
    dueDate: '2025-02-05',
    status: 'ORDERED',
  },
];

const statusColors: Record<string, string> = {
  ORDERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  DELIVERED: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  PARTIAL_RECV: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CANCELED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function SubconOrderPage() {
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    ORDERED: t('outsourcing.order.statusOrdered'),
    DELIVERED: t('outsourcing.order.statusDelivered'),
    PARTIAL_RECV: t('outsourcing.order.statusPartialRecv'),
    RECEIVED: t('outsourcing.order.statusReceived'),
    CLOSED: t('outsourcing.order.statusClosed'),
    CANCELED: t('common.cancel'),
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SubconOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !statusFilter || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [searchTerm, statusFilter]);

  const columns = useMemo<ColumnDef<SubconOrder>[]>(
    () => [
      { accessorKey: 'orderNo', header: t('outsourcing.order.orderNo'), size: 130 },
      { accessorKey: 'vendorName', header: t('outsourcing.order.vendor'), size: 130 },
      { accessorKey: 'partCode', header: t('common.partCode'), size: 90 },
      { accessorKey: 'partName', header: t('common.partName'), size: 140 },
      {
        accessorKey: 'orderQty',
        header: t('outsourcing.order.orderQty'),
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'deliveredQty',
        header: t('outsourcing.order.deliveredQty'),
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'receivedQty',
        header: t('outsourcing.order.receivedQty'),
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      { accessorKey: 'orderDate', header: t('outsourcing.order.orderDate'), size: 100 },
      { accessorKey: 'dueDate', header: t('outsourcing.order.dueDate'), size: 100 },
      {
        accessorKey: 'status',
        header: t('common.status'),
        size: 90,
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
        id: 'actions',
        header: t('common.manage'),
        size: 70,
        cell: ({ row }) => (
          <button
            onClick={() => { setSelectedOrder(row.original); setIsDetailModalOpen(true); }}
            className="p-1 hover:bg-surface rounded"
          >
            <Eye className="w-4 h-4 text-primary" />
          </button>
        ),
      },
    ],
    [t]
  );

  const stats = useMemo(() => ({
    ordered: mockData.filter((d) => d.status === 'ORDERED').length,
    delivered: mockData.filter((d) => d.status === 'DELIVERED').length,
    pending: mockData.filter((d) => ['DELIVERED', 'PARTIAL_RECV'].includes(d.status)).length,
    received: mockData.filter((d) => d.status === 'RECEIVED').length,
  }), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />{t('outsourcing.order.title')}</h1>
          <p className="text-text-muted mt-1">{t('outsourcing.order.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('outsourcing.order.register')}
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('outsourcing.order.statusOrdered')} value={stats.ordered} icon={FileText} color="blue" />
        <StatCard label={t('outsourcing.order.statusDelivered')} value={stats.delivered} icon={Truck} color="purple" />
        <StatCard label={t('outsourcing.order.pendingReceive')} value={stats.pending} icon={Package} color="yellow" />
        <StatCard label={t('outsourcing.order.statusReceived')} value={stats.received} icon={CheckCircle} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('outsourcing.order.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: t('common.allStatus') }, { value: 'ORDERED', label: t('outsourcing.order.statusOrdered') }, { value: 'DELIVERED', label: t('outsourcing.order.statusDelivered') }, { value: 'PARTIAL_RECV', label: t('outsourcing.order.statusPartialRecv') }, { value: 'RECEIVED', label: t('outsourcing.order.statusReceived') }]} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 발주등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('outsourcing.order.register')}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label={t('outsourcing.order.vendor')}
            options={[
              { value: '1', label: '(주)하네스파트너' },
              { value: '2', label: '성진커넥터' },
            ]}
            fullWidth
          />
          <Input label={t('common.partCode')} placeholder="WH-001" fullWidth />
          <Input label={t('common.partName')} placeholder="와이어하네스 A타입" fullWidth />
          <Input label={t('outsourcing.order.orderQty')} type="number" placeholder="1000" fullWidth />
          <Input label={t('outsourcing.order.dueDate')} type="date" fullWidth />
          <Input label={t('common.remark')} placeholder={t('common.remarkPlaceholder')} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{t('common.register')}</Button>
        </div>
      </Modal>

      {/* 상세보기 모달 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`${t('outsourcing.order.detail')} - ${selectedOrder?.orderNo}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-muted">{t('outsourcing.order.vendor')}</p>
                <p className="font-medium text-text">{selectedOrder.vendorName}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('common.part')}</p>
                <p className="font-medium text-text">{selectedOrder.partCode} - {selectedOrder.partName}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('outsourcing.order.orderDate')}</p>
                <p className="font-medium text-text">{selectedOrder.orderDate}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">{t('outsourcing.order.dueDate')}</p>
                <p className="font-medium text-text">{selectedOrder.dueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 bg-surface rounded-lg">
              <div className="text-center">
                <p className="text-sm text-text-muted">{t('outsourcing.order.orderQty')}</p>
                <p className="text-lg font-bold leading-tight text-text">{selectedOrder.orderQty.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">{t('outsourcing.order.deliveredQty')}</p>
                <p className="text-lg font-bold leading-tight text-purple-600 dark:text-purple-400">{selectedOrder.deliveredQty.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">{t('outsourcing.order.receivedQty')}</p>
                <p className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">{selectedOrder.receivedQty.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">{t('outsourcing.order.defectQty')}</p>
                <p className="text-lg font-bold leading-tight text-red-600 dark:text-red-400">{selectedOrder.defectQty.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {selectedOrder.status === 'ORDERED' && (
                <Button>{t('outsourcing.order.registerDelivery')}</Button>
              )}
              {['DELIVERED', 'PARTIAL_RECV'].includes(selectedOrder.status) && (
                <Button>{t('outsourcing.order.registerReceive')}</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SubconOrderPage;
