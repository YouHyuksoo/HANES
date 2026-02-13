"use client";

/**
 * @file src/app/(authenticated)/master/model-suffix/page.tsx
 * @description 모델접미사 관리 페이지 - 모델별 접미사 코드 CRUD
 *
 * 초보자 가이드:
 * 1. **접미사 목록**: 모델코드별 접미사 DataGrid 표시
 * 2. **모델코드/고객사 필터**: 필터링 지원
 * 3. **접미사 등록/수정**: 모달로 CRUD 처리
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Tag } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ModelSuffix {
  id: string;
  modelCode: string;
  suffixCode: string;
  suffixName: string;
  customer?: string;
  remark?: string;
  useYn: string;
}

const mockData: ModelSuffix[] = [
  { id: '1', modelCode: 'MAIN-A', suffixCode: 'LHD', suffixName: '좌핸들', customer: '현대자동차', useYn: 'Y' },
  { id: '2', modelCode: 'MAIN-A', suffixCode: 'RHD', suffixName: '우핸들', customer: '현대자동차', useYn: 'Y' },
  { id: '3', modelCode: 'MAIN-A', suffixCode: 'ABS', suffixName: 'ABS 포함', customer: '현대자동차', useYn: 'Y' },
  { id: '4', modelCode: 'SUB-B', suffixCode: 'STD', suffixName: '기본형', customer: '기아자동차', useYn: 'Y' },
  { id: '5', modelCode: 'SUB-B', suffixCode: 'DLX', suffixName: '고급형', customer: '기아자동차', useYn: 'Y' },
  { id: '6', modelCode: 'DOOR-C', suffixCode: 'PWR', suffixName: '파워윈도우', customer: '현대자동차', useYn: 'N', remark: '단종' },
];

function ModelSuffixPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ModelSuffix | null>(null);

  const customerOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: '현대자동차', label: '현대자동차' },
    { value: '기아자동차', label: '기아자동차' },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (customerFilter && item.customer !== customerFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.modelCode.toLowerCase().includes(s) || item.suffixCode.toLowerCase().includes(s) || item.suffixName.toLowerCase().includes(s);
  }), [searchText, customerFilter]);

  const columns = useMemo<ColumnDef<ModelSuffix>[]>(() => [
    { accessorKey: 'modelCode', header: t('master.modelSuffix.modelCode'), size: 120 },
    { accessorKey: 'suffixCode', header: t('master.modelSuffix.suffixCode'), size: 110, cell: ({ getValue }) => (
      <span className="px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-mono">{getValue() as string}</span>
    )},
    { accessorKey: 'suffixName', header: t('master.modelSuffix.suffixName'), size: 140 },
    { accessorKey: 'customer', header: t('master.modelSuffix.customer'), size: 120, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'remark', header: t('common.remark'), size: 150, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'useYn', header: t('master.modelSuffix.use'), size: 60, cell: ({ getValue }) => (
      <span className={`w-2 h-2 rounded-full inline-block ${getValue() === 'Y' ? 'bg-green-500' : 'bg-gray-400'}`} />
    )},
    { id: 'actions', header: t('common.actions'), size: 80, cell: ({ row }) => (
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Tag className="w-7 h-7 text-primary" />{t('master.modelSuffix.title')}</h1>
          <p className="text-text-muted mt-1">{t('master.modelSuffix.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t('master.modelSuffix.addSuffix')}</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('master.modelSuffix.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={customerOptions} value={customerFilter} onChange={setCustomerFilter} placeholder={t('master.modelSuffix.customer')} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t('master.modelSuffix.editSuffix') : t('master.modelSuffix.addSuffix')} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('master.modelSuffix.modelCode')} placeholder="MAIN-A" defaultValue={editingItem?.modelCode} fullWidth />
          <Input label={t('master.modelSuffix.suffixCode')} placeholder="LHD" defaultValue={editingItem?.suffixCode} fullWidth />
          <Input label={t('master.modelSuffix.suffixName')} placeholder="좌핸들" defaultValue={editingItem?.suffixName} fullWidth />
          <Input label={t('master.modelSuffix.customer')} placeholder="현대자동차" defaultValue={editingItem?.customer} fullWidth />
          <div className="col-span-2"><Input label={t('common.remark')} placeholder={t('common.remark')} defaultValue={editingItem?.remark} fullWidth /></div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default ModelSuffixPage;
