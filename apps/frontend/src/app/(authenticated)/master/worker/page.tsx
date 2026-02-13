"use client";

/**
 * @file src/app/(authenticated)/master/worker/page.tsx
 * @description 작업자관리 페이지 - 현장 작업자 CRUD, QR코드, 담당공정 관리
 *
 * 초보자 가이드:
 * 1. **작업자 목록**: DataGrid로 작업자마스터 표시
 * 2. **작업자 등록/수정**: 모달로 CRUD 처리
 * 3. **부서 필터**: 부서별 필터링 지원
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Users } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface Worker {
  id: string;
  workerCode: string;
  workerName: string;
  dept: string;
  qrCode?: string;
  processNames: string;
  useYn: string;
}

const mockData: Worker[] = [
  { id: '1', workerCode: 'W-001', workerName: '김작업', dept: '절단팀', qrCode: 'QR-W001', processNames: '전선절단, 피복탈피', useYn: 'Y' },
  { id: '2', workerCode: 'W-002', workerName: '이압착', dept: '압착팀', qrCode: 'QR-W002', processNames: '단자압착', useYn: 'Y' },
  { id: '3', workerCode: 'W-003', workerName: '박조립', dept: '조립팀', qrCode: 'QR-W003', processNames: '커넥터조립, 테이핑', useYn: 'Y' },
  { id: '4', workerCode: 'W-004', workerName: '최검사', dept: '품질팀', qrCode: 'QR-W004', processNames: '통전검사', useYn: 'Y' },
  { id: '5', workerCode: 'W-005', workerName: '정포장', dept: '포장팀', processNames: '포장', useYn: 'N' },
];

function WorkerPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Worker | null>(null);

  const deptOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: '절단팀', label: '절단팀' }, { value: '압착팀', label: '압착팀' },
    { value: '조립팀', label: '조립팀' }, { value: '품질팀', label: '품질팀' },
    { value: '포장팀', label: '포장팀' },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    if (deptFilter && item.dept !== deptFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return item.workerCode.toLowerCase().includes(s) || item.workerName.toLowerCase().includes(s);
  }), [searchText, deptFilter]);

  const columns = useMemo<ColumnDef<Worker>[]>(() => [
    { accessorKey: 'workerCode', header: '작업자코드', size: 110 },
    { accessorKey: 'workerName', header: '작업자명', size: 100 },
    { accessorKey: 'dept', header: '부서', size: 100 },
    { accessorKey: 'qrCode', header: 'QR코드', size: 110, cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'processNames', header: '담당공정', size: 200 },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Users className="w-7 h-7 text-primary" />작업자관리</h1>
          <p className="text-text-muted mt-1">현장 작업자 정보를 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('common.excel')}</Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />작업자 추가</Button>
        </div>
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="작업자코드/이름 검색" value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={deptOptions} value={deptFilter} onChange={setDeptFilter} placeholder="부서" fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '작업자 수정' : '작업자 추가'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <Input label="작업자코드" placeholder="W-001" defaultValue={editingItem?.workerCode} fullWidth />
          <Input label="작업자명" placeholder="김작업" defaultValue={editingItem?.workerName} fullWidth />
          <Input label="부서" placeholder="절단팀" defaultValue={editingItem?.dept} fullWidth />
          <Input label="QR코드" placeholder="QR-W001" defaultValue={editingItem?.qrCode} fullWidth />
          <div className="col-span-2"><Input label="담당공정" placeholder="전선절단, 피복탈피" defaultValue={editingItem?.processNames} fullWidth /></div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
          <Button>{editingItem ? t('common.edit') : t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}

export default WorkerPage;
