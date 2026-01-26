/**
 * @file src/pages/cutting/OrderPage.tsx
 * @description 절단 작업지시 페이지 - 전선 절단 작업 관리
 *
 * 초보자 가이드:
 * 1. **절단 작업지시**: 어떤 전선을 몇 mm로 몇 가닥 자를지 지시
 * 2. **릴 투입**: 작업 시작 전 전선 릴(보빈)을 설비에 장착
 * 3. **탈피 길이**: 전선 양 끝의 피복을 벗기는 길이 설정
 */
import { useState, useMemo } from 'react';
import { Play, CheckCircle, Search, RefreshCw, Download, Eye, Scissors, Cable } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { CuttingOrder, CuttingOrderStatus, WireReel, statusStyles } from './types';

// Mock 데이터
const mockOrders: CuttingOrder[] = [
  { id: '1', orderNo: 'CT-20250126-001', orderDate: '2025-01-26', wireCode: 'W-001', wireName: 'AVS 0.5sq', wireSpec: '0.5sq', color: 'RED', cutLength: 1500, stripLengthA: 5, stripLengthB: 7, planQty: 1000, prodQty: 0, equipCode: 'CUT-001', status: 'WAITING' },
  { id: '2', orderNo: 'CT-20250126-002', orderDate: '2025-01-26', wireCode: 'W-002', wireName: 'AVS 0.85sq', wireSpec: '0.85sq', color: 'BLACK', cutLength: 2000, stripLengthA: 6, stripLengthB: 6, planQty: 800, prodQty: 450, equipCode: 'CUT-001', status: 'RUNNING', reelLotNo: 'REEL-20250120-001' },
  { id: '3', orderNo: 'CT-20250125-001', orderDate: '2025-01-25', wireCode: 'W-003', wireName: 'AVS 2.0sq', wireSpec: '2.0sq', color: 'YELLOW', cutLength: 1200, stripLengthA: 8, stripLengthB: 8, planQty: 500, prodQty: 500, equipCode: 'CUT-002', status: 'DONE', reelLotNo: 'REEL-20250118-002' },
  { id: '4', orderNo: 'CT-20250126-003', orderDate: '2025-01-26', wireCode: 'W-001', wireName: 'AVS 0.5sq', wireSpec: '0.5sq', color: 'WHITE', cutLength: 800, stripLengthA: 4, stripLengthB: 4, planQty: 2000, prodQty: 0, equipCode: 'CUT-002', status: 'WAITING' },
];

const mockReels: WireReel[] = [
  { id: '1', lotNo: 'REEL-20250120-001', wireCode: 'W-002', wireName: 'AVS 0.85sq', wireSpec: '0.85sq', color: 'BLACK', totalLength: 500, usedLength: 120, remainLength: 380, receiveDate: '2025-01-20', supplier: '삼원전선' },
  { id: '2', lotNo: 'REEL-20250118-002', wireCode: 'W-003', wireName: 'AVS 2.0sq', wireSpec: '2.0sq', color: 'YELLOW', totalLength: 300, usedLength: 300, remainLength: 0, receiveDate: '2025-01-18', supplier: '대한전선' },
  { id: '3', lotNo: 'REEL-20250122-001', wireCode: 'W-001', wireName: 'AVS 0.5sq', wireSpec: '0.5sq', color: 'RED', totalLength: 1000, usedLength: 0, remainLength: 1000, receiveDate: '2025-01-22', supplier: '삼원전선' },
];

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'WAITING', label: '대기' },
  { value: 'RUNNING', label: '진행중' },
  { value: 'DONE', label: '완료' },
];

function OrderPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReelOpen, setIsReelOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CuttingOrder | null>(null);

  const filteredOrders = useMemo(() => {
    return mockOrders.filter((order) => {
      const matchStatus = !statusFilter || order.status === statusFilter;
      const matchSearch = !searchText ||
        order.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        order.wireCode.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const availableReels = useMemo(() => {
    if (!selectedOrder) return [];
    return mockReels.filter(r => r.wireCode === selectedOrder.wireCode && r.remainLength > 0);
  }, [selectedOrder]);

  const handleStatusChange = (id: string, status: CuttingOrderStatus) => {
    console.log(`절단지시 ${id} 상태 변경: ${status}`);
  };

  const handleReelInput = (reelLotNo: string) => {
    console.log(`릴 투입: ${reelLotNo} -> ${selectedOrder?.orderNo}`);
    setIsReelOpen(false);
  };

  const columns = useMemo<ColumnDef<CuttingOrder>[]>(() => [
    { accessorKey: 'orderNo', header: '작업지시번호', size: 140 },
    { accessorKey: 'orderDate', header: '지시일', size: 100 },
    { accessorKey: 'wireName', header: '전선명', size: 120 },
    { accessorKey: 'color', header: '색상', size: 70 },
    { accessorKey: 'cutLength', header: '절단길이(mm)', size: 100, cell: ({ getValue }) => `${(getValue() as number).toLocaleString()}` },
    { id: 'strip', header: '탈피(A/B)', size: 90, cell: ({ row }) => `${row.original.stripLengthA}/${row.original.stripLengthB}` },
    { accessorKey: 'planQty', header: '계획', size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'prodQty', header: '실적', size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'equipCode', header: '설비', size: 80 },
    { accessorKey: 'status', header: '상태', size: 80, cell: ({ getValue }) => { const s = getValue() as CuttingOrderStatus; return <span className={`px-2 py-1 text-xs rounded-full ${statusStyles[s].color}`}>{statusStyles[s].label}</span>; } },
    { id: 'actions', header: '관리', size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(row.original); setIsDetailOpen(true); }} className="p-1 hover:bg-surface rounded" title="상세"><Eye className="w-4 h-4 text-text-muted" /></button>
          {row.original.status === 'WAITING' && <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(row.original); setIsReelOpen(true); }} className="p-1 hover:bg-surface rounded" title="릴투입"><Cable className="w-4 h-4 text-blue-500" /></button>}
          {row.original.status === 'WAITING' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(row.original.id, 'RUNNING'); }} className="p-1 hover:bg-surface rounded" title="시작"><Play className="w-4 h-4 text-green-500" /></button>}
          {row.original.status === 'RUNNING' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(row.original.id, 'DONE'); }} className="p-1 hover:bg-surface rounded" title="완료"><CheckCircle className="w-4 h-4 text-blue-500" /></button>}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Scissors className="w-7 h-7 text-primary" />절단 작업지시</h1>
          <p className="text-text-muted mt-1">전선 절단 작업을 지시하고 관리합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀</Button>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="지시번호, 전선코드 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder="상태" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredOrders} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedOrder(row); setIsDetailOpen(true); }} />
        </CardContent>
      </Card>

      {/* 상세 모달 */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="절단 작업지시 상세" size="md">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div><span className="text-sm text-text-muted">작업지시번호</span><p className="font-semibold">{selectedOrder.orderNo}</p></div>
              <div><span className="text-sm text-text-muted">지시일</span><p className="font-semibold">{selectedOrder.orderDate}</p></div>
              <div><span className="text-sm text-text-muted">전선명</span><p className="font-semibold">{selectedOrder.wireName}</p></div>
              <div><span className="text-sm text-text-muted">색상</span><p className="font-semibold">{selectedOrder.color}</p></div>
              <div><span className="text-sm text-text-muted">절단길이</span><p className="font-semibold">{selectedOrder.cutLength} mm</p></div>
              <div><span className="text-sm text-text-muted">탈피길이 (A/B)</span><p className="font-semibold">{selectedOrder.stripLengthA} / {selectedOrder.stripLengthB} mm</p></div>
              <div><span className="text-sm text-text-muted">계획/실적</span><p className="font-semibold">{selectedOrder.planQty.toLocaleString()} / {selectedOrder.prodQty.toLocaleString()}</p></div>
              <div><span className="text-sm text-text-muted">투입릴</span><p className="font-semibold">{selectedOrder.reelLotNo || '-'}</p></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsDetailOpen(false)}>닫기</Button></div>
          </div>
        )}
      </Modal>

      {/* 릴 투입 모달 */}
      <Modal isOpen={isReelOpen} onClose={() => setIsReelOpen(false)} title="전선 릴 투입" size="md">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">투입할 릴을 선택하세요. (전선: {selectedOrder?.wireName})</p>
          {availableReels.length === 0 ? (
            <div className="p-4 text-center text-text-muted">사용 가능한 릴이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {availableReels.map(reel => (
                <div key={reel.id} className="p-3 border border-border rounded-lg hover:bg-surface cursor-pointer" onClick={() => handleReelInput(reel.lotNo)}>
                  <div className="flex justify-between"><span className="font-medium">{reel.lotNo}</span><span className="text-sm text-text-muted">{reel.color}</span></div>
                  <div className="text-sm text-text-muted">잔량: {reel.remainLength}m / {reel.totalLength}m</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default OrderPage;
