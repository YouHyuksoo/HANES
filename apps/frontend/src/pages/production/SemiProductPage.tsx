/**
 * @file src/pages/production/SemiProductPage.tsx
 * @description 반제품관리 페이지 - 반제품 목록, 상태 관리, 공정 이동 기능
 *
 * 초보자 가이드:
 * 1. **반제품 목록**: DataGrid로 반제품 현황 표시
 * 2. **상태 관리**: 대기/생산중/완료 상태 변경
 * 3. **공정 이동**: 다음 공정으로 이동 처리
 */
import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  RefreshCw, Search, Package, ArrowRight, Clock, CheckCircle,
  PlayCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Select, Modal } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';

// ========================================
// 타입 정의
// ========================================
type SemiStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'MOVED';
type ProcessType = 'CUTTING' | 'CRIMPING' | 'ASSEMBLY' | 'INSPECTION';

interface SemiProduct {
  id: string;
  semiCode: string;
  partName: string;
  workOrderNo: string;
  qty: number;
  currentProcess: ProcessType;
  status: SemiStatus;
  createdAt: string;
  updatedAt: string;
  lotNo: string;
}

// ========================================
// Mock 데이터
// ========================================
const mockSemiProducts: SemiProduct[] = [
  { id: '1', semiCode: 'SEMI-001', partName: '서브 하네스 A', workOrderNo: 'WO-2024-0115-001', qty: 100, currentProcess: 'CRIMPING', status: 'IN_PROGRESS', createdAt: '2024-01-15 08:00', updatedAt: '2024-01-15 09:30', lotNo: 'LOT-20240115-001' },
  { id: '2', semiCode: 'SEMI-002', partName: '서브 하네스 B', workOrderNo: 'WO-2024-0115-001', qty: 150, currentProcess: 'CUTTING', status: 'COMPLETED', createdAt: '2024-01-15 08:30', updatedAt: '2024-01-15 10:00', lotNo: 'LOT-20240115-002' },
  { id: '3', semiCode: 'SEMI-003', partName: '커넥터 Assy', workOrderNo: 'WO-2024-0115-002', qty: 200, currentProcess: 'ASSEMBLY', status: 'WAITING', createdAt: '2024-01-15 09:00', updatedAt: '2024-01-15 09:00', lotNo: 'LOT-20240115-003' },
  { id: '4', semiCode: 'SEMI-004', partName: '전원 하네스', workOrderNo: 'WO-2024-0115-002', qty: 80, currentProcess: 'INSPECTION', status: 'IN_PROGRESS', createdAt: '2024-01-15 07:00', updatedAt: '2024-01-15 11:00', lotNo: 'LOT-20240115-004' },
  { id: '5', semiCode: 'SEMI-005', partName: '신호선 Assy', workOrderNo: 'WO-2024-0115-003', qty: 120, currentProcess: 'CRIMPING', status: 'COMPLETED', createdAt: '2024-01-15 08:15', updatedAt: '2024-01-15 10:30', lotNo: 'LOT-20240115-005' },
  { id: '6', semiCode: 'SEMI-006', partName: '접지선 Assy', workOrderNo: 'WO-2024-0115-003', qty: 90, currentProcess: 'CUTTING', status: 'WAITING', createdAt: '2024-01-15 09:30', updatedAt: '2024-01-15 09:30', lotNo: 'LOT-20240115-006' },
];

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'WAITING', label: '대기' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'COMPLETED', label: '완료' },
];

const processOptions = [
  { value: '', label: '전체 공정' },
  { value: 'CUTTING', label: '절단' },
  { value: 'CRIMPING', label: '압착' },
  { value: 'ASSEMBLY', label: '조립' },
  { value: 'INSPECTION', label: '검사' },
];

const statusConfig: Record<SemiStatus, { label: string; color: string; icon: typeof Clock }> = {
  WAITING: { label: '대기', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
  IN_PROGRESS: { label: '진행중', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: PlayCircle },
  COMPLETED: { label: '완료', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  MOVED: { label: '이동완료', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: ArrowRight },
};

const processLabels: Record<ProcessType, string> = { CUTTING: '절단', CRIMPING: '압착', ASSEMBLY: '조립', INSPECTION: '검사' };

// ========================================
// 상태 배지 컴포넌트
// ========================================
function StatusBadge({ status }: { status: SemiStatus }) {
  const { label, color, icon: Icon } = statusConfig[status];
  return <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${color}`}><Icon className="w-3 h-3" />{label}</span>;
}

// ========================================
// 메인 컴포넌트
// ========================================
function SemiProductPage() {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<SemiProduct | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const filteredData = useMemo(() => {
    return mockSemiProducts.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (processFilter && item.currentProcess !== processFilter) return false;
      if (searchText && !item.semiCode.toLowerCase().includes(searchText.toLowerCase()) && !item.partName.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [searchText, statusFilter, processFilter]);

  const stats = useMemo(() => ({
    total: mockSemiProducts.length,
    waiting: mockSemiProducts.filter((s) => s.status === 'WAITING').length,
    inProgress: mockSemiProducts.filter((s) => s.status === 'IN_PROGRESS').length,
    completed: mockSemiProducts.filter((s) => s.status === 'COMPLETED').length,
  }), []);

  const columns = useMemo<ColumnDef<SemiProduct>[]>(() => [
    { accessorKey: 'semiCode', header: '반제품코드', size: 110 },
    { accessorKey: 'partName', header: '품명', size: 140 },
    { accessorKey: 'workOrderNo', header: '작업지시번호', size: 150 },
    { accessorKey: 'qty', header: '수량', size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'currentProcess', header: '현재공정', size: 80, cell: ({ getValue }) => <span className="px-2 py-1 text-xs rounded bg-surface text-text">{processLabels[getValue() as ProcessType]}</span> },
    { accessorKey: 'status', header: '상태', size: 90, cell: ({ getValue }) => <StatusBadge status={getValue() as SemiStatus} /> },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 150, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: 'updatedAt', header: '최종수정', size: 130 },
    { id: 'actions', header: '관리', size: 80, cell: ({ row }) => (
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedItem(row.original); setIsMoveModalOpen(true); }} disabled={row.original.status !== 'COMPLETED'}>
        <ArrowRight className="w-4 h-4" />
      </Button>
    )},
  ], []);

  const handleMove = () => {
    if (selectedItem) console.log(`반제품 ${selectedItem.semiCode} 공정 이동 처리`);
    setIsMoveModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />반제품관리</h1>
          <p className="text-text-muted mt-1">반제품 현황과 공정 이동을 관리합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />새로고침</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm"><CardContent><div className="text-text-muted text-sm">전체</div><div className="text-2xl font-bold text-text mt-1">{stats.total}건</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="text-text-muted text-sm">대기</div><div className="text-2xl font-bold text-gray-500 mt-1">{stats.waiting}건</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="text-text-muted text-sm">진행중</div><div className="text-2xl font-bold text-blue-500 mt-1">{stats.inProgress}건</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="text-text-muted text-sm">완료</div><div className="text-2xl font-bold text-green-500 mt-1">{stats.completed}건</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader title="반제품 목록" subtitle={`총 ${filteredData.length}건`} />
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="코드 또는 품명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <Select options={processOptions} value={processFilter} onChange={setProcessFilter} placeholder="공정" />
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder="상태" />
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title="공정 이동" size="sm">
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">선택된 반제품</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedItem.partName}</div>
              <div className="text-sm text-text-muted mt-1">{selectedItem.semiCode} | {selectedItem.qty}개</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-text-muted">현재 공정:</span>
                <span className="px-2 py-1 text-xs rounded bg-surface text-text">{processLabels[selectedItem.currentProcess]}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="px-3 py-2 bg-blue-100 text-blue-700 rounded">{processLabels[selectedItem.currentProcess]}</span>
              <ArrowRight className="w-6 h-6 text-text-muted" />
              <span className="px-3 py-2 bg-green-100 text-green-700 rounded">다음 공정</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsMoveModalOpen(false)}>취소</Button>
              <Button onClick={handleMove}><ArrowRight className="w-4 h-4 mr-1" />이동 처리</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SemiProductPage;
