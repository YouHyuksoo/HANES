/**
 * @file src/pages/production/JobOrderPage.tsx
 * @description 작업지시 관리 페이지
 *
 * 초보자 가이드:
 * 1. **작업지시**: 생산 계획에 따라 현장에 내려보내는 작업 명령
 * 2. **상태 흐름**: WAITING(대기) -> RUNNING(진행) -> DONE(완료)
 * 3. **필터링**: 상태별, 날짜범위별 조회 가능
 *
 * 사용 방법:
 * - 목록에서 작업지시 선택 시 상세 모달 오픈
 * - 상태 변경 버튼으로 작업 진행 상태 관리
 */
import { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  CheckCircle,
  Search,
  RefreshCw,
  Download,
  Calendar,
  Eye,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useComCodeOptions } from '@/hooks/useComCode';

/** 작업지시 상태 타입 */
type JobOrderStatus = 'WAITING' | 'RUNNING' | 'DONE';

/** 작업지시 인터페이스 */
interface JobOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  partCode: string;
  partName: string;
  lineName: string;
  processName: string;
  planQty: number;
  prodQty: number;
  status: JobOrderStatus;
  startTime?: string;
  endTime?: string;
  worker?: string;
  remark?: string;
}

// Mock 데이터
const mockJobOrders: JobOrder[] = [
  {
    id: '1',
    orderNo: 'JO-20250126-001',
    orderDate: '2025-01-26',
    partCode: 'H-001',
    partName: '메인 하네스 A',
    lineName: 'L1-조립',
    processName: '1차 조립',
    planQty: 500,
    prodQty: 0,
    status: 'WAITING',
    remark: '긴급 주문'
  },
  {
    id: '2',
    orderNo: 'JO-20250126-002',
    orderDate: '2025-01-26',
    partCode: 'H-002',
    partName: '서브 하네스 B',
    lineName: 'L2-조립',
    processName: '2차 조립',
    planQty: 300,
    prodQty: 150,
    status: 'RUNNING',
    startTime: '2025-01-26 09:00',
    worker: '김작업'
  },
  {
    id: '3',
    orderNo: 'JO-20250125-001',
    orderDate: '2025-01-25',
    partCode: 'H-003',
    partName: '도어 하네스 C',
    lineName: 'L1-조립',
    processName: '1차 조립',
    planQty: 200,
    prodQty: 200,
    status: 'DONE',
    startTime: '2025-01-25 08:00',
    endTime: '2025-01-25 17:00',
    worker: '이작업'
  },
  {
    id: '4',
    orderNo: 'JO-20250126-003',
    orderDate: '2025-01-26',
    partCode: 'H-004',
    partName: '엔진룸 하네스 D',
    lineName: 'L3-조립',
    processName: '특수 조립',
    planQty: 100,
    prodQty: 0,
    status: 'WAITING'
  },
  {
    id: '5',
    orderNo: 'JO-20250126-004',
    orderDate: '2025-01-26',
    partCode: 'H-005',
    partName: '트렁크 하네스 E',
    lineName: 'L2-조립',
    processName: '2차 조립',
    planQty: 400,
    prodQty: 280,
    status: 'RUNNING',
    startTime: '2025-01-26 08:30',
    worker: '박작업'
  },
];

function JobOrderPage() {
  /** 상태 필터 옵션 (DB 공통코드 기반) */
  const comCodeStatusOptions = useComCodeOptions('JOB_ORDER_STATUS');
  const statusOptions = [{ value: '', label: '전체 상태' }, ...comCodeStatusOptions];

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  // 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<JobOrder | null>(null);

  /** 필터링된 작업지시 목록 */
  const filteredOrders = useMemo(() => {
    return mockJobOrders.filter((order) => {
      const matchStatus = !statusFilter || order.status === statusFilter;
      const matchSearch = !searchText ||
        order.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        order.partCode.toLowerCase().includes(searchText.toLowerCase()) ||
        order.partName.toLowerCase().includes(searchText.toLowerCase());
      const matchStartDate = !startDate || order.orderDate >= startDate;
      const matchEndDate = !endDate || order.orderDate <= endDate;
      return matchStatus && matchSearch && matchStartDate && matchEndDate;
    });
  }, [statusFilter, searchText, startDate, endDate]);

  /** 상세 모달 열기 */
  const handleOpenDetail = (order: JobOrder) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  /** 상태 변경 핸들러 */
  const handleStatusChange = (orderId: string, newStatus: JobOrderStatus) => {
    console.log(`작업지시 ${orderId} 상태 변경: ${newStatus}`);
    // 실제로는 API 호출 후 목록 갱신
  };

  /** 진행률 계산 */
  const getProgress = (order: JobOrder) => {
    if (order.planQty === 0) return 0;
    return Math.round((order.prodQty / order.planQty) * 100);
  };

  /** 컬럼 정의 */
  const columns = useMemo<ColumnDef<JobOrder>[]>(
    () => [
      {
        accessorKey: 'orderNo',
        header: '작업지시번호',
        size: 150
      },
      {
        accessorKey: 'orderDate',
        header: '지시일자',
        size: 100
      },
      {
        accessorKey: 'partCode',
        header: '품목코드',
        size: 100
      },
      {
        accessorKey: 'partName',
        header: '품목명',
        size: 150
      },
      {
        accessorKey: 'lineName',
        header: '라인',
        size: 100
      },
      {
        accessorKey: 'planQty',
        header: '계획수량',
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString()
      },
      {
        accessorKey: 'prodQty',
        header: '실적수량',
        size: 80,
        cell: ({ getValue }) => (getValue() as number).toLocaleString()
      },
      {
        id: 'progress',
        header: '진행률',
        size: 120,
        cell: ({ row }) => {
          const progress = getProgress(row.original);
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-text-muted w-10">{progress}%</span>
            </div>
          );
        }
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 80,
        cell: ({ getValue }) => {
          const status = getValue() as JobOrderStatus;
          return <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={status} />;
        },
      },
      {
        id: 'actions',
        header: '관리',
        size: 120,
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenDetail(order); }}
                className="p-1 hover:bg-surface rounded"
                title="상세보기"
              >
                <Eye className="w-4 h-4 text-text-muted" />
              </button>
              {order.status === 'WAITING' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'RUNNING'); }}
                  className="p-1 hover:bg-surface rounded"
                  title="작업시작"
                >
                  <Play className="w-4 h-4 text-green-500" />
                </button>
              )}
              {order.status === 'RUNNING' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'WAITING'); }}
                    className="p-1 hover:bg-surface rounded"
                    title="일시정지"
                  >
                    <Pause className="w-4 h-4 text-yellow-500" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'DONE'); }}
                    className="p-1 hover:bg-surface rounded"
                    title="작업완료"
                  >
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                  </button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            작업지시 관리
          </h1>
          <p className="text-text-muted mt-1">생산 작업지시를 조회하고 상태를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> 엑셀 다운로드
          </Button>
        </div>
      </div>

      {/* 메인 카드 */}
      <Card>
        <CardContent>
          {/* 검색 필터 */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="작업지시번호, 품목코드, 품목명 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-36">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="상태"
                fullWidth
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
              <span className="text-text-muted">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* 데이터 그리드 */}
          <DataGrid
            data={filteredOrders}
            columns={columns}
            pageSize={10}
            onRowClick={handleOpenDetail}
          />
        </CardContent>
      </Card>

      {/* 작업지시 상세 모달 */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="작업지시 상세"
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div>
                <span className="text-sm text-text-muted">작업지시번호</span>
                <p className="font-semibold text-text">{selectedOrder.orderNo}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">지시일자</span>
                <p className="font-semibold text-text">{selectedOrder.orderDate}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">품목코드</span>
                <p className="font-semibold text-text">{selectedOrder.partCode}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">품목명</span>
                <p className="font-semibold text-text">{selectedOrder.partName}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">라인</span>
                <p className="font-semibold text-text">{selectedOrder.lineName}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">공정</span>
                <p className="font-semibold text-text">{selectedOrder.processName}</p>
              </div>
            </div>

            {/* 수량 정보 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <span className="text-sm text-text-muted">계획수량</span>
                <p className="text-lg font-bold leading-tight text-blue-600 dark:text-blue-400">
                  {selectedOrder.planQty.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <span className="text-sm text-text-muted">실적수량</span>
                <p className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">
                  {selectedOrder.prodQty.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                <span className="text-sm text-text-muted">진행률</span>
                <p className="text-lg font-bold leading-tight text-purple-600 dark:text-purple-400">
                  {getProgress(selectedOrder)}%
                </p>
              </div>
            </div>

            {/* 작업 정보 */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div>
                <span className="text-sm text-text-muted">상태</span>
                <p>
                  <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedOrder.status} />
                </p>
              </div>
              <div>
                <span className="text-sm text-text-muted">작업자</span>
                <p className="font-semibold text-text">{selectedOrder.worker || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">시작시간</span>
                <p className="font-semibold text-text">{selectedOrder.startTime || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">종료시간</span>
                <p className="font-semibold text-text">{selectedOrder.endTime || '-'}</p>
              </div>
              {selectedOrder.remark && (
                <div className="col-span-2">
                  <span className="text-sm text-text-muted">비고</span>
                  <p className="font-semibold text-text">{selectedOrder.remark}</p>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
                닫기
              </Button>
              {selectedOrder.status === 'WAITING' && (
                <Button onClick={() => handleStatusChange(selectedOrder.id, 'RUNNING')}>
                  <Play className="w-4 h-4 mr-1" /> 작업 시작
                </Button>
              )}
              {selectedOrder.status === 'RUNNING' && (
                <>
                  <Button variant="secondary" onClick={() => handleStatusChange(selectedOrder.id, 'WAITING')}>
                    <Pause className="w-4 h-4 mr-1" /> 일시 정지
                  </Button>
                  <Button onClick={() => handleStatusChange(selectedOrder.id, 'DONE')}>
                    <CheckCircle className="w-4 h-4 mr-1" /> 작업 완료
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default JobOrderPage;
