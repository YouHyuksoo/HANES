"use client";

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
import { useTranslation } from 'react-i18next';
import { Play, CheckCircle, Search, RefreshCw, Download, Eye, Scissors, Cable } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';
import { ColumnDef } from '@tanstack/react-table';
import { CuttingOrder, CuttingOrderStatus, WireReel } from '@/types/cutting';

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

function OrderPage() {
  const { t } = useTranslation();
  const comCodeStatusOptions = useComCodeOptions('JOB_ORDER_STATUS');
  const statusOptions = useMemo(() => [
    { value: '', label: t('cutting.order.allStatus') },
    ...comCodeStatusOptions,
  ], [t, comCodeStatusOptions]);
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
    { accessorKey: 'orderNo', header: t('cutting.order.orderNo'), size: 140 },
    { accessorKey: 'orderDate', header: t('cutting.order.orderDate'), size: 100 },
    { accessorKey: 'wireName', header: t('cutting.order.wireName'), size: 120 },
    { accessorKey: 'color', header: t('cutting.order.color'), size: 70 },
    { accessorKey: 'cutLength', header: t('cutting.order.cutLength'), size: 100, cell: ({ getValue }) => `${(getValue() as number).toLocaleString()}` },
    { id: 'strip', header: t('cutting.order.strip'), size: 90, cell: ({ row }) => `${row.original.stripLengthA}/${row.original.stripLengthB}` },
    { accessorKey: 'planQty', header: t('cutting.order.plan'), size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'prodQty', header: t('cutting.order.result'), size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'equipCode', header: t('cutting.order.equip'), size: 80 },
    { accessorKey: 'status', header: t('common.status'), size: 80, cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} /> },
    { id: 'actions', header: t('common.actions'), size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(row.original); setIsDetailOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('common.detail')}><Eye className="w-4 h-4 text-text-muted" /></button>
          {row.original.status === 'WAITING' && <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(row.original); setIsReelOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('cutting.order.reelInput')}><Cable className="w-4 h-4 text-blue-500" /></button>}
          {row.original.status === 'WAITING' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(row.original.id, 'RUNNING'); }} className="p-1 hover:bg-surface rounded"><Play className="w-4 h-4 text-green-500" /></button>}
          {row.original.status === 'RUNNING' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(row.original.id, 'DONE'); }} className="p-1 hover:bg-surface rounded"><CheckCircle className="w-4 h-4 text-blue-500" /></button>}
        </div>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Scissors className="w-7 h-7 text-primary" />{t('cutting.order.title')}</h1>
          <p className="text-text-muted mt-1">{t('cutting.order.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('cutting.order.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredOrders} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedOrder(row); setIsDetailOpen(true); }} />
        </CardContent>
      </Card>

      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={t('cutting.order.detailTitle')} size="md">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div><span className="text-sm text-text-muted">{t('cutting.order.orderNo')}</span><p className="font-semibold">{selectedOrder.orderNo}</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.orderDate')}</span><p className="font-semibold">{selectedOrder.orderDate}</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.wireName')}</span><p className="font-semibold">{selectedOrder.wireName}</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.color')}</span><p className="font-semibold">{selectedOrder.color}</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.cutLength')}</span><p className="font-semibold">{selectedOrder.cutLength} mm</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.stripLength')}</span><p className="font-semibold">{selectedOrder.stripLengthA} / {selectedOrder.stripLengthB} mm</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.planResult')}</span><p className="font-semibold">{selectedOrder.planQty.toLocaleString()} / {selectedOrder.prodQty.toLocaleString()}</p></div>
              <div><span className="text-sm text-text-muted">{t('cutting.order.inputReel')}</span><p className="font-semibold">{selectedOrder.reelLotNo || '-'}</p></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsDetailOpen(false)}>{t('common.close')}</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isReelOpen} onClose={() => setIsReelOpen(false)} title={t('cutting.order.reelInput')} size="md">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">{t('cutting.order.selectReel')} ({t('cutting.order.wireName')}: {selectedOrder?.wireName})</p>
          {availableReels.length === 0 ? (
            <div className="p-4 text-center text-text-muted">{t('cutting.order.noReel')}</div>
          ) : (
            <div className="space-y-2">
              {availableReels.map(reel => (
                <div key={reel.id} className="p-3 border border-border rounded-lg hover:bg-surface cursor-pointer" onClick={() => handleReelInput(reel.lotNo)}>
                  <div className="flex justify-between"><span className="font-medium">{reel.lotNo}</span><span className="text-sm text-text-muted">{reel.color}</span></div>
                  <div className="text-sm text-text-muted">{t('cutting.order.remain')}: {reel.remainLength}m / {reel.totalLength}m</div>
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
