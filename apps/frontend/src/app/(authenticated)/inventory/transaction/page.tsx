"use client";

/**
 * @file src/pages/inventory/TransactionPage.tsx
 * @description 수불 이력 페이지 - 입고/출고/이동/취소 내역 조회 및 처리
 */
import { useState, useEffect, useMemo } from 'react';
import { History, RefreshCw, Search, Download, XCircle, ArrowDownToLine, ArrowUpFromLine, CalendarCheck, Calendar } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/services/api';

interface TransactionData {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  partId: string;
  lotId?: string;
  qty: number;
  unitPrice?: number;
  totalAmount?: number;
  refType?: string;
  refId?: string;
  cancelRefId?: string;
  status: string;
  workerId?: string;
  remark?: string;
  fromWarehouse?: { warehouseCode: string; warehouseName: string };
  toWarehouse?: { warehouseCode: string; warehouseName: string };
  part: { partCode: string; partName: string };
  lot?: { lotNo: string };
  cancelRef?: { transNo: string };
}

const TRANS_TYPES = [
  { value: '', label: '전체' },
  { value: 'MAT_IN', label: '원자재 입고' },
  { value: 'MAT_IN_CANCEL', label: '원자재 입고취소' },
  { value: 'MAT_OUT', label: '원자재 출고' },
  { value: 'MAT_OUT_CANCEL', label: '원자재 출고취소' },
  { value: 'WIP_IN', label: '반제품 입고' },
  { value: 'WIP_OUT', label: '반제품 출고' },
  { value: 'FG_IN', label: '완제품 입고' },
  { value: 'FG_OUT', label: '완제품 출고' },
  { value: 'SUBCON_IN', label: '외주 입고' },
  { value: 'SUBCON_OUT', label: '외주 지급' },
  { value: 'TRANSFER', label: '창고이동' },
  { value: 'ADJ_PLUS', label: '재고조정(+)' },
  { value: 'ADJ_MINUS', label: '재고조정(-)' },
  { value: 'SCRAP', label: '폐기' },
];

const getTransTypeLabel = (type: string) => {
  return TRANS_TYPES.find(t => t.value === type)?.label || type;
};

const getTransTypeColor = (type: string) => {
  const isCancel = type.includes('CANCEL');
  const isIn = type.includes('IN') || type.includes('PLUS');
  const isOut = type.includes('OUT') || type.includes('MINUS') || type.includes('SCRAP');

  if (isCancel) return 'bg-red-100 text-red-800';
  if (isIn) return 'bg-blue-100 text-blue-800';
  if (isOut) return 'bg-orange-100 text-orange-800';
  if (type === 'TRANSFER') return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-800';
};

export default function TransactionPage() {
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedTrans, setSelectedTrans] = useState<TransactionData | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [alertModal, setAlertModal] = useState({ open: false, title: '알림', message: '' });

  // 필터
  const [filters, setFilters] = useState({
    transType: '',
    dateFrom: '',
    dateTo: '',
  });

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.transType) params.append('transType', filters.transType);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      params.append('limit', '200');

      const res = await api.get(`/inventory/transactions?${params.toString()}`);
      setTransactions(res.data);
    } catch (error) {
      console.error('수불 이력 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleCancelClick = (trans: TransactionData) => {
    if (trans.status === 'CANCELED') {
      setAlertModal({ open: true, title: '알림', message: '이미 취소된 트랜잭션입니다.' });
      return;
    }
    if (trans.transType.includes('CANCEL')) {
      setAlertModal({ open: true, title: '알림', message: '취소 트랜잭션은 다시 취소할 수 없습니다.' });
      return;
    }
    setSelectedTrans(trans);
    setCancelRemark('');
    setCancelModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedTrans) return;
    try {
      await api.post('/inventory/cancel', {
        transactionId: selectedTrans.id,
        remark: cancelRemark,
      });
      setCancelModalOpen(false);
      fetchTransactions();
      setAlertModal({ open: true, title: '완료', message: '취소 처리가 완료되었습니다.' });
    } catch (error) {
      console.error('트랜잭션 취소 실패:', error);
      setAlertModal({ open: true, title: '오류', message: '취소 처리 중 오류가 발생했습니다.' });
    }
  };

  const columns: ColumnDef<TransactionData>[] = useMemo(() => [
    {
      accessorKey: 'transNo',
      header: '트랜잭션번호',
      size: 160,
    },
    {
      accessorKey: 'transType',
      header: '유형',
      size: 130,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeColor(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: 'transDate',
      header: '일시',
      size: 150,
      cell: ({ row }) => new Date(row.original.transDate).toLocaleString(),
    },
    {
      accessorKey: 'fromWarehouse',
      header: '출고창고',
      size: 100,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseCode || '-',
    },
    {
      accessorKey: 'toWarehouse',
      header: '입고창고',
      size: 100,
      cell: ({ row }) => row.original.toWarehouse?.warehouseCode || '-',
    },
    {
      accessorKey: 'partCode',
      header: '품목코드',
      size: 120,
      cell: ({ row }) => row.original.part.partCode,
    },
    {
      accessorKey: 'partName',
      header: '품목명',
      size: 150,
      cell: ({ row }) => row.original.part.partName,
    },
    {
      accessorKey: 'lotNo',
      header: 'LOT',
      size: 140,
      cell: ({ row }) => row.original.lot?.lotNo || '-',
    },
    {
      accessorKey: 'qty',
      header: '수량',
      size: 100,
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold'}>
          {row.original.qty > 0 ? '+' : ''}{row.original.qty.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: '상태',
      size: 80,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs ${
          row.original.status === 'DONE' ? 'bg-green-100 text-green-800' :
          row.original.status === 'CANCELED' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {row.original.status === 'DONE' ? '완료' : row.original.status === 'CANCELED' ? '취소' : row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'cancelRef',
      header: '원본',
      size: 130,
      cell: ({ row }) => row.original.cancelRef?.transNo || '-',
    },
    {
      accessorKey: 'remark',
      header: '비고',
      size: 150,
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        row.original.status === 'DONE' && !row.original.transType.includes('CANCEL') && (
          <button onClick={() => handleCancelClick(row.original)} className="p-1 hover:bg-surface rounded" title="취소">
            <XCircle className="w-4 h-4 text-red-500" />
          </button>
        )
      ),
    },
  ], []);

  // 통계 계산
  const todayTransactions = transactions.filter(t =>
    new Date(t.transDate).toDateString() === new Date().toDateString()
  );
  const totalIn = transactions.filter(t => t.qty > 0 && t.status === 'DONE').reduce((sum, t) => sum + t.qty, 0);
  const totalOut = transactions.filter(t => t.qty < 0 && t.status === 'DONE').reduce((sum, t) => sum + Math.abs(t.qty), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />수불 이력
          </h1>
          <p className="text-text-muted mt-1">입고/출고/이동/취소 트랜잭션 이력을 조회하고 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀</Button>
          <Button variant="secondary" size="sm" onClick={fetchTransactions}><RefreshCw className="w-4 h-4 mr-1" />새로고침</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="총 트랜잭션" value={transactions.length} icon={History} color="blue" />
        <StatCard label="오늘 처리" value={todayTransactions.length} icon={CalendarCheck} color="purple" />
        <StatCard label="총 입고" value={`+${totalIn.toLocaleString()}`} icon={ArrowDownToLine} color="green" />
        <StatCard label="총 출고" value={`-${totalOut.toLocaleString()}`} icon={ArrowUpFromLine} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="트랜잭션번호 검색..." leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={TRANS_TYPES} value={filters.transType} onChange={(v) => setFilters({ ...filters, transType: v })} placeholder="유형" />
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="w-36" />
            </div>
            <Button variant="secondary" onClick={fetchTransactions}><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid
            data={transactions}
            columns={columns}
            isLoading={loading}
            pageSize={10}
            emptyMessage="수불 이력이 없습니다."
          />
        </CardContent>
      </Card>

      {/* 취소 확인 모달 */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="트랜잭션 취소"
      >
        {selectedTrans && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              이 작업은 되돌릴 수 없습니다. 취소 이력이 생성되고 재고가 복구됩니다.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">트랜잭션 번호:</span>
                <span className="font-medium">{selectedTrans.transNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">유형:</span>
                <span className={`px-2 py-0.5 rounded text-xs ${getTransTypeColor(selectedTrans.transType)}`}>
                  {getTransTypeLabel(selectedTrans.transType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">품목:</span>
                <span>{selectedTrans.part.partName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">수량:</span>
                <span className={selectedTrans.qty > 0 ? 'text-blue-600' : 'text-red-600'}>
                  {selectedTrans.qty > 0 ? '+' : ''}{selectedTrans.qty.toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">취소 사유</label>
              <Input
                value={cancelRemark}
                onChange={(e) => setCancelRemark(e.target.value)}
                placeholder="취소 사유를 입력하세요"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
                닫기
              </Button>
              <Button onClick={handleCancelConfirm}>
                <XCircle className="w-4 h-4 mr-1" />취소 처리
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 알림 모달 */}
      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setAlertModal({ ...alertModal, open: false })}>확인</Button>
        </div>
      </Modal>
    </div>
  );
}
