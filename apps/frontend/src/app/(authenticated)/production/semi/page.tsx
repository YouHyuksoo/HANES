"use client";

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
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import {
  RefreshCw, Search, Package, ArrowRight, Clock, Play, CheckCircle,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, ComCodeBadge, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';

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

const processLabels: Record<ProcessType, string> = { CUTTING: '절단', CRIMPING: '압착', ASSEMBLY: '조립', INSPECTION: '검사' };

// ========================================
// 메인 컴포넌트
// ========================================
function SemiProductPage() {
  const { t } = useTranslation();

  /** 상태/공정 필터 옵션 (DB 공통코드 기반) */
  const comCodeStatusOptions = useComCodeOptions('SEMI_PRODUCT_STATUS');
  const statusOptions = useMemo(() => [{ value: '', label: t('common.allStatus') }, ...comCodeStatusOptions], [t, comCodeStatusOptions]);
  const comCodeProcessOptions = useComCodeOptions('PROCESS_TYPE');
  const processOptions = useMemo(() => [{ value: '', label: t('production.semi.allProcesses') }, ...comCodeProcessOptions], [t, comCodeProcessOptions]);

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
    { accessorKey: 'semiCode', header: t('production.semi.semiCode'), size: 110 },
    { accessorKey: 'partName', header: t('production.semi.partName'), size: 140 },
    { accessorKey: 'workOrderNo', header: t('production.semi.workOrderNo'), size: 150 },
    { accessorKey: 'qty', header: t('production.semi.qty'), size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'currentProcess', header: t('production.semi.currentProcess'), size: 80, cell: ({ getValue }) => <span className="px-2 py-1 text-xs rounded bg-surface text-text">{processLabels[getValue() as ProcessType]}</span> },
    { accessorKey: 'status', header: t('common.status'), size: 90, cell: ({ getValue }) => <ComCodeBadge groupCode="SEMI_PRODUCT_STATUS" code={getValue() as string} /> },
    { accessorKey: 'lotNo', header: t('production.semi.lotNo'), size: 150, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: 'updatedAt', header: t('production.semi.updatedAt'), size: 130 },
    { id: 'actions', header: t('common.manage'), size: 80, cell: ({ row }) => (
      <button onClick={(e) => { e.stopPropagation(); setSelectedItem(row.original); setIsMoveModalOpen(true); }} className="p-1 hover:bg-surface rounded" title={t('production.semi.moveProcess')} disabled={row.original.status !== 'COMPLETED'}>
        <ArrowRight className={`w-4 h-4 ${row.original.status === 'COMPLETED' ? 'text-primary' : 'text-text-muted opacity-50'}`} />
      </button>
    )},
  ], [t]);

  const handleMove = () => {
    if (selectedItem) console.log(`반제품 ${selectedItem.semiCode} 공정 이동 처리`);
    setIsMoveModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t('production.semi.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.semi.description')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('common.all')} value={`${stats.total}${t('common.count')}`} icon={Package} color="blue" />
        <StatCard label={t('production.semi.waiting')} value={`${stats.waiting}${t('common.count')}`} icon={Clock} color="gray" />
        <StatCard label={t('production.semi.inProgress')} value={`${stats.inProgress}${t('common.count')}`} icon={Play} color="orange" />
        <StatCard label={t('production.semi.completed')} value={`${stats.completed}${t('common.count')}`} icon={CheckCircle} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder={t('production.semi.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <Select options={processOptions} value={processFilter} onChange={setProcessFilter} placeholder={t('production.semi.processCol')} />
            <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} />
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title={t('production.semi.moveProcess')} size="sm">
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">{t('production.semi.selectedSemi')}</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedItem.partName}</div>
              <div className="text-sm text-text-muted mt-1">{selectedItem.semiCode} | {selectedItem.qty}{t('common.ea')}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-text-muted">{t('production.semi.currentProcess')}:</span>
                <span className="px-2 py-1 text-xs rounded bg-surface text-text">{processLabels[selectedItem.currentProcess]}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="px-3 py-2 bg-blue-100 text-blue-700 rounded">{processLabels[selectedItem.currentProcess]}</span>
              <ArrowRight className="w-6 h-6 text-text-muted" />
              <span className="px-3 py-2 bg-green-100 text-green-700 rounded">{t('production.semi.nextProcess')}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsMoveModalOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleMove}><ArrowRight className="w-4 h-4 mr-1" />{t('production.semi.moveAction')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SemiProductPage;
