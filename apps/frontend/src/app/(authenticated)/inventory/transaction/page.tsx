"use client";

/**
 * @file src/pages/inventory/TransactionPage.tsx
 * @description 수불 이력 페이지 - 입고/출고/이동/취소 내역 조회 및 처리
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedTrans, setSelectedTrans] = useState<TransactionData | null>(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });

  const TRANS_TYPES = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'MAT_IN', label: t('inventory.transaction.matIn') },
    { value: 'MAT_IN_CANCEL', label: t('inventory.transaction.matInCancel') },
    { value: 'MAT_OUT', label: t('inventory.transaction.matOut') },
    { value: 'MAT_OUT_CANCEL', label: t('inventory.transaction.matOutCancel') },
    { value: 'WIP_IN', label: t('inventory.transaction.wipIn') },
    { value: 'WIP_OUT', label: t('inventory.transaction.wipOut') },
    { value: 'FG_IN', label: t('inventory.transaction.fgIn') },
    { value: 'FG_OUT', label: t('inventory.transaction.fgOut') },
    { value: 'SUBCON_IN', label: t('inventory.transaction.subconIn') },
    { value: 'SUBCON_OUT', label: t('inventory.transaction.subconOut') },
    { value: 'TRANSFER', label: t('inventory.transaction.transfer') },
    { value: 'ADJ_PLUS', label: t('inventory.transaction.adjPlus') },
    { value: 'ADJ_MINUS', label: t('inventory.transaction.adjMinus') },
    { value: 'SCRAP', label: t('inventory.transaction.scrap') },
  ], [t]);

  const getTransTypeLabel = (type: string) => {
    return TRANS_TYPES.find(tt => tt.value === type)?.label || type;
  };

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
      const result = res.data?.data ?? res.data;
      setTransactions(Array.isArray(result) ? result : []);
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
      setAlertModal({ open: true, title: t('common.confirm'), message: t('inventory.transaction.alreadyCanceled') });
      return;
    }
    if (trans.transType.includes('CANCEL')) {
      setAlertModal({ open: true, title: t('common.confirm'), message: t('inventory.transaction.cannotCancelCancel') });
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
      setAlertModal({ open: true, title: t('common.confirm'), message: t('inventory.transaction.cancelComplete') });
    } catch (error) {
      console.error('트랜잭션 취소 실패:', error);
      setAlertModal({ open: true, title: t('common.error'), message: t('inventory.transaction.cancelFailed') });
    }
  };

  const columns: ColumnDef<TransactionData>[] = useMemo(() => [
    {
      accessorKey: 'transNo',
      header: t('inventory.transaction.transNo'),
      size: 160,
    },
    {
      accessorKey: 'transType',
      header: t('inventory.transaction.transType'),
      size: 130,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeColor(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: 'transDate',
      header: t('inventory.transaction.transDate'),
      size: 150,
      cell: ({ row }) => new Date(row.original.transDate).toLocaleString(),
    },
    {
      accessorKey: 'fromWarehouse',
      header: t('inventory.transaction.fromWarehouse'),
      size: 100,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseCode || '-',
    },
    {
      accessorKey: 'toWarehouse',
      header: t('inventory.transaction.toWarehouse'),
      size: 100,
      cell: ({ row }) => row.original.toWarehouse?.warehouseCode || '-',
    },
    {
      accessorKey: 'partCode',
      header: t('inventory.transaction.partCode'),
      size: 120,
      cell: ({ row }) => row.original.part.partCode,
    },
    {
      accessorKey: 'partName',
      header: t('inventory.transaction.partName'),
      size: 150,
      cell: ({ row }) => row.original.part.partName,
    },
    {
      accessorKey: 'lotNo',
      header: t('inventory.transaction.lot'),
      size: 140,
      cell: ({ row }) => row.original.lot?.lotNo || '-',
    },
    {
      accessorKey: 'qty',
      header: t('inventory.transaction.qty'),
      size: 100,
      cell: ({ row }) => (
        <span className={row.original.qty < 0 ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold'}>
          {row.original.qty > 0 ? '+' : ''}{row.original.qty.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('inventory.transaction.status'),
      size: 80,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs ${
          row.original.status === 'DONE' ? 'bg-green-100 text-green-800' :
          row.original.status === 'CANCELED' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {row.original.status === 'DONE' ? t('inventory.transaction.statusDone') : row.original.status === 'CANCELED' ? t('inventory.transaction.statusCanceled') : row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'cancelRef',
      header: t('inventory.transaction.original'),
      size: 130,
      cell: ({ row }) => row.original.cancelRef?.transNo || '-',
    },
    {
      accessorKey: 'remark',
      header: t('inventory.transaction.remark'),
      size: 150,
    },
    {
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        row.original.status === 'DONE' && !row.original.transType.includes('CANCEL') && (
          <button onClick={() => handleCancelClick(row.original)} className="p-1 hover:bg-surface rounded" title={t('common.cancel')}>
            <XCircle className="w-4 h-4 text-red-500" />
          </button>
        )
      ),
    },
  ], [t]);

  // 통계 계산
  const todayTransactions = transactions.filter(tr =>
    new Date(tr.transDate).toDateString() === new Date().toDateString()
  );
  const totalIn = transactions.filter(tr => tr.qty > 0 && tr.status === 'DONE').reduce((sum, tr) => sum + tr.qty, 0);
  const totalOut = transactions.filter(tr => tr.qty < 0 && tr.status === 'DONE').reduce((sum, tr) => sum + Math.abs(tr.qty), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />{t('inventory.transaction.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('inventory.transaction.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button variant="secondary" size="sm" onClick={fetchTransactions}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('inventory.transaction.totalTrans')} value={transactions.length} icon={History} color="blue" />
        <StatCard label={t('inventory.transaction.todayProcess')} value={todayTransactions.length} icon={CalendarCheck} color="purple" />
        <StatCard label={t('inventory.transaction.totalIn')} value={`+${totalIn.toLocaleString()}`} icon={ArrowDownToLine} color="green" />
        <StatCard label={t('inventory.transaction.totalOut')} value={`-${totalOut.toLocaleString()}`} icon={ArrowUpFromLine} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('inventory.transaction.searchTransNo')} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={TRANS_TYPES} value={filters.transType} onChange={(v) => setFilters({ ...filters, transType: v })} placeholder={t('inventory.transaction.transType')} />
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
            emptyMessage={t('inventory.transaction.emptyMessage')}
          />
        </CardContent>
      </Card>

      {/* 취소 확인 모달 */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={t('inventory.transaction.cancelTitle')}
      >
        {selectedTrans && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              {t('inventory.transaction.cancelWarning')}
            </p>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('inventory.transaction.transNo')}:</span>
                <span className="font-medium">{selectedTrans.transNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('inventory.transaction.transType')}:</span>
                <span className={`px-2 py-0.5 rounded text-xs ${getTransTypeColor(selectedTrans.transType)}`}>
                  {getTransTypeLabel(selectedTrans.transType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('inventory.transaction.part')}:</span>
                <span>{selectedTrans.part.partName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('inventory.transaction.qty')}:</span>
                <span className={selectedTrans.qty > 0 ? 'text-blue-600' : 'text-red-600'}>
                  {selectedTrans.qty > 0 ? '+' : ''}{selectedTrans.qty.toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('inventory.transaction.cancelReason')}</label>
              <Input
                value={cancelRemark}
                onChange={(e) => setCancelRemark(e.target.value)}
                placeholder={t('inventory.transaction.cancelReasonPlaceholder')}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={handleCancelConfirm}>
                <XCircle className="w-4 h-4 mr-1" />{t('inventory.transaction.cancelProcess')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 알림 모달 */}
      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setAlertModal({ ...alertModal, open: false })}>{t('common.confirm')}</Button>
        </div>
      </Modal>
    </div>
  );
}
