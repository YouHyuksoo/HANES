"use client";

/**
 * @file src/app/(authenticated)/material/po/page.tsx
 * @description PO관리 페이지 - 구매발주 CRUD
 *
 * 초보자 가이드:
 * 1. **PO 목록**: DataGrid로 발주 목록 표시
 * 2. **등록/수정**: Modal로 PO + 품목 입력
 * 3. **상태**: DRAFT -> CONFIRMED -> PARTIAL -> RECEIVED -> CLOSED
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Plus, Edit2, Trash2, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface PurchaseOrder {
  id: string;
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  itemCount: number;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PARTIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  RECEIVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  CLOSED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

const mockData: PurchaseOrder[] = [
  { id: '1', poNo: 'PO-20260201-001', partnerName: '대한전선', orderDate: '2026-02-01', dueDate: '2026-02-15', status: 'CONFIRMED', totalAmount: 5000000, itemCount: 3 },
  { id: '2', poNo: 'PO-20260203-001', partnerName: '한국단자', orderDate: '2026-02-03', dueDate: '2026-02-20', status: 'DRAFT', totalAmount: 3200000, itemCount: 2 },
  { id: '3', poNo: 'PO-20260205-001', partnerName: '삼성커넥터', orderDate: '2026-02-05', dueDate: '2026-02-25', status: 'PARTIAL', totalAmount: 8100000, itemCount: 5 },
  { id: '4', poNo: 'PO-20260210-001', partnerName: '대한전선', orderDate: '2026-02-10', dueDate: '2026-02-28', status: 'RECEIVED', totalAmount: 2500000, itemCount: 1 },
];

function PoPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrder | null>(null);

  const statusOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'DRAFT', label: 'DRAFT' },
    { value: 'CONFIRMED', label: 'CONFIRMED' },
    { value: 'PARTIAL', label: 'PARTIAL' },
    { value: 'RECEIVED', label: 'RECEIVED' },
    { value: 'CLOSED', label: 'CLOSED' },
  ], [t]);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchSearch = !searchText || item.poNo.toLowerCase().includes(searchText.toLowerCase()) || item.partnerName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [searchText, statusFilter]);

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    { accessorKey: 'poNo', header: 'PO No.', size: 160 },
    { accessorKey: 'partnerName', header: t('material.po.partnerName'), size: 120 },
    { accessorKey: 'orderDate', header: t('material.po.orderDate'), size: 110 },
    { accessorKey: 'dueDate', header: t('material.po.dueDate'), size: 110 },
    { accessorKey: 'itemCount', header: t('material.po.itemCount'), size: 80 },
    { accessorKey: 'totalAmount', header: t('material.po.totalAmount'), size: 130, cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}원</span> },
    { accessorKey: 'status', header: t('common.status'), size: 100, cell: ({ getValue }) => {
      const s = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[s] || ''}`}>{s}</span>;
    }},
    { id: 'actions', header: '', size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditingItem(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ShoppingCart className="w-7 h-7 text-primary" />{t('material.po.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.po.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('common.register')}</Button>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.po.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-36"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t('common.edit') : t('common.register')} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="PO No." placeholder="PO-YYYYMMDD-001" fullWidth />
          <Input label={t('material.po.partnerName')} placeholder={t('material.po.partnerName')} fullWidth />
          <Input label={t('material.po.orderDate')} type="date" fullWidth />
          <Input label={t('material.po.dueDate')} type="date" fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default PoPage;
