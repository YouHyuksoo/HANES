"use client";

/**
 * @file src/app/(authenticated)/master/routing/page.tsx
 * @description 라우팅관리 페이지 - 품목별 공정순서(ProcessMap) CRUD
 *
 * 초보자 가이드:
 * 1. **라우팅 목록**: 품목별 공정순서를 DataGrid로 표시
 * 2. **품목 필터**: 특정 품목 선택 시 해당 공정순서만 표시
 * 3. **라우팅 등록/수정**: 모달로 CRUD 처리
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Route } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Routing {
  id: string;
  partCode: string;
  partName: string;
  seq: number;
  processCode: string;
  processName: string;
  processType: string;
  equipType?: string;
  stdTime?: number;
  setupTime?: number;
  useYn: string;
}

const mockData: Routing[] = [
  { id: '1', partCode: 'H-001', partName: '메인하네스 A', seq: 1, processCode: 'CUT-01', processName: '전선절단', processType: 'CUT', equipType: '자동', stdTime: 5.5, setupTime: 10, useYn: 'Y' },
  { id: '2', partCode: 'H-001', partName: '메인하네스 A', seq: 2, processCode: 'CRM-01', processName: '단자압착', processType: 'CRM', equipType: '자동', stdTime: 3.2, setupTime: 15, useYn: 'Y' },
  { id: '3', partCode: 'H-001', partName: '메인하네스 A', seq: 3, processCode: 'ASM-01', processName: '커넥터조립', processType: 'ASM', equipType: '수동', stdTime: 8.0, setupTime: 5, useYn: 'Y' },
  { id: '4', partCode: 'H-001', partName: '메인하네스 A', seq: 4, processCode: 'INS-01', processName: '통전검사', processType: 'INS', equipType: '자동', stdTime: 2.0, setupTime: 3, useYn: 'Y' },
  { id: '5', partCode: 'H-002', partName: '서브하네스 B', seq: 1, processCode: 'CUT-01', processName: '전선절단', processType: 'CUT', equipType: '자동', stdTime: 4.0, setupTime: 8, useYn: 'Y' },
  { id: '6', partCode: 'H-002', partName: '서브하네스 B', seq: 2, processCode: 'CRM-01', processName: '단자압착', processType: 'CRM', equipType: '자동', stdTime: 2.5, setupTime: 12, useYn: 'Y' },
];

function RoutingPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Routing | null>(null);

  const partOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'H-001', label: 'H-001 메인하네스 A' },
    { value: 'H-002', label: 'H-002 서브하네스 B' },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (partFilter && item.partCode !== partFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.processCode.toLowerCase().includes(s) || item.processName.toLowerCase().includes(s);
  }), [searchText, partFilter]);

  const columns = useMemo<ColumnDef<Routing>[]>(() => [
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'seq', header: '순서', size: 60 },
    { accessorKey: 'processCode', header: '공정코드', size: 100 },
    { accessorKey: 'processName', header: '공정명', size: 120 },
    { accessorKey: 'processType', header: '유형', size: 70 },
    { accessorKey: 'equipType', header: '설비타입', size: 80 },
    { accessorKey: 'stdTime', header: '표준시간', size: 80, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : '-' },
    { accessorKey: 'setupTime', header: '셋업시간', size: 80, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : '-' },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Route className="w-7 h-7 text-primary" />라우팅관리</h1>
          <p className="text-text-muted mt-1">품목별 공정순서를 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />라우팅 추가</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="공정코드/공정명 검색" value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-56"><Select options={partOptions} value={partFilter} onChange={setPartFilter} placeholder="품목선택" fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '라우팅 수정' : '라우팅 추가'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Select label="품목" options={partOptions.filter(o => o.value)} value={editingItem?.partCode || ''} onChange={() => {}} fullWidth />
          <Input label="순서" type="number" placeholder="1" defaultValue={editingItem?.seq?.toString()} fullWidth />
          <Input label="공정코드" placeholder="CUT-01" defaultValue={editingItem?.processCode} fullWidth />
          <Input label="공정명" placeholder="전선절단" defaultValue={editingItem?.processName} fullWidth />
          <Input label="공정유형" placeholder="CUT" defaultValue={editingItem?.processType} fullWidth />
          <Input label="설비타입" placeholder="자동/수동" defaultValue={editingItem?.equipType} fullWidth />
          <Input label="표준시간(초)" type="number" placeholder="5.5" defaultValue={editingItem?.stdTime?.toString()} fullWidth />
          <Input label="셋업시간(초)" type="number" placeholder="10" defaultValue={editingItem?.setupTime?.toString()} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default RoutingPage;
