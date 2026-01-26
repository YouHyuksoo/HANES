/**
 * @file src/pages/material/IssuePage.tsx
 * @description 출고관리 페이지 - 작업지시 연계 자재 출고 관리
 *
 * 초보자 가이드:
 * 1. **출고**: 작업지시에 따라 자재를 창고에서 생산라인으로 출고
 * 2. **작업지시 연계**: 작업지시번호와 연계하여 필요 자재 자동 조회
 * 3. **상태 흐름**: PENDING(대기) -> IN_PROGRESS(진행중) -> COMPLETED(완료)
 */
import { useState, useMemo } from 'react';
import { ArrowRightFromLine, Plus, Search, RefreshCw, Clock, Play, CheckCircle, Clipboard } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { IssueStatusBadge, StatCard } from './components';
import type { IssueStatus } from './components';

/** 출고 인터페이스 */
interface Issue {
  id: string;
  issueNo: string;
  issueDate: string;
  workOrderNo: string;
  partCode: string;
  partName: string;
  requestQty: number;
  issuedQty: number;
  status: IssueStatus;
  warehouse: string;
  operator: string | null;
  completedAt: string | null;
}

// Mock 데이터
const mockIssues: Issue[] = [
  { id: '1', issueNo: 'ISS-20250126-001', issueDate: '2025-01-26', workOrderNo: 'WO-2025-0126-001', partCode: 'WIRE-001', partName: 'AWG18 적색', requestQty: 1000, issuedQty: 0, status: 'PENDING', warehouse: '자재창고A', operator: null, completedAt: null },
  { id: '2', issueNo: 'ISS-20250126-002', issueDate: '2025-01-26', workOrderNo: 'WO-2025-0126-001', partCode: 'TERM-001', partName: '단자 110형', requestQty: 500, issuedQty: 300, status: 'IN_PROGRESS', warehouse: '자재창고B', operator: '박출고', completedAt: null },
  { id: '3', issueNo: 'ISS-20250126-003', issueDate: '2025-01-26', workOrderNo: 'WO-2025-0126-002', partCode: 'CONN-001', partName: '커넥터 6핀', requestQty: 200, issuedQty: 200, status: 'COMPLETED', warehouse: '자재창고A', operator: '김출고', completedAt: '2025-01-26 11:30' },
  { id: '4', issueNo: 'ISS-20250125-001', issueDate: '2025-01-25', workOrderNo: 'WO-2025-0125-001', partCode: 'WIRE-002', partName: 'AWG20 흑색', requestQty: 800, issuedQty: 800, status: 'COMPLETED', warehouse: '자재창고A', operator: '이출고', completedAt: '2025-01-25 15:00' },
  { id: '5', issueNo: 'ISS-20250125-002', issueDate: '2025-01-25', workOrderNo: 'WO-2025-0125-002', partCode: 'TUBE-001', partName: '수축튜브 5mm', requestQty: 5000, issuedQty: 5000, status: 'COMPLETED', warehouse: '부자재창고', operator: '박출고', completedAt: '2025-01-25 16:30' },
];

const workOrderOptions = [
  { value: '', label: '전체 작업지시' },
  { value: 'WO-2025-0126-001', label: 'WO-2025-0126-001' },
  { value: 'WO-2025-0126-002', label: 'WO-2025-0126-002' },
  { value: 'WO-2025-0125-001', label: 'WO-2025-0125-001' },
  { value: 'WO-2025-0125-002', label: 'WO-2025-0125-002' },
];

const statusOptions = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '대기' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'COMPLETED', label: '완료' },
];

function IssuePage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [workOrderFilter, setWorkOrderFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [createForm, setCreateForm] = useState({ workOrderNo: '', partCode: '', quantity: '' });
  const [issueQty, setIssueQty] = useState('');

  const filteredIssues = useMemo(() => {
    return mockIssues.filter((i) => {
      const matchStatus = !statusFilter || i.status === statusFilter;
      const matchWorkOrder = !workOrderFilter || i.workOrderNo === workOrderFilter;
      const matchSearch = !searchText || i.issueNo.toLowerCase().includes(searchText.toLowerCase()) || i.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchWorkOrder && matchSearch;
    });
  }, [statusFilter, workOrderFilter, searchText]);

  const stats = useMemo(() => ({
    pending: mockIssues.filter((i) => i.status === 'PENDING').length,
    inProgress: mockIssues.filter((i) => i.status === 'IN_PROGRESS').length,
    completed: mockIssues.filter((i) => i.status === 'COMPLETED').length,
    totalRequested: mockIssues.reduce((sum, i) => sum + i.requestQty, 0),
  }), []);

  const handleCreate = () => { console.log('출고 등록:', createForm); setIsCreateModalOpen(false); setCreateForm({ workOrderNo: '', partCode: '', quantity: '' }); };
  const handleIssue = () => { console.log(`출고 처리: ${selectedIssue?.issueNo}, 수량: ${issueQty}`); setIsIssueModalOpen(false); setSelectedIssue(null); setIssueQty(''); };

  const columns = useMemo<ColumnDef<Issue>[]>(() => [
    { accessorKey: 'issueNo', header: '출고번호', size: 150 },
    { accessorKey: 'issueDate', header: '출고일', size: 100 },
    { accessorKey: 'workOrderNo', header: '작업지시', size: 150, cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 120 },
    { accessorKey: 'requestQty', header: '요청수량', size: 90, cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'issuedQty', header: '출고수량', size: 90, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'status', header: '상태', size: 90, cell: ({ getValue }) => <IssueStatusBadge status={getValue() as IssueStatus} /> },
    { id: 'actions', header: '출고', size: 80, cell: ({ row }) => {
      const issue = row.original;
      const canIssue = issue.status !== 'COMPLETED';
      return (<Button variant="ghost" size="sm" disabled={!canIssue} onClick={() => { setSelectedIssue(issue); setIsIssueModalOpen(true); }}><Play className="w-4 h-4" /></Button>);
    }},
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2"><ArrowRightFromLine className="w-7 h-7 text-primary" />출고관리</h1>
          <p className="text-text-muted mt-1">작업지시에 따른 자재 출고를 관리합니다.</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> 출고 등록</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="대기" value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label="진행중" value={stats.inProgress} icon={Play} color="blue" />
        <StatCard label="완료" value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label="총 요청수량" value={stats.totalRequested} icon={Clipboard} color="gray" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="출고번호, 품목명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
            <div className="w-48"><Select options={workOrderOptions} value={workOrderFilter} onChange={setWorkOrderFilter} fullWidth /></div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredIssues} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="출고 등록" size="md">
        <div className="space-y-4">
          <Select label="작업지시" options={workOrderOptions.slice(1)} value={createForm.workOrderNo} onChange={(v) => setCreateForm((prev) => ({ ...prev, workOrderNo: v }))} fullWidth />
          <Input label="품목코드" placeholder="품목코드 입력" value={createForm.partCode} onChange={(e) => setCreateForm((prev) => ({ ...prev, partCode: e.target.value }))} fullWidth />
          <Input label="요청수량" type="number" placeholder="0" value={createForm.quantity} onChange={(e) => setCreateForm((prev) => ({ ...prev, quantity: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border"><Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>취소</Button><Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> 등록</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isIssueModalOpen} onClose={() => setIsIssueModalOpen(false)} title="출고 처리" size="sm">
        {selectedIssue && (
          <div className="space-y-4">
            <div className="p-3 bg-background rounded-lg space-y-1">
              <p className="text-sm text-text-muted">출고번호: <span className="font-medium text-text">{selectedIssue.issueNo}</span></p>
              <p className="text-sm text-text-muted">작업지시: <span className="font-medium text-primary">{selectedIssue.workOrderNo}</span></p>
              <p className="text-sm text-text-muted">품목: <span className="font-medium text-text">{selectedIssue.partName}</span></p>
              <p className="text-sm text-text-muted">요청수량: <span className="font-medium text-text">{selectedIssue.requestQty.toLocaleString()}</span></p>
              <p className="text-sm text-text-muted">기출고: <span className="font-medium text-text">{selectedIssue.issuedQty.toLocaleString()}</span></p>
              <p className="text-sm text-text-muted">잔여: <span className="font-bold text-primary">{(selectedIssue.requestQty - selectedIssue.issuedQty).toLocaleString()}</span></p>
            </div>
            <Input label="출고수량" type="number" placeholder="0" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4 border-t border-border"><Button variant="secondary" onClick={() => setIsIssueModalOpen(false)}>취소</Button><Button onClick={handleIssue}><CheckCircle className="w-4 h-4 mr-1" /> 출고</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default IssuePage;
