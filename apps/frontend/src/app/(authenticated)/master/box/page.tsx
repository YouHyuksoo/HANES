"use client";

/**
 * @file src/app/(authenticated)/master/box/page.tsx
 * @description 포장박스관리 페이지 - BoxMaster 조회/관리 (기존 shipping API 활용)
 *
 * 초보자 가이드:
 * 1. **박스 목록**: 박스번호, 품목, 수량, 상태 DataGrid 표시
 * 2. **상태 필터**: OPEN/CLOSED/SHIPPED 필터링
 * 3. **Frontend only**: 기존 shipping box API를 그대로 사용
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, BoxIcon, Eye } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { createPartColumns } from '@/lib/table-utils/column-factories';

interface BoxItem {
  id: string;
  boxNo: string;
  partCode: string;
  partName: string;
  qty: number;
  palletNo?: string;
  status: string;
  closeAt?: string;
}

const mockData: BoxItem[] = [
  { id: '1', boxNo: 'BOX-20250213-001', partCode: 'H-001', partName: '메인하네스 A', qty: 50, palletNo: 'PLT-001', status: 'SHIPPED', closeAt: '2025-02-12 15:30' },
  { id: '2', boxNo: 'BOX-20250213-002', partCode: 'H-001', partName: '메인하네스 A', qty: 50, palletNo: 'PLT-001', status: 'SHIPPED', closeAt: '2025-02-12 16:00' },
  { id: '3', boxNo: 'BOX-20250213-003', partCode: 'H-002', partName: '서브하네스 B', qty: 100, palletNo: 'PLT-002', status: 'CLOSED', closeAt: '2025-02-13 09:30' },
  { id: '4', boxNo: 'BOX-20250213-004', partCode: 'H-002', partName: '서브하네스 B', qty: 80, status: 'OPEN' },
  { id: '5', boxNo: 'BOX-20250213-005', partCode: 'H-003', partName: '도어하네스 C', qty: 30, status: 'OPEN' },
];

const statusColorMap: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CLOSED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  SHIPPED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function BoxPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<BoxItem | null>(null);

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'OPEN', label: t('master.box.statusOpen') }, { value: 'CLOSED', label: t('master.box.statusClosed') }, { value: 'SHIPPED', label: t('master.box.statusShipped') },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.boxNo.toLowerCase().includes(s) || item.partCode.toLowerCase().includes(s) || item.partName.toLowerCase().includes(s);
  }), [searchText, statusFilter]);

  const statusLabels: Record<string, string> = useMemo(() => ({
    OPEN: t('master.box.statusOpen'), CLOSED: t('master.box.statusClosed'), SHIPPED: t('master.box.statusShipped'),
  }), [t]);

  const columns = useMemo<ColumnDef<BoxItem>[]>(() => [
    { accessorKey: 'boxNo', header: t('master.box.boxNo'), size: 180, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    ...createPartColumns<BoxItem>(t),
    { accessorKey: 'qty', header: t('common.quantity'), size: 70, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'palletNo', header: t('master.box.palletNo'), size: 120, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'status', header: t('common.status'), size: 90, cell: ({ getValue }) => {
      const val = getValue() as string;
      const color = statusColorMap[val] || '';
      const label = statusLabels[val] || val;
      return <span className={`px-2 py-1 text-xs rounded-full ${color}`}>{label}</span>;
    }},
    { accessorKey: 'closeAt', header: t('master.box.closeTime'), size: 140, cell: ({ getValue }) => getValue() || '-' },
    { id: 'actions', header: t('common.actions'), size: 60, cell: ({ row }) => (
      <button onClick={() => { setSelectedBox(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
        <Eye className="w-4 h-4 text-primary" />
      </button>
    )},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BoxIcon className="w-7 h-7 text-primary" />{t('master.box.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.box.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('master.box.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t('common.status')} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('master.box.detail')} size="md">
        {selectedBox && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-text-muted">{t('master.box.boxNo')}</span><p className="font-mono font-medium">{selectedBox.boxNo}</p></div>
              <div><span className="text-text-muted">{t('common.status')}</span><p>{statusLabels[selectedBox.status]}</p></div>
              <div><span className="text-text-muted">{t('common.part')}</span><p>{selectedBox.partCode} {selectedBox.partName}</p></div>
              <div><span className="text-text-muted">{t('common.quantity')}</span><p>{selectedBox.qty.toLocaleString()}</p></div>
              <div><span className="text-text-muted">{t('master.box.palletNo')}</span><p>{selectedBox.palletNo || '-'}</p></div>
              <div><span className="text-text-muted">{t('master.box.closeTime')}</span><p>{selectedBox.closeAt || '-'}</p></div>
            </div>
          </div>
        )}
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.close')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default BoxPage;
