"use client";

/**
 * @file src/pages/quality/DefectPage.tsx
 * @description 불량관리 페이지 - 불량 등록, 상태 관리, 통계 조회
 *
 * 초보자 가이드:
 * 1. **불량 목록**: DataGrid로 발생시간, 작업지시, 불량코드 등 표시
 * 2. **필터**: 날짜, 불량유형, 상태로 필터링
 * 3. **불량 등록**: 모달을 통해 새 불량 등록
 * 4. **상태 변경**: 수리대기 -> 수리중 -> 완료/폐기
 */
import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  RefreshCw,
  AlertTriangle,
  Wrench,
  CheckCircle,
  XCircle,
  Trash2,
  Calendar,
  Clock,
  Search,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';

// ========================================
// 타입 정의
// ========================================
type DefectStatus = 'PENDING' | 'REPAIRING' | 'COMPLETED' | 'SCRAPPED';

interface Defect {
  id: string;
  occurredAt: string;
  workOrderNo: string;
  defectCode: string;
  defectName: string;
  quantity: number;
  status: DefectStatus;
  partNo: string;
  equipmentNo: string;
  operator: string;
  remark?: string;
}

// ========================================
// Mock 데이터
// ========================================
const mockDefects: Defect[] = [
  {
    id: 'DEF-001',
    occurredAt: '2024-01-15 09:30',
    workOrderNo: 'WO-2024-0115-001',
    defectCode: 'D001',
    defectName: '피복 손상',
    quantity: 3,
    status: 'PENDING',
    partNo: 'WIRE-001',
    equipmentNo: 'CUT-01',
    operator: '김철수',
    remark: '절단면 불량',
  },
  {
    id: 'DEF-002',
    occurredAt: '2024-01-15 10:15',
    workOrderNo: 'WO-2024-0115-002',
    defectCode: 'D002',
    defectName: '압착 불량',
    quantity: 5,
    status: 'REPAIRING',
    partNo: 'TERM-002',
    equipmentNo: 'CRM-02',
    operator: '이영희',
  },
  {
    id: 'DEF-003',
    occurredAt: '2024-01-15 11:00',
    workOrderNo: 'WO-2024-0115-003',
    defectCode: 'D003',
    defectName: '통전 불량',
    quantity: 2,
    status: 'COMPLETED',
    partNo: 'HARNESS-001',
    equipmentNo: 'INS-01',
    operator: '박민수',
  },
  {
    id: 'DEF-004',
    occurredAt: '2024-01-15 13:30',
    workOrderNo: 'WO-2024-0115-004',
    defectCode: 'D004',
    defectName: '외관 불량',
    quantity: 1,
    status: 'SCRAPPED',
    partNo: 'CONN-003',
    equipmentNo: 'ASM-01',
    operator: '정수진',
    remark: '복구 불가',
  },
  {
    id: 'DEF-005',
    occurredAt: '2024-01-15 14:20',
    workOrderNo: 'WO-2024-0115-005',
    defectCode: 'D001',
    defectName: '피복 손상',
    quantity: 4,
    status: 'PENDING',
    partNo: 'WIRE-002',
    equipmentNo: 'CUT-02',
    operator: '최동훈',
  },
];

const defectTypes = [
  { value: '', label: '전체 유형' },
  { value: 'D001', label: '피복 손상' },
  { value: 'D002', label: '압착 불량' },
  { value: 'D003', label: '통전 불량' },
  { value: 'D004', label: '외관 불량' },
];

// ========================================
// 메인 컴포넌트
// ========================================
function DefectPage() {
  const comCodeStatusOptions = useComCodeOptions('DEFECT_STATUS');
  const statusOptions = [{ value: '', label: '전체 상태' }, ...comCodeStatusOptions];
  // 상태 관리
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [defectType, setDefectType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // 필터링된 데이터
  const filteredDefects = useMemo(() => {
    return mockDefects.filter((defect) => {
      if (defectType && defect.defectCode !== defectType) return false;
      if (statusFilter && defect.status !== statusFilter) return false;
      if (searchText && !defect.workOrderNo.toLowerCase().includes(searchText.toLowerCase()) && !defect.defectName.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [defectType, statusFilter, searchText]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = filteredDefects.length;
    const pending = filteredDefects.filter((d) => d.status === 'PENDING').length;
    const repairing = filteredDefects.filter((d) => d.status === 'REPAIRING').length;
    const completed = filteredDefects.filter((d) => d.status === 'COMPLETED').length;
    const scrapped = filteredDefects.filter((d) => d.status === 'SCRAPPED').length;
    const totalQty = filteredDefects.reduce((sum, d) => sum + d.quantity, 0);

    return { total, pending, repairing, completed, scrapped, totalQty };
  }, [filteredDefects]);

  // 상태 변경 핸들러
  const handleStatusChange = (newStatus: DefectStatus) => {
    if (selectedDefect) {
      console.log(`상태 변경: ${selectedDefect.id} -> ${newStatus}`);
      // TODO: API 호출
    }
    setIsStatusModalOpen(false);
    setSelectedDefect(null);
  };

  // 컬럼 정의
  const columns = useMemo<ColumnDef<Defect>[]>(
    () => [
      {
        accessorKey: 'occurredAt',
        header: '발생시간',
        size: 140,
      },
      {
        accessorKey: 'workOrderNo',
        header: '작업지시',
        size: 160,
        cell: ({ getValue }) => (
          <span className="text-primary font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'defectCode',
        header: '불량코드',
        size: 80,
      },
      {
        accessorKey: 'defectName',
        header: '불량명',
        size: 100,
      },
      {
        accessorKey: 'quantity',
        header: '수량',
        size: 60,
        cell: ({ getValue }) => (
          <span className="font-mono text-right block">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 100,
        cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_STATUS" code={getValue() as string} />,
      },
      {
        accessorKey: 'operator',
        header: '작업자',
        size: 80,
      },
      {
        id: 'actions',
        header: '관리',
        size: 100,
        cell: ({ row }) => (
          <button
            className="p-1 hover:bg-surface rounded text-xs text-primary"
            onClick={() => {
              setSelectedDefect(row.original);
              setIsStatusModalOpen(true);
            }}
          >
            상태변경
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><AlertTriangle className="w-7 h-7 text-primary" />불량관리</h1>
          <p className="text-text-muted mt-1">불량 발생 현황을 관리하고 수리 상태를 추적합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> 불량 등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="전체 건수" value={stats.total} icon={AlertTriangle} color="blue" />
        <StatCard label="수리대기" value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label="수리중" value={stats.repairing} icon={Wrench} color="blue" />
        <StatCard label="완료" value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label="총 불량수량" value={stats.totalQty} icon={XCircle} color="red" />
      </div>

      {/* 필터 + 데이터 그리드 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="작업지시, 불량명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Select options={defectTypes} value={defectType} onChange={setDefectType} placeholder="불량유형" />
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder="상태" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={filteredDefects}
            columns={columns}
            pageSize={10}
            onRowClick={(row) => {
              setSelectedDefect(row);
              setIsStatusModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* 불량 등록 모달 */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="불량 등록"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="작업지시 번호" placeholder="WO-2024-XXXX" fullWidth />
            <Select
              label="불량유형"
              options={defectTypes.filter((d) => d.value !== '')}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="품번" placeholder="품번을 입력하세요" fullWidth />
            <Input label="수량" type="number" placeholder="0" fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="설비번호" placeholder="설비번호" fullWidth />
            <Input label="작업자" placeholder="작업자명" fullWidth />
          </div>
          <Input label="비고" placeholder="불량 상세 내용을 입력하세요" fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>등록</Button>
          </div>
        </div>
      </Modal>

      {/* 상태 변경 모달 */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setSelectedDefect(null);
        }}
        title="상태 변경"
        size="sm"
      >
        {selectedDefect && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">선택된 불량</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedDefect.id}</div>
              <div className="text-sm text-text-muted mt-2">
                {selectedDefect.defectName} / 수량: {selectedDefect.quantity}개
              </div>
              <div className="mt-2">
                <ComCodeBadge groupCode="DEFECT_STATUS" code={selectedDefect.status} />
              </div>
            </div>

            <div className="text-sm font-medium text-text mb-2">변경할 상태 선택</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('PENDING')}
                disabled={selectedDefect.status === 'PENDING'}
              >
                <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                수리대기
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('REPAIRING')}
                disabled={selectedDefect.status === 'REPAIRING'}
              >
                <Wrench className="w-4 h-4 mr-1 text-blue-500" />
                수리중
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('COMPLETED')}
                disabled={selectedDefect.status === 'COMPLETED'}
              >
                <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                완료
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange('SCRAPPED')}
                disabled={selectedDefect.status === 'SCRAPPED'}
              >
                <Trash2 className="w-4 h-4 mr-1 text-red-500" />
                폐기
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DefectPage;
