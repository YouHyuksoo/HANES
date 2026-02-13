"use client";

/**
 * @file src/app/(authenticated)/material/hold/page.tsx
 * @description 재고홀드 페이지 - LOT 홀드/해제 관리
 *
 * 초보자 가이드:
 * 1. **홀드**: 품질 이슈 등으로 사용을 일시 중지
 * 2. **해제**: 이슈 해결 후 다시 사용 가능 상태로 변경
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Search, RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface HoldLot {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  currentQty: number;
  unit: string;
  status: string;
  vendor: string;
}

const statusColors: Record<string, string> = {
  HOLD: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  NORMAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const mockData: HoldLot[] = [
  { id: '1', lotNo: 'L20260201-A01', partCode: 'WIRE-001', partName: 'AWG18 적색', currentQty: 5000, unit: 'M', status: 'NORMAL', vendor: '대한전선' },
  { id: '2', lotNo: 'L20260201-B01', partCode: 'TERM-001', partName: '단자 110형', currentQty: 10000, unit: 'EA', status: 'HOLD', vendor: '한국단자' },
  { id: '3', lotNo: 'L20260203-A01', partCode: 'CONN-001', partName: '커넥터 6핀', currentQty: 2000, unit: 'EA', status: 'NORMAL', vendor: '삼성커넥터' },
  { id: '4', lotNo: 'L20260205-B01', partCode: 'CONN-002', partName: '커넥터 12핀', currentQty: 1500, unit: 'EA', status: 'HOLD', vendor: '삼성커넥터' },
];

function HoldPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<HoldLot | null>(null);
  const [actionType, setActionType] = useState<'hold' | 'release'>('hold');

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'HOLD', label: 'HOLD' },
    { value: 'NORMAL', label: 'NORMAL' },
  ], [t]);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchSearch = !searchText || item.lotNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    holdCount: mockData.filter(d => d.status === 'HOLD').length,
    normalCount: mockData.filter(d => d.status === 'NORMAL').length,
  }), []);

  const columns = useMemo<ColumnDef<HoldLot>[]>(() => [
    { accessorKey: 'lotNo', header: 'LOT No.', size: 160 },
    { accessorKey: 'partCode', header: t('material.hold.partCode'), size: 100 },
    { accessorKey: 'partName', header: t('material.hold.partName'), size: 130 },
    { accessorKey: 'currentQty', header: t('material.hold.currentQty'), size: 120, cell: ({ row }) => <span className="font-semibold">{row.original.currentQty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'vendor', header: t('material.hold.vendor'), size: 100 },
    { accessorKey: 'status', header: t('common.status'), size: 80, cell: ({ getValue }) => {
      const s = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[s] || ''}`}>{s}</span>;
    }},
    { id: 'actions', header: '', size: 100, cell: ({ row }) => {
      const isHold = row.original.status === 'HOLD';
      return (
        <Button size="sm" variant={isHold ? 'secondary' : 'primary'} onClick={() => { setSelectedLot(row.original); setActionType(isHold ? 'release' : 'hold'); setIsModalOpen(true); }}>
          {isHold ? <><Unlock className="w-4 h-4 mr-1" />{t('material.hold.release')}</> : <><Lock className="w-4 h-4 mr-1" />{t('material.hold.hold')}</>}
        </Button>
      );
    }},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ShieldAlert className="w-7 h-7 text-primary" />{t('material.hold.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.hold.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('material.hold.stats.total')} value={stats.total} icon={ShieldAlert} color="blue" />
        <StatCard label={t('material.hold.stats.holdCount')} value={stats.holdCount} icon={AlertTriangle} color="red" />
        <StatCard label={t('material.hold.stats.normalCount')} value={stats.normalCount} icon={CheckCircle} color="green" />
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.hold.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-36"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={actionType === 'hold' ? t('material.hold.holdTitle') : t('material.hold.releaseTitle')} size="sm">
        {selectedLot && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">LOT: <span className="font-medium text-text">{selectedLot.lotNo}</span></p>
            <Input label={t('material.hold.reason')} placeholder={t('material.hold.reasonPlaceholder')} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
              <Button>{actionType === 'hold' ? t('material.hold.hold') : t('material.hold.release')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default HoldPage;
