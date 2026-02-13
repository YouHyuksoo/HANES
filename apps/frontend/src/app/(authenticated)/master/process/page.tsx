"use client";

/**
 * @file src/app/(authenticated)/master/process/page.tsx
 * @description 공정관리 페이지 - 공정 코드/유형별 CRUD
 *
 * 초보자 가이드:
 * 1. **공정 목록**: DataGrid로 공정마스터 표시
 * 2. **공정 등록/수정**: 모달로 CRUD 처리
 * 3. **필터**: 공정 유형별 필터링 지원
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, GitBranch } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Process {
  id: string;
  processCode: string;
  processName: string;
  processType: string;
  sortOrder: number;
  remark?: string;
  useYn: string;
}

const mockData: Process[] = [
  { id: '1', processCode: 'CUT-01', processName: '전선절단', processType: 'CUT', sortOrder: 1, useYn: 'Y' },
  { id: '2', processCode: 'CRM-01', processName: '단자압착', processType: 'CRM', sortOrder: 2, useYn: 'Y' },
  { id: '3', processCode: 'ASM-01', processName: '커넥터조립', processType: 'ASM', sortOrder: 3, useYn: 'Y' },
  { id: '4', processCode: 'INS-01', processName: '통전검사', processType: 'INS', sortOrder: 4, useYn: 'Y' },
  { id: '5', processCode: 'PKG-01', processName: '포장', processType: 'PKG', sortOrder: 5, useYn: 'Y' },
  { id: '6', processCode: 'CUT-02', processName: '피복탈피', processType: 'CUT', sortOrder: 6, useYn: 'N', remark: '비활성' },
];

const processTypeMap: Record<string, { label: string; color: string }> = {
  CUT: { label: '절단', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  CRM: { label: '압착', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  ASM: { label: '조립', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  INS: { label: '검사', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  PKG: { label: '포장', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
};

function ProcessPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Process | null>(null);

  const typeOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'CUT', label: '절단' }, { value: 'CRM', label: '압착' },
    { value: 'ASM', label: '조립' }, { value: 'INS', label: '검사' },
    { value: 'PKG', label: '포장' },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (typeFilter && item.processType !== typeFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.processCode.toLowerCase().includes(s) || item.processName.toLowerCase().includes(s);
  }), [searchText, typeFilter]);

  const columns = useMemo<ColumnDef<Process>[]>(() => [
    { accessorKey: 'processCode', header: '공정코드', size: 120 },
    { accessorKey: 'processName', header: '공정명', size: 160 },
    { accessorKey: 'processType', header: '공정유형', size: 100, cell: ({ getValue }) => {
      const t = processTypeMap[getValue() as string] || { label: getValue(), color: 'bg-gray-100 text-gray-700' };
      return <span className={`px-2 py-1 text-xs rounded-full ${t.color}`}>{t.label}</span>;
    }},
    { accessorKey: 'sortOrder', header: '정렬순서', size: 80 },
    { accessorKey: 'remark', header: '비고', size: 150 },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><GitBranch className="w-7 h-7 text-primary" />공정관리</h1>
          <p className="text-text-muted mt-1">공정 코드 및 유형을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />공정 추가</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="공정코드/공정명 검색" value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder="공정유형" fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '공정 수정' : '공정 추가'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Input label="공정코드" placeholder="CUT-01" defaultValue={editingItem?.processCode} fullWidth />
          <Select label="공정유형" options={typeOptions.filter(o => o.value)} value={editingItem?.processType || 'CUT'} onChange={() => {}} fullWidth />
          <div className="col-span-2"><Input label="공정명" placeholder="전선절단" defaultValue={editingItem?.processName} fullWidth /></div>
          <Input label="정렬순서" type="number" placeholder="1" defaultValue={editingItem?.sortOrder?.toString()} fullWidth />
          <Input label="비고" placeholder="비고" defaultValue={editingItem?.remark} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default ProcessPage;
