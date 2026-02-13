"use client";

/**
 * @file src/app/(authenticated)/master/work-instruction/page.tsx
 * @description 작업지도서 관리 페이지 - 품목/공정별 작업 지침 CRUD
 *
 * 초보자 가이드:
 * 1. **작업지도서 목록**: 품목/공정별 지침 DataGrid 표시
 * 2. **품목/공정 필터**: 필터링 지원
 * 3. **리비전 관리**: 문서 버전 관리
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, FileText } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface WorkInstruction {
  id: string;
  partCode: string;
  partName: string;
  processCode?: string;
  title: string;
  revision: string;
  imageUrl?: string;
  useYn: string;
  updatedAt: string;
}

const mockData: WorkInstruction[] = [
  { id: '1', partCode: 'H-001', partName: '메인하네스 A', processCode: 'CUT-01', title: '메인하네스 A 절단 작업지침', revision: 'B', useYn: 'Y', updatedAt: '2025-02-10' },
  { id: '2', partCode: 'H-001', partName: '메인하네스 A', processCode: 'CRM-01', title: '메인하네스 A 압착 작업지침', revision: 'A', useYn: 'Y', updatedAt: '2025-01-15' },
  { id: '3', partCode: 'H-001', partName: '메인하네스 A', processCode: 'ASM-01', title: '메인하네스 A 조립 작업지침', revision: 'C', useYn: 'Y', updatedAt: '2025-02-01' },
  { id: '4', partCode: 'H-002', partName: '서브하네스 B', processCode: 'CUT-01', title: '서브하네스 B 절단 작업지침', revision: 'A', useYn: 'Y', updatedAt: '2025-01-20' },
  { id: '5', partCode: 'H-002', partName: '서브하네스 B', processCode: 'INS-01', title: '서브하네스 B 검사 작업지침', revision: 'A', useYn: 'N', updatedAt: '2024-12-05' },
];

function WorkInstructionPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkInstruction | null>(null);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.title.toLowerCase().includes(s) || item.partCode.toLowerCase().includes(s) || (item.processCode?.toLowerCase().includes(s) ?? false);
  }), [searchText]);

  const columns = useMemo<ColumnDef<WorkInstruction>[]>(() => [
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'processCode', header: '공정코드', size: 90, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'title', header: '제목', size: 220 },
    { accessorKey: 'revision', header: 'Rev', size: 60, cell: ({ getValue }) => (
      <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{getValue() as string}</span>
    )},
    { accessorKey: 'updatedAt', header: '수정일', size: 100 },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />작업지도서</h1>
          <p className="text-text-muted mt-1">품목/공정별 작업 지침을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />지도서 추가</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="제목/품목코드/공정코드 검색" value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '작업지도서 수정' : '작업지도서 추가'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="품목코드" placeholder="H-001" defaultValue={editingItem?.partCode} fullWidth />
          <Input label="공정코드" placeholder="CUT-01" defaultValue={editingItem?.processCode} fullWidth />
          <div className="col-span-2"><Input label="제목" placeholder="메인하네스 A 절단 작업지침" defaultValue={editingItem?.title} fullWidth /></div>
          <Input label="리비전" placeholder="A" defaultValue={editingItem?.revision} fullWidth />
          <Input label="이미지 URL" placeholder="https://..." defaultValue={editingItem?.imageUrl} fullWidth />
          <div className="col-span-2">
            <label className="block text-sm font-medium text-text mb-1">내용</label>
            <textarea className="w-full h-32 px-3 py-2 border border-border rounded-lg bg-surface text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary" placeholder="작업 지침 내용을 입력하세요..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default WorkInstructionPage;
