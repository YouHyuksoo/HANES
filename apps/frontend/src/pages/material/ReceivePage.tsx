/**
 * @file src/pages/material/ReceivePage.tsx
 * @description 입하/IQC 관리 페이지 - 자재 입고 및 수입검사 관리
 *
 * 초보자 가이드:
 * 1. **입하**: 공급업체에서 자재가 도착하면 입하 등록
 * 2. **IQC**: 수입검사(Incoming Quality Control)로 품질 확인
 * 3. **상태 흐름**: PENDING(대기) -> IQC_IN_PROGRESS(검사중) -> PASSED/FAILED
 */
import { useState, useMemo } from 'react';
import { Package, Plus, Search, RefreshCw, ClipboardCheck, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { ReceiveStatusBadge, StatCard } from './components';
import type { ReceiveStatus } from './components';

/** 입하 자재 인터페이스 */
interface Receive {
  id: string;
  receiveNo: string;
  receiveDate: string;
  supplierName: string;
  partCode: string;
  partName: string;
  lotNo: string;
  quantity: number;
  status: ReceiveStatus;
  inspector: string | null;
  inspectedAt: string | null;
}

// Mock 데이터
const mockReceives: Receive[] = [
  { id: '1', receiveNo: 'RCV-20250126-001', receiveDate: '2025-01-26', supplierName: '대한전선', partCode: 'WIRE-001', partName: 'AWG18 적색', lotNo: 'L20250126-A01', quantity: 5000, status: 'PENDING', inspector: null, inspectedAt: null },
  { id: '2', receiveNo: 'RCV-20250126-002', receiveDate: '2025-01-26', supplierName: '한국단자', partCode: 'TERM-001', partName: '단자 110형', lotNo: 'L20250126-B01', quantity: 10000, status: 'IQC_IN_PROGRESS', inspector: '김검사', inspectedAt: null },
  { id: '3', receiveNo: 'RCV-20250125-001', receiveDate: '2025-01-25', supplierName: '삼성커넥터', partCode: 'CONN-001', partName: '커넥터 6핀', lotNo: 'L20250125-C01', quantity: 2000, status: 'PASSED', inspector: '이검사', inspectedAt: '2025-01-25 14:30' },
  { id: '4', receiveNo: 'RCV-20250125-002', receiveDate: '2025-01-25', supplierName: '대한전선', partCode: 'WIRE-002', partName: 'AWG20 흑색', lotNo: 'L20250125-A02', quantity: 3000, status: 'FAILED', inspector: '박검사', inspectedAt: '2025-01-25 16:00' },
  { id: '5', receiveNo: 'RCV-20250124-001', receiveDate: '2025-01-24', supplierName: '한국단자', partCode: 'TERM-002', partName: '단자 250형', lotNo: 'L20250124-B02', quantity: 8000, status: 'PASSED', inspector: '김검사', inspectedAt: '2025-01-24 11:00' },
];

const supplierOptions = [
  { value: '', label: '전체 공급업체' },
  { value: '대한전선', label: '대한전선' },
  { value: '한국단자', label: '한국단자' },
  { value: '삼성커넥터', label: '삼성커넥터' },
];

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '입하대기' },
  { value: 'IQC_IN_PROGRESS', label: 'IQC진행' },
  { value: 'PASSED', label: '합격' },
  { value: 'FAILED', label: '불합격' },
];

function ReceivePage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isIqcModalOpen, setIsIqcModalOpen] = useState(false);
  const [selectedReceive, setSelectedReceive] = useState<Receive | null>(null);
  const [createForm, setCreateForm] = useState({ supplier: '', partCode: '', lotNo: '', quantity: '' });

  const filteredReceives = useMemo(() => {
    return mockReceives.filter((r) => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchSupplier = !supplierFilter || r.supplierName === supplierFilter;
      const matchSearch = !searchText || r.receiveNo.toLowerCase().includes(searchText.toLowerCase()) || r.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSupplier && matchSearch;
    });
  }, [statusFilter, supplierFilter, searchText]);

  const stats = useMemo(() => ({
    pending: mockReceives.filter((r) => r.status === 'PENDING').length,
    inProgress: mockReceives.filter((r) => r.status === 'IQC_IN_PROGRESS').length,
    passed: mockReceives.filter((r) => r.status === 'PASSED').length,
    failed: mockReceives.filter((r) => r.status === 'FAILED').length,
  }), []);

  const handleCreate = () => { console.log('입하 등록:', createForm); setIsCreateModalOpen(false); setCreateForm({ supplier: '', partCode: '', lotNo: '', quantity: '' }); };
  const handleIqcResult = (result: 'PASSED' | 'FAILED') => { console.log(`IQC 결과: ${selectedReceive?.receiveNo} -> ${result}`); setIsIqcModalOpen(false); setSelectedReceive(null); };

  const columns = useMemo<ColumnDef<Receive>[]>(() => [
    { accessorKey: 'receiveNo', header: '입하번호', size: 150 },
    { accessorKey: 'receiveDate', header: '입하일', size: 100 },
    { accessorKey: 'supplierName', header: '공급업체', size: 100 },
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 120 },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 140 },
    { accessorKey: 'quantity', header: '수량', size: 80, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: '상태', size: 100, cell: ({ getValue }) => <ReceiveStatusBadge status={getValue() as ReceiveStatus} /> },
    { id: 'actions', header: 'IQC', size: 80, cell: ({ row }) => {
      const receive = row.original;
      const canIqc = receive.status === 'PENDING' || receive.status === 'IQC_IN_PROGRESS';
      return (<Button variant="ghost" size="sm" disabled={!canIqc} onClick={() => { setSelectedReceive(receive); setIsIqcModalOpen(true); }}><ClipboardCheck className="w-4 h-4" /></Button>);
    }},
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />입하/IQC 관리</h1>
          <p className="text-text-muted mt-1">자재 입고 및 수입검사를 관리합니다.</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> 입하 등록</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="입하대기" value={stats.pending} icon={Clock} color="gray" />
        <StatCard label="IQC진행" value={stats.inProgress} icon={ClipboardCheck} color="blue" />
        <StatCard label="합격" value={stats.passed} icon={CheckCircle} color="green" />
        <StatCard label="불합격" value={stats.failed} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="입하번호, 품목명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
            <div className="w-40"><Select options={supplierOptions} value={supplierFilter} onChange={setSupplierFilter} fullWidth /></div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredReceives} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="입하 등록" size="md">
        <div className="space-y-4">
          <Select label="공급업체" options={supplierOptions.slice(1)} value={createForm.supplier} onChange={(v) => setCreateForm((prev) => ({ ...prev, supplier: v }))} fullWidth />
          <Input label="품목코드" placeholder="품목코드 입력" value={createForm.partCode} onChange={(e) => setCreateForm((prev) => ({ ...prev, partCode: e.target.value }))} fullWidth />
          <Input label="LOT번호" placeholder="LOT번호 입력" value={createForm.lotNo} onChange={(e) => setCreateForm((prev) => ({ ...prev, lotNo: e.target.value }))} fullWidth />
          <Input label="수량" type="number" placeholder="0" value={createForm.quantity} onChange={(e) => setCreateForm((prev) => ({ ...prev, quantity: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>취소</Button><Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> 등록</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isIqcModalOpen} onClose={() => setIsIqcModalOpen(false)} title="IQC 검사 등록" size="sm">
        {selectedReceive && (
          <div className="space-y-4">
            <div className="p-3 bg-background rounded-lg space-y-1">
              <p className="text-sm text-text-muted">입하번호: <span className="font-medium text-text">{selectedReceive.receiveNo}</span></p>
              <p className="text-sm text-text-muted">품목: <span className="font-medium text-text">{selectedReceive.partName}</span></p>
              <p className="text-sm text-text-muted">LOT: <span className="font-medium text-text">{selectedReceive.lotNo}</span></p>
              <p className="text-sm text-text-muted">수량: <span className="font-medium text-text">{selectedReceive.quantity.toLocaleString()}</span></p>
            </div>
            <div className="flex gap-2"><Button className="flex-1" variant="outline" onClick={() => handleIqcResult('FAILED')}><XCircle className="w-4 h-4 mr-1 text-red-500" /> 불합격</Button><Button className="flex-1" onClick={() => handleIqcResult('PASSED')}><CheckCircle className="w-4 h-4 mr-1" /> 합격</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ReceivePage;
