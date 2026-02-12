"use client";

/**
 * @file src/pages/crimping/OrderPage.tsx
 * @description 압착 작업지시 페이지 - 터미널 압착 작업 관리
 *
 * 초보자 가이드:
 * 1. **압착 작업지시**: 어떤 전선에 어떤 터미널을 몇 개 압착할지 지시
 * 2. **금형 선택**: 터미널에 맞는 금형(Applicator) 장착 필수
 * 3. **C/H 기준**: 압착높이 기준값과 허용공차 확인
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, CheckCircle, Search, RefreshCw, Download, Eye, Hammer, Settings2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';
import { ColumnDef } from '@tanstack/react-table';
import { CrimpingOrder, CrimpingOrderStatus, Mold, moldStatusStyles } from '@/types/crimping';

// Mock 데이터
const mockOrders: CrimpingOrder[] = [
  { id: '1', orderNo: 'CP-20250126-001', orderDate: '2025-01-26', wireCode: 'W-001', wireName: 'AVS 0.5sq RED', terminalCode: 'T-001', terminalName: '110형 단자', moldCode: 'MD-001', moldName: '110형 금형 A', crimpHeightStd: 1.85, crimpHeightTol: 0.05, planQty: 1000, prodQty: 0, equipCode: 'CRM-001', status: 'WAITING' },
  { id: '2', orderNo: 'CP-20250126-002', orderDate: '2025-01-26', wireCode: 'W-002', wireName: 'AVS 0.85sq BLACK', terminalCode: 'T-002', terminalName: '250형 단자', moldCode: 'MD-002', moldName: '250형 금형 B', crimpHeightStd: 2.10, crimpHeightTol: 0.08, planQty: 800, prodQty: 520, equipCode: 'CRM-001', status: 'RUNNING' },
  { id: '3', orderNo: 'CP-20250125-001', orderDate: '2025-01-25', wireCode: 'W-003', wireName: 'AVS 2.0sq YELLOW', terminalCode: 'T-003', terminalName: '312형 단자', moldCode: 'MD-003', moldName: '312형 금형 C', crimpHeightStd: 2.50, crimpHeightTol: 0.10, planQty: 500, prodQty: 500, equipCode: 'CRM-002', status: 'DONE' },
  { id: '4', orderNo: 'CP-20250126-003', orderDate: '2025-01-26', wireCode: 'W-001', wireName: 'AVS 0.5sq WHITE', terminalCode: 'T-001', terminalName: '110형 단자', moldCode: 'MD-001', moldName: '110형 금형 A', crimpHeightStd: 1.85, crimpHeightTol: 0.05, planQty: 1500, prodQty: 0, equipCode: 'CRM-002', status: 'WAITING' },
];

const mockMolds: Mold[] = [
  { id: '1', moldCode: 'MD-001', moldName: '110형 금형 A', terminalCode: 'T-001', terminalName: '110형 단자', currentShots: 45000, expectedLife: 100000, status: 'OK', lastMaintDate: '2025-01-10', nextMaintDate: '2025-02-10', location: 'CRM-001' },
  { id: '2', moldCode: 'MD-002', moldName: '250형 금형 B', terminalCode: 'T-002', terminalName: '250형 단자', currentShots: 82000, expectedLife: 100000, status: 'WARNING', lastMaintDate: '2024-12-20', nextMaintDate: '2025-01-20', location: 'CRM-001' },
  { id: '3', moldCode: 'MD-003', moldName: '312형 금형 C', terminalCode: 'T-003', terminalName: '312형 단자', currentShots: 95000, expectedLife: 100000, status: 'REPLACE', lastMaintDate: '2024-11-15', nextMaintDate: '2024-12-15', location: '창고' },
];

function OrderPage() {
  const { t } = useTranslation();
  const comCodeStatusOptions = useComCodeOptions('JOB_ORDER_STATUS');
  const statusOptions = useMemo(() => [
    { value: '', label: t('crimping.order.allStatus') },
    ...comCodeStatusOptions,
  ], [t, comCodeStatusOptions]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMoldOpen, setIsMoldOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CrimpingOrder | null>(null);

  const filteredOrders = useMemo(() => {
    return mockOrders.filter((o) => {
      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchSearch = !searchText ||
        o.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        o.terminalName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const availableMolds = useMemo(() => {
    if (!selectedOrder) return [];
    return mockMolds.filter(m => m.terminalCode === selectedOrder.terminalCode && m.status !== 'MAINT');
  }, [selectedOrder]);

  const handleStatusChange = (id: string, status: CrimpingOrderStatus) => {
    console.log(`압착지시 ${id} 상태 변경: ${status}`);
  };

  const handleMoldSelect = (moldCode: string) => {
    console.log(`금형 선택: ${moldCode} -> ${selectedOrder?.orderNo}`);
    setIsMoldOpen(false);
  };

  const columns = useMemo<ColumnDef<CrimpingOrder>[]>(() => [
    { accessorKey: 'orderNo', header: t('crimping.order.orderNo'), size: 140 },
    { accessorKey: 'orderDate', header: t('crimping.order.orderDate'), size: 100 },
    { accessorKey: 'wireName', header: t('crimping.order.wire'), size: 130 },
    { accessorKey: 'terminalName', header: t('crimping.order.terminal'), size: 100 },
    { accessorKey: 'moldName', header: t('crimping.order.mold'), size: 110 },
    { id: 'ch', header: t('crimping.order.chStandard'), size: 100, cell: ({ row }) => `${row.original.crimpHeightStd} ±${row.original.crimpHeightTol}` },
    { accessorKey: 'planQty', header: t('crimping.order.plan'), size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'prodQty', header: t('crimping.order.result'), size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'equipCode', header: t('crimping.order.equip'), size: 80 },
    { accessorKey: 'status', header: t('common.status'), size: 80, cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} /> },
    { id: 'actions', header: t('common.actions'), size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(row.original); setIsDetailOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('common.detail')}><Eye className="w-4 h-4 text-text-muted" /></button>
          {row.original.status === 'WAITING' && <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(row.original); setIsMoldOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('crimping.order.moldSelect')}><Settings2 className="w-4 h-4 text-blue-500" /></button>}
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Hammer className="w-7 h-7 text-primary" />{t('crimping.order.title')}</h1>
          <p className="text-text-muted mt-1">{t('crimping.order.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('crimping.order.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredOrders} columns={columns} pageSize={10} onRowClick={(row) => { setSelectedOrder(row); setIsDetailOpen(true); }} />
        </CardContent>
      </Card>

      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={t('crimping.order.detailTitle')} size="md">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
              <div><span className="text-sm text-text-muted">{t('crimping.order.orderNo')}</span><p className="font-semibold">{selectedOrder.orderNo}</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.orderDate')}</span><p className="font-semibold">{selectedOrder.orderDate}</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.wire')}</span><p className="font-semibold">{selectedOrder.wireName}</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.terminal')}</span><p className="font-semibold">{selectedOrder.terminalName}</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.mold')}</span><p className="font-semibold">{selectedOrder.moldName}</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.chStandard')}</span><p className="font-semibold">{selectedOrder.crimpHeightStd} ±{selectedOrder.crimpHeightTol} mm</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.planResult')}</span><p className="font-semibold">{selectedOrder.planQty.toLocaleString()} / {selectedOrder.prodQty.toLocaleString()}</p></div>
              <div><span className="text-sm text-text-muted">{t('crimping.order.equip')}</span><p className="font-semibold">{selectedOrder.equipCode}</p></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsDetailOpen(false)}>{t('common.close')}</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isMoldOpen} onClose={() => setIsMoldOpen(false)} title={t('crimping.order.moldSelect')} size="md">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">{t('crimping.order.terminal')}: {selectedOrder?.terminalName}</p>
          {availableMolds.length === 0 ? (
            <div className="p-4 text-center text-text-muted">{t('crimping.order.noMold')}</div>
          ) : (
            <div className="space-y-2">
              {availableMolds.map(mold => {
                const lifePercent = Math.round((mold.currentShots / mold.expectedLife) * 100);
                return (
                  <div key={mold.id} className={`p-3 border border-border rounded-lg hover:shadow-md cursor-pointer ${moldStatusStyles[mold.status].bgColor}`} onClick={() => handleMoldSelect(mold.moldCode)}>
                    <div className="flex justify-between items-start">
                      <div><span className="font-medium">{mold.moldCode}</span><p className="text-sm text-text-muted">{mold.moldName}</p></div>
                      <span className={`px-2 py-1 text-xs rounded-full ${moldStatusStyles[mold.status].color}`}>{moldStatusStyles[mold.status].label}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${lifePercent >= 90 ? 'bg-red-500' : lifePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'} rounded-full`} style={{ width: `${lifePercent}%` }} />
                      </div>
                      <span className="text-xs text-text-muted">{lifePercent}%</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">{t('crimping.mold.location')}: {mold.location} | {t('crimping.mold.currentShots')}: {mold.currentShots.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default OrderPage;
