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
  Filter,
  AlertTriangle,
  Wrench,
  CheckCircle,
  Trash2,
  Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';

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

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '수리대기' },
  { value: 'REPAIRING', label: '수리중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'SCRAPPED', label: '폐기' },
];

// ========================================
// 상태 배지 컴포넌트
// ========================================
function StatusBadge({ status }: { status: DefectStatus }) {
  const config = {
    PENDING: {
      icon: AlertTriangle,
      label: '수리대기',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    },
    REPAIRING: {
      icon: Wrench,
      label: '수리중',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    },
    COMPLETED: {
      icon: CheckCircle,
      label: '완료',
      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    },
    SCRAPPED: {
      icon: Trash2,
      label: '폐기',
      className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ========================================
// 메인 컴포넌트
// ========================================
function DefectPage() {
  // 상태 관리
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
      return true;
    });
  }, [defectType, statusFilter]);

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
        cell: ({ getValue }) => <StatusBadge status={getValue() as DefectStatus} />,
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedDefect(row.original);
              setIsStatusModalOpen(true);
            }}
          >
            상태변경
          </Button>
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
          <h1 className="text-2xl font-bold text-text">불량관리</h1>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <CardContent>
            <div className="text-text-muted text-sm">전체 건수</div>
            <div className="text-2xl font-bold text-text mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="text-text-muted text-sm">수리대기</div>
            <div className="text-2xl font-bold text-yellow-500 mt-1">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="text-text-muted text-sm">수리중</div>
            <div className="text-2xl font-bold text-blue-500 mt-1">{stats.repairing}</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="text-text-muted text-sm">완료</div>
            <div className="text-2xl font-bold text-green-500 mt-1">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="text-text-muted text-sm">총 불량수량</div>
            <div className="text-2xl font-bold text-red-500 mt-1">{stats.totalQty}</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 영역 */}
      <Card padding="sm">
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text">필터</span>
            </div>
            <Input
              type="date"
              placeholder="시작일"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
            <span className="text-text-muted">~</span>
            <Input
              type="date"
              placeholder="종료일"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Select
              options={defectTypes}
              value={defectType}
              onChange={setDefectType}
              placeholder="불량유형"
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="상태"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setDefectType('');
                setStatusFilter('');
              }}
            >
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 그리드 */}
      <Card>
        <CardHeader
          title="불량 목록"
          subtitle={`총 ${filteredDefects.length}건`}
        />
        <CardContent>
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
                <StatusBadge status={selectedDefect.status} />
              </div>
            </div>

            <div className="text-sm font-medium text-text mb-2">변경할 상태 선택</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleStatusChange('PENDING')}
                disabled={selectedDefect.status === 'PENDING'}
              >
                <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                수리대기
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusChange('REPAIRING')}
                disabled={selectedDefect.status === 'REPAIRING'}
              >
                <Wrench className="w-4 h-4 mr-1 text-blue-500" />
                수리중
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusChange('COMPLETED')}
                disabled={selectedDefect.status === 'COMPLETED'}
              >
                <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                완료
              </Button>
              <Button
                variant="outline"
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
