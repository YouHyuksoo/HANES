"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC 검사항목 관리 페이지 - 품목별 수입검사 기준 관리
 *
 * 초보자 가이드:
 * 1. **검사항목 목록**: 품목별 IQC 검사항목 DataGrid 표시
 * 2. **품목 필터**: 특정 품목의 검사항목만 필터링
 * 3. **LSL/USL**: 하한/상한 규격 관리
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface IqcItem {
  id: string;
  partCode: string;
  partName: string;
  seq: number;
  inspectItem: string;
  spec?: string;
  lsl?: number;
  usl?: number;
  unit?: string;
  isShelfLife: boolean;
  retestCycle?: number;
  useYn: string;
}

const mockData: IqcItem[] = [
  { id: '1', partCode: 'W-001', partName: '전선 AWG18 RED', seq: 1, inspectItem: '외관검사', spec: '이물/손상 없을것', unit: '-', isShelfLife: false, useYn: 'Y' },
  { id: '2', partCode: 'W-001', partName: '전선 AWG18 RED', seq: 2, inspectItem: '도체저항', spec: '23.2 ohm/km', lsl: 20, usl: 26, unit: 'ohm/km', isShelfLife: false, useYn: 'Y' },
  { id: '3', partCode: 'W-001', partName: '전선 AWG18 RED', seq: 3, inspectItem: '피복두께', spec: '0.5mm', lsl: 0.4, usl: 0.6, unit: 'mm', isShelfLife: false, useYn: 'Y' },
  { id: '4', partCode: 'T-001', partName: '단자 110형', seq: 1, inspectItem: '외관검사', spec: '변형/부식 없을것', isShelfLife: false, useYn: 'Y' },
  { id: '5', partCode: 'T-001', partName: '단자 110형', seq: 2, inspectItem: '도금두께', spec: '0.8um', lsl: 0.5, usl: 1.2, unit: 'um', isShelfLife: false, useYn: 'Y' },
  { id: '6', partCode: 'G-001', partName: '그리스 A', seq: 1, inspectItem: '유효기한', spec: '제조일 12개월', isShelfLife: true, retestCycle: 90, useYn: 'Y' },
];

function IqcItemPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IqcItem | null>(null);

  const partOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'W-001', label: 'W-001 전선 AWG18 RED' },
    { value: 'T-001', label: 'T-001 단자 110형' },
    { value: 'G-001', label: 'G-001 그리스 A' },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (partFilter && item.partCode !== partFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.inspectItem.toLowerCase().includes(s) || item.partCode.toLowerCase().includes(s);
  }), [searchText, partFilter]);

  const columns = useMemo<ColumnDef<IqcItem>[]>(() => [
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'seq', header: '순서', size: 60 },
    { accessorKey: 'inspectItem', header: '검사항목', size: 140 },
    { accessorKey: 'spec', header: '규격', size: 150 },
    { accessorKey: 'lsl', header: 'LSL', size: 70, cell: ({ getValue }) => getValue() != null ? getValue() : '-' },
    { accessorKey: 'usl', header: 'USL', size: 70, cell: ({ getValue }) => getValue() != null ? getValue() : '-' },
    { accessorKey: 'unit', header: '단위', size: 70 },
    { accessorKey: 'isShelfLife', header: '유수명', size: 70, cell: ({ getValue }) => getValue() ? 'O' : '-' },
    { accessorKey: 'useYn', header: '사용', size: 60, cell: ({ getValue }) => (
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-primary" />IQC 검사항목</h1>
          <p className="text-text-muted mt-1">품목별 수입검사 기준을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />검사항목 추가</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="검사항목/품목코드 검색" value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-56"><Select options={partOptions} value={partFilter} onChange={setPartFilter} placeholder="품목선택" fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '검사항목 수정' : '검사항목 추가'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Select label="품목" options={partOptions.filter(o => o.value)} value={editingItem?.partCode || ''} onChange={() => {}} fullWidth />
          <Input label="순서" type="number" placeholder="1" defaultValue={editingItem?.seq?.toString()} fullWidth />
          <div className="col-span-2"><Input label="검사항목" placeholder="외관검사" defaultValue={editingItem?.inspectItem} fullWidth /></div>
          <div className="col-span-2"><Input label="규격" placeholder="이물/손상 없을것" defaultValue={editingItem?.spec} fullWidth /></div>
          <Input label="LSL" type="number" placeholder="0.4" defaultValue={editingItem?.lsl?.toString()} fullWidth />
          <Input label="USL" type="number" placeholder="0.6" defaultValue={editingItem?.usl?.toString()} fullWidth />
          <Input label="단위" placeholder="mm" defaultValue={editingItem?.unit} fullWidth />
          <Input label="재검사주기(일)" type="number" placeholder="90" defaultValue={editingItem?.retestCycle?.toString()} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default IqcItemPage;
