"use client";

/**
 * @file src/pages/shipping/PackPage.tsx
 * @description 포장관리 페이지 - 박스 단위 포장 관리
 *
 * 초보자 가이드:
 * 1. **박스**: 완성된 제품을 담는 포장 단위
 * 2. **상태 흐름**: OPEN(생성) -> CLOSED(포장완료) -> SHIPPED(출하)
 * 3. **시리얼 추가**: 완성품 시리얼을 박스에 할당
 */
import { useState, useMemo } from 'react';
import { Package, Plus, Search, RefreshCw, XCircle, CheckCircle, Lock, Truck } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import { useComCodeOptions } from '@/hooks/useComCode';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { StatCard } from '@/components/ui';
import { BoxStatusBadge } from '@/components/shipping';
import type { BoxStatus } from '@/components/shipping';

/** 박스 인터페이스 */
interface Box {
  id: string;
  boxNo: string;
  partCode: string;
  partName: string;
  quantity: number;
  status: BoxStatus;
  closedAt: string | null;
  createdAt: string;
  serials: string[];
}

// Mock 데이터
const mockBoxes: Box[] = [
  { id: '1', boxNo: 'BOX-20250126-001', partCode: 'H-001', partName: '메인 하네스 A', quantity: 50, status: 'OPEN', closedAt: null, createdAt: '2025-01-26 09:00', serials: ['SN-001', 'SN-002', 'SN-003'] },
  { id: '2', boxNo: 'BOX-20250126-002', partCode: 'H-002', partName: '서브 하네스 B', quantity: 100, status: 'CLOSED', closedAt: '2025-01-26 12:30', createdAt: '2025-01-26 08:00', serials: Array.from({ length: 100 }, (_, i) => `SN-B-${String(i + 1).padStart(3, '0')}`) },
  { id: '3', boxNo: 'BOX-20250125-001', partCode: 'H-003', partName: '도어 하네스 C', quantity: 80, status: 'SHIPPED', closedAt: '2025-01-25 16:00', createdAt: '2025-01-25 10:00', serials: Array.from({ length: 80 }, (_, i) => `SN-C-${String(i + 1).padStart(3, '0')}`) },
  { id: '4', boxNo: 'BOX-20250126-003', partCode: 'H-001', partName: '메인 하네스 A', quantity: 45, status: 'OPEN', closedAt: null, createdAt: '2025-01-26 10:30', serials: Array.from({ length: 45 }, (_, i) => `SN-A2-${String(i + 1).padStart(3, '0')}`) },
];

const partOptions = [
  { value: '', label: '전체 품목' },
  { value: 'H-001', label: 'H-001 (메인 하네스 A)' },
  { value: 'H-002', label: 'H-002 (서브 하네스 B)' },
  { value: 'H-003', label: 'H-003 (도어 하네스 C)' },
];

function PackPage() {
  const comCodeOptions = useComCodeOptions('BOX_STATUS');
  const statusOptions = [{ value: '', label: '전체 상태' }, ...comCodeOptions];
  const [statusFilter, setStatusFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [createForm, setCreateForm] = useState({ partCode: '', quantity: '' });
  const [serialInput, setSerialInput] = useState('');

  const filteredBoxes = useMemo(() => {
    return mockBoxes.filter((box) => {
      const matchStatus = !statusFilter || box.status === statusFilter;
      const matchPart = !partFilter || box.partCode === partFilter;
      const matchSearch = !searchText || box.boxNo.toLowerCase().includes(searchText.toLowerCase()) || box.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchPart && matchSearch;
    });
  }, [statusFilter, partFilter, searchText]);

  const stats = useMemo(() => ({
    open: mockBoxes.filter((b) => b.status === 'OPEN').length,
    closed: mockBoxes.filter((b) => b.status === 'CLOSED').length,
    shipped: mockBoxes.filter((b) => b.status === 'SHIPPED').length,
    totalQty: mockBoxes.reduce((sum, b) => sum + b.quantity, 0),
  }), []);

  const handleCreate = () => { console.log('박스 생성:', createForm); setIsCreateModalOpen(false); setCreateForm({ partCode: '', quantity: '' }); };
  const handleAddSerial = () => { if (serialInput.trim() && selectedBox) { console.log(`박스 ${selectedBox.boxNo}에 시리얼 추가:`, serialInput); setSerialInput(''); } };
  const handleCloseBox = (box: Box) => { console.log('박스 닫기:', box.boxNo); };

  const columns = useMemo<ColumnDef<Box>[]>(() => [
    { accessorKey: 'boxNo', header: '박스번호', size: 160 },
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 150 },
    { accessorKey: 'quantity', header: '수량', size: 80, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: '상태', size: 100, cell: ({ getValue }) => <BoxStatusBadge status={getValue() as BoxStatus} /> },
    { accessorKey: 'closedAt', header: '포장완료시간', size: 140, cell: ({ getValue }) => getValue() || '-' },
    { id: 'actions', header: '작업', size: 120, cell: ({ row }) => {
      const box = row.original;
      return (
        <div className="flex gap-1">
          <button className="p-1 hover:bg-surface rounded" title="시리얼추가" disabled={box.status !== 'OPEN'} onClick={() => { setSelectedBox(box); setIsSerialModalOpen(true); }}><Plus className={`w-4 h-4 ${box.status === 'OPEN' ? 'text-primary' : 'text-text-muted opacity-50'}`} /></button>
          <button className="p-1 hover:bg-surface rounded" title="박스닫기" disabled={box.status !== 'OPEN'} onClick={() => handleCloseBox(box)}><Lock className={`w-4 h-4 ${box.status === 'OPEN' ? 'text-primary' : 'text-text-muted opacity-50'}`} /></button>
        </div>
      );
    }},
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />포장관리</h1>
          <p className="text-text-muted mt-1">박스 단위로 제품을 포장합니다.</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> 박스 생성</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="진행중" value={stats.open} icon={Package} color="blue" />
        <StatCard label="포장완료" value={stats.closed} icon={CheckCircle} color="green" />
        <StatCard label="출하" value={stats.shipped} icon={Truck} color="purple" />
        <StatCard label="총 수량" value={stats.totalQty} icon={Package} color="gray" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="박스번호, 품목명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
            <div className="w-48"><Select options={partOptions} value={partFilter} onChange={setPartFilter} fullWidth /></div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredBoxes} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="박스 생성" size="sm">
        <div className="space-y-4">
          <Select label="품목" options={partOptions.slice(1)} value={createForm.partCode} onChange={(v) => setCreateForm((prev) => ({ ...prev, partCode: v }))} fullWidth />
          <Input label="수량" type="number" placeholder="0" value={createForm.quantity} onChange={(e) => setCreateForm((prev) => ({ ...prev, quantity: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>취소</Button>
            <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> 생성</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isSerialModalOpen} onClose={() => setIsSerialModalOpen(false)} title="시리얼 추가" size="md">
        <div className="space-y-4">
          {selectedBox && (<div className="p-3 bg-background rounded-lg"><p className="text-sm text-text-muted">박스: <span className="font-medium text-text">{selectedBox.boxNo}</span></p><p className="text-sm text-text-muted">현재 수량: <span className="font-medium text-text">{selectedBox.serials.length}개</span></p></div>)}
          <div className="flex gap-2"><Input placeholder="시리얼번호 입력 또는 스캔" value={serialInput} onChange={(e) => setSerialInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSerial()} fullWidth /><Button onClick={handleAddSerial}><Plus className="w-4 h-4" /></Button></div>
          <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2">
            {selectedBox?.serials.slice(0, 10).map((serial, idx) => (<div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-background rounded"><span className="text-sm font-mono">{serial}</span><XCircle className="w-4 h-4 text-text-muted cursor-pointer hover:text-red-500" /></div>))}
            {selectedBox && selectedBox.serials.length > 10 && (<p className="text-xs text-text-muted text-center py-2">외 {selectedBox.serials.length - 10}개...</p>)}
          </div>
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setIsSerialModalOpen(false)}>닫기</Button></div>
        </div>
      </Modal>
    </div>
  );
}

export default PackPage;
