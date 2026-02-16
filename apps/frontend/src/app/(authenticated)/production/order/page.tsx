"use client";

/**
 * @file src/app/(authenticated)/production/order/page.tsx
 * @description 작업지시 관리 페이지 (절단/압착/조립/검사/포장 통합)
 *
 * 초보자 가이드:
 * 1. **작업지시**: 생산 계획에 따라 현장에 내려보내는 작업 명령
 * 2. **공정유형**: CUT(절단), CRIMP(압착), ASSY(조립), INSP(검사), PACK(포장)
 * 3. **상태 흐름**: WAITING(대기) -> RUNNING(진행) -> DONE(완료)
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw, Download, Calendar, Eye, ClipboardList
} from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useComCodeOptions } from '@/hooks/useComCode';
import { createPartColumns, createQtyColumn } from '@/lib/table-utils';

/** 공정 유형 */
type ProcessType = 'CUT' | 'CRIMP' | 'ASSY' | 'INSP' | 'PACK';

/** 작업지시 상태 타입 */
type JobOrderStatus = 'WAITING' | 'RUNNING' | 'DONE';

/** 작업지시 인터페이스 */
interface JobOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  processType: ProcessType;
  partCode: string;
  partName: string;
  lineName: string;
  processName: string;
  planQty: number;
  prodQty: number;
  status: JobOrderStatus;
  startAt?: string;
  endAt?: string;
  worker?: string;
  remark?: string;
}


// Mock 데이터 (절단/압착 포함)
const mockJobOrders: JobOrder[] = [
  {
    id: '1', orderNo: 'JO-20250126-001', orderDate: '2025-01-26',
    processType: 'CUT', partCode: 'W-001', partName: 'AVS 0.5sq 빨강',
    lineName: 'L1-절단', processName: '전선절단', planQty: 5000, prodQty: 0,
    status: 'WAITING', remark: '긴급 주문'
  },
  {
    id: '2', orderNo: 'JO-20250126-002', orderDate: '2025-01-26',
    processType: 'CRIMP', partCode: 'T-001', partName: '110형 단자 압착',
    lineName: 'L2-압착', processName: '단자압착', planQty: 3000, prodQty: 1500,
    status: 'RUNNING', startAt: '2025-01-26 09:00', worker: '이압착'
  },
  {
    id: '3', orderNo: 'JO-20250126-003', orderDate: '2025-01-26',
    processType: 'ASSY', partCode: 'H-001', partName: '메인 하네스 A',
    lineName: 'L3-조립', processName: '1차 조립', planQty: 500, prodQty: 0,
    status: 'WAITING'
  },
  {
    id: '4', orderNo: 'JO-20250125-001', orderDate: '2025-01-25',
    processType: 'ASSY', partCode: 'H-003', partName: '도어 하네스 C',
    lineName: 'L1-조립', processName: '2차 조립', planQty: 200, prodQty: 200,
    status: 'DONE', startAt: '2025-01-25 08:00', endAt: '2025-01-25 17:00', worker: '박조립'
  },
  {
    id: '5', orderNo: 'JO-20250126-004', orderDate: '2025-01-26',
    processType: 'CUT', partCode: 'W-002', partName: 'AVSS 0.3sq 흰색',
    lineName: 'L1-절단', processName: '전선절단', planQty: 8000, prodQty: 6000,
    status: 'RUNNING', startAt: '2025-01-26 08:30', worker: '김작업'
  },
  {
    id: '6', orderNo: 'JO-20250126-005', orderDate: '2025-01-26',
    processType: 'INSP', partCode: 'H-001', partName: '메인 하네스 A',
    lineName: 'L4-검사', processName: '통전검사', planQty: 200, prodQty: 150,
    status: 'RUNNING', startAt: '2025-01-26 10:00', worker: '최검사'
  },
  {
    id: '7', orderNo: 'JO-20250126-006', orderDate: '2025-01-26',
    processType: 'CRIMP', partCode: 'T-002', partName: '250형 단자 압착',
    lineName: 'L2-압착', processName: '단자압착', planQty: 4000, prodQty: 4000,
    status: 'DONE', startAt: '2025-01-26 08:00', endAt: '2025-01-26 14:00', worker: '오압착'
  },
  {
    id: '8', orderNo: 'JO-20250126-007', orderDate: '2025-01-26',
    processType: 'PACK', partCode: 'H-003', partName: '도어 하네스 C',
    lineName: 'L5-포장', processName: '포장', planQty: 200, prodQty: 100,
    status: 'RUNNING', startAt: '2025-01-26 13:00', worker: '정포장'
  },
];

function JobOrderPage() {
  const { t } = useTranslation();

  const comCodeStatusOptions = useComCodeOptions('JOB_ORDER_STATUS');
  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  /** 공정 유형 필터 옵션 */
  const comCodeProcessOptions = useComCodeOptions('PROCESS_TYPE');
  const processTypeOptions = useMemo(() => [
    { value: '', label: t('production.order.processAll') },
    ...comCodeProcessOptions.filter(o => ['CUT','CRIMP','ASSY','INSP','PACK'].includes(o.value))
  ], [t, comCodeProcessOptions]);

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState('');
  const [processTypeFilter, setProcessTypeFilter] = useState('');
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
      const matchProcessType = !processTypeFilter || order.processType === processTypeFilter;
      const matchSearch = !searchText ||
        order.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        order.partCode.toLowerCase().includes(searchText.toLowerCase()) ||
        order.partName.toLowerCase().includes(searchText.toLowerCase());
      const matchStartDate = !startDate || order.orderDate >= startDate;
      const matchEndDate = !endDate || order.orderDate <= endDate;
      return matchStatus && matchProcessType && matchSearch && matchStartDate && matchEndDate;
    });
  }, [statusFilter, processTypeFilter, searchText, startDate, endDate]);

  const handleOpenDetail = (order: JobOrder) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const getProgress = (order: JobOrder) => {
    if (order.planQty === 0) return 0;
    return Math.round((order.prodQty / order.planQty) * 100);
  };

  /** 컬럼 정의 */
  const columns = useMemo<ColumnDef<JobOrder>[]>(
    () => [
      { accessorKey: 'orderNo', header: t('production.order.orderNo'), size: 150 },
      { accessorKey: 'orderDate', header: t('production.order.orderDate'), size: 100 },
      {
        accessorKey: 'processType',
        header: t('production.order.processType'),
        size: 80,
        cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
      },
      ...createPartColumns<JobOrder>(t),
      { accessorKey: 'lineName', header: t('production.order.line'), size: 100 },
      createQtyColumn<JobOrder>(t, 'planQty'),
      createQtyColumn<JobOrder>(t, 'prodQty'),
      {
        id: 'progress', header: t('production.order.progress'), size: 120,
        cell: ({ row }) => {
          const progress = getProgress(row.original);
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-text-muted w-10">{progress}%</span>
            </div>
          );
        }
      },
      {
        accessorKey: 'status', header: t('common.status'), size: 80,
        cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as JobOrderStatus} />,
      },
      {
        id: 'actions', header: t('common.manage'), size: 60,
        cell: ({ row }) => (
          <button onClick={(e) => { e.stopPropagation(); handleOpenDetail(row.original); }} className="p-1 hover:bg-surface rounded" title={t('common.detail')}>
            <Eye className="w-4 h-4 text-text-muted" />
          </button>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t('production.order.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.order.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
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
                placeholder={t('production.order.searchPlaceholder')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-32">
              <Select
                options={processTypeOptions}
                value={processTypeFilter}
                onChange={setProcessTypeFilter}
                placeholder={t('production.order.processType')}
                fullWidth
              />
            </div>
            <div className="w-36">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder={t('common.status')}
                fullWidth
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>

          <DataGrid data={filteredOrders} columns={columns} pageSize={10} onRowClick={handleOpenDetail} />
        </CardContent>
      </Card>

      {/* 작업지시 상세 모달 */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={t('production.order.detailTitle')} size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div>
                <span className="text-sm text-text-muted">{t('production.order.orderNo')}</span>
                <p className="font-semibold text-text">{selectedOrder.orderNo}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.processType')}</span>
                <p><ComCodeBadge groupCode="PROCESS_TYPE" code={selectedOrder.processType} /></p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.orderDate')}</span>
                <p className="font-semibold text-text">{selectedOrder.orderDate}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.partName')}</span>
                <p className="font-semibold text-text">{selectedOrder.partName}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.line')}</span>
                <p className="font-semibold text-text">{selectedOrder.lineName}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.process')}</span>
                <p className="font-semibold text-text">{selectedOrder.processName}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <span className="text-sm text-text-muted">{t('production.order.planQty')}</span>
                <p className="text-lg font-bold leading-tight text-blue-600 dark:text-blue-400">{selectedOrder.planQty.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <span className="text-sm text-text-muted">{t('production.order.prodQty')}</span>
                <p className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">{selectedOrder.prodQty.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                <span className="text-sm text-text-muted">{t('production.order.progress')}</span>
                <p className="text-lg font-bold leading-tight text-purple-600 dark:text-purple-400">{getProgress(selectedOrder)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div>
                <span className="text-sm text-text-muted">{t('common.status')}</span>
                <p><ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedOrder.status} /></p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.worker')}</span>
                <p className="font-semibold text-text">{selectedOrder.worker || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.startTime')}</span>
                <p className="font-semibold text-text">{selectedOrder.startAt || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-text-muted">{t('production.order.endTime')}</span>
                <p className="font-semibold text-text">{selectedOrder.endAt || '-'}</p>
              </div>
              {selectedOrder.remark && (
                <div className="col-span-2">
                  <span className="text-sm text-text-muted">{t('common.remark')}</span>
                  <p className="font-semibold text-text">{selectedOrder.remark}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>{t('common.close')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default JobOrderPage;
