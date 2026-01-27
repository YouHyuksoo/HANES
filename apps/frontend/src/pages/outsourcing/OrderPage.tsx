/**
 * @file src/pages/outsourcing/OrderPage.tsx
 * @description 외주발주 관리 페이지
 */
import { useState, useMemo } from 'react';
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

const statusLabels: Record<string, string> = {
  ORDERED: '발주완료',
  DELIVERED: '출고완료',
  PARTIAL_RECV: '일부입고',
  RECEIVED: '입고완료',
  CLOSED: '마감',
  CANCELED: '취소',
};

function SubconOrderPage() {
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
      { accessorKey: 'orderNo', header: '발주번호', size: 130 },
      { accessorKey: 'vendorName', header: '외주처', size: 130 },
      { accessorKey: 'partCode', header: '품목코드', size: 90 },
      { accessorKey: 'partName', header: '품목명', size: 140 },
      {
        accessorKey: 'orderQty',
        header: '발주수량',
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'deliveredQty',
        header: '출고수량',
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'receivedQty',
        header: '입고수량',
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      { accessorKey: 'orderDate', header: '발주일', size: 100 },
      { accessorKey: 'dueDate', header: '납기일', size: 100 },
      {
        accessorKey: 'status',
        header: '상태',
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
        header: '관리',
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
    []
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />외주발주 관리</h1>
          <p className="text-text-muted mt-1">외주 작업지시 및 발주 현황을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> 발주등록
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="발주완료" value={stats.ordered} icon={FileText} color="blue" />
        <StatCard label="출고완료" value={stats.delivered} icon={Truck} color="purple" />
        <StatCard label="입고대기" value={stats.pending} icon={Package} color="yellow" />
        <StatCard label="입고완료" value={stats.received} icon={CheckCircle} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="발주번호, 품목, 외주처 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: '전체 상태' }, { value: 'ORDERED', label: '발주완료' }, { value: 'DELIVERED', label: '출고완료' }, { value: 'PARTIAL_RECV', label: '일부입고' }, { value: 'RECEIVED', label: '입고완료' }]} value={statusFilter} onChange={setStatusFilter} placeholder="상태" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* 발주등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="외주발주 등록"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="외주처"
            options={[
              { value: '1', label: '(주)하네스파트너' },
              { value: '2', label: '성진커넥터' },
            ]}
            fullWidth
          />
          <Input label="품목코드" placeholder="WH-001" fullWidth />
          <Input label="품목명" placeholder="와이어하네스 A타입" fullWidth />
          <Input label="발주수량" type="number" placeholder="1000" fullWidth />
          <Input label="납기일" type="date" fullWidth />
          <Input label="비고" placeholder="비고 입력" fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button>
          <Button>등록</Button>
        </div>
      </Modal>

      {/* 상세보기 모달 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`발주 상세 - ${selectedOrder?.orderNo}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-muted">외주처</p>
                <p className="font-medium text-text">{selectedOrder.vendorName}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">품목</p>
                <p className="font-medium text-text">{selectedOrder.partCode} - {selectedOrder.partName}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">발주일</p>
                <p className="font-medium text-text">{selectedOrder.orderDate}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">납기일</p>
                <p className="font-medium text-text">{selectedOrder.dueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 bg-surface rounded-lg">
              <div className="text-center">
                <p className="text-sm text-text-muted">발주수량</p>
                <p className="text-lg font-bold leading-tight text-text">{selectedOrder.orderQty.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">출고수량</p>
                <p className="text-lg font-bold leading-tight text-purple-600 dark:text-purple-400">{selectedOrder.deliveredQty.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">입고수량</p>
                <p className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">{selectedOrder.receivedQty.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-muted">불량수량</p>
                <p className="text-lg font-bold leading-tight text-red-600 dark:text-red-400">{selectedOrder.defectQty.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {selectedOrder.status === 'ORDERED' && (
                <Button>출고등록</Button>
              )}
              {['DELIVERED', 'PARTIAL_RECV'].includes(selectedOrder.status) && (
                <Button>입고등록</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SubconOrderPage;
