/**
 * @file src/pages/crimping/ResultPage.tsx
 * @description 압착 작업실적 페이지 - C/H 승인 로직 포함
 *
 * 초보자 가이드:
 * 1. **작업실적**: 압착 완료된 제품의 수량 및 품질 정보
 * 2. **C/H 측정**: 압착 높이(Crimp Height) 실측값 기록
 * 3. **승인 로직**: C/H 실측값이 기준 범위 내인지 품질팀 승인 필요
 */
import { useState, useMemo } from 'react';
import { Search, RefreshCw, Download, Calendar, Hammer, Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { CrimpingResult, CHApprovalStatus, chApprovalStyles } from './types';

// Mock 데이터
const mockResults: CrimpingResult[] = [
  { id: '1', resultNo: 'CPR-20250126-001', orderNo: 'CP-20250126-002', workDate: '2025-01-26', wireCode: 'W-002', wireName: 'AVS 0.85sq BLACK', terminalCode: 'T-002', terminalName: '250형 단자', moldCode: 'MD-002', goodQty: 520, defectQty: 8, equipCode: 'CRM-001', workerName: '김압착', crimpHeightActual: 2.12, chApprovalStatus: 'APPROVED', chApprovedBy: '이품질', startTime: '08:00', endTime: '14:00' },
  { id: '2', resultNo: 'CPR-20250125-001', orderNo: 'CP-20250125-001', workDate: '2025-01-25', wireCode: 'W-003', wireName: 'AVS 2.0sq YELLOW', terminalCode: 'T-003', terminalName: '312형 단자', moldCode: 'MD-003', goodQty: 495, defectQty: 5, equipCode: 'CRM-002', workerName: '박압착', crimpHeightActual: 2.48, chApprovalStatus: 'APPROVED', chApprovedBy: '이품질', startTime: '09:00', endTime: '17:00' },
  { id: '3', resultNo: 'CPR-20250126-002', orderNo: 'CP-20250126-001', workDate: '2025-01-26', wireCode: 'W-001', wireName: 'AVS 0.5sq RED', terminalCode: 'T-001', terminalName: '110형 단자', moldCode: 'MD-001', goodQty: 150, defectQty: 3, equipCode: 'CRM-001', workerName: '최압착', crimpHeightActual: 1.87, chApprovalStatus: 'PENDING', startTime: '14:00', endTime: '16:00' },
  { id: '4', resultNo: 'CPR-20250124-001', orderNo: 'CP-20250124-001', workDate: '2025-01-24', wireCode: 'W-001', wireName: 'AVS 0.5sq WHITE', terminalCode: 'T-001', terminalName: '110형 단자', moldCode: 'MD-001', goodQty: 0, defectQty: 50, equipCode: 'CRM-002', workerName: '정압착', crimpHeightActual: 1.95, chApprovalStatus: 'REJECTED', chApprovedBy: '이품질', startTime: '10:00', endTime: '11:00' },
];

const approvalOptions = [
  { value: '', label: '전체 승인상태' },
  { value: 'PENDING', label: '대기' },
  { value: 'APPROVED', label: '승인' },
  { value: 'REJECTED', label: '반려' },
];

function ResultPage() {
  const [approvalFilter, setApprovalFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<CrimpingResult | null>(null);

  const filteredResults = useMemo(() => {
    return mockResults.filter((r) => {
      const matchApproval = !approvalFilter || r.chApprovalStatus === approvalFilter;
      const matchSearch = !searchText ||
        r.resultNo.toLowerCase().includes(searchText.toLowerCase()) ||
        r.orderNo.toLowerCase().includes(searchText.toLowerCase());
      const matchStart = !startDate || r.workDate >= startDate;
      const matchEnd = !endDate || r.workDate <= endDate;
      return matchApproval && matchSearch && matchStart && matchEnd;
    });
  }, [approvalFilter, searchText, startDate, endDate]);

  const stats = useMemo(() => {
    const totalGood = filteredResults.reduce((s, r) => s + r.goodQty, 0);
    const totalDefect = filteredResults.reduce((s, r) => s + r.defectQty, 0);
    const pendingCount = filteredResults.filter(r => r.chApprovalStatus === 'PENDING').length;
    return { totalGood, totalDefect, pendingCount };
  }, [filteredResults]);

  const handleApproval = (status: CHApprovalStatus) => {
    console.log(`C/H ${status}: ${selectedResult?.resultNo}`);
    setIsApprovalOpen(false);
  };

  const columns = useMemo<ColumnDef<CrimpingResult>[]>(() => [
    { accessorKey: 'resultNo', header: '실적번호', size: 140 },
    { accessorKey: 'workDate', header: '작업일', size: 100 },
    { accessorKey: 'orderNo', header: '작업지시', size: 140 },
    { accessorKey: 'terminalName', header: '터미널', size: 100 },
    { accessorKey: 'moldCode', header: '금형', size: 80 },
    { accessorKey: 'goodQty', header: '양품', size: 70, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: '불량', size: 70, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'crimpHeightActual', header: 'C/H 실측', size: 90, cell: ({ getValue }) => <span className="font-mono">{(getValue() as number).toFixed(2)} mm</span> },
    { accessorKey: 'chApprovalStatus', header: 'C/H 승인', size: 90,
      cell: ({ getValue, row }) => {
        const s = getValue() as CHApprovalStatus;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); if (s === 'PENDING') { setSelectedResult(row.original); setIsApprovalOpen(true); } }}
            className={`px-2 py-1 text-xs rounded-full ${chApprovalStyles[s].color} ${s === 'PENDING' ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            {chApprovalStyles[s].label}
          </button>
        );
      },
    },
    { accessorKey: 'workerName', header: '작업자', size: 80 },
    { id: 'time', header: '작업시간', size: 110, cell: ({ row }) => <span className="text-text-muted">{row.original.startTime}~{row.original.endTime}</span> },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Hammer className="w-7 h-7 text-primary" />압착 작업실적</h1>
          <p className="text-text-muted mt-1">압착 작업 실적 및 C/H 승인 현황을 조회합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀</Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="양품" value={stats.totalGood} icon={CheckCircle} color="green" />
        <StatCard label="불량" value={stats.totalDefect} icon={XCircle} color="red" />
        <StatCard label="C/H 승인대기" value={`${stats.pendingCount}건`} icon={Clock} color="yellow" />
        <StatCard label="총 실적" value={`${filteredResults.length}건`} icon={Package} color="blue" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="실적번호, 지시번호 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={approvalOptions} value={approvalFilter} onChange={setApprovalFilter} placeholder="승인상태" />
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredResults} columns={columns} pageSize={10} />
        </CardContent>
      </Card>

      {/* C/H 승인 모달 */}
      <Modal isOpen={isApprovalOpen} onClose={() => setIsApprovalOpen(false)} title="C/H 승인" size="sm">
        {selectedResult && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-muted">실적번호</span><p className="font-semibold">{selectedResult.resultNo}</p></div>
                <div><span className="text-text-muted">터미널</span><p className="font-semibold">{selectedResult.terminalName}</p></div>
                <div><span className="text-text-muted">금형</span><p className="font-semibold">{selectedResult.moldCode}</p></div>
                <div><span className="text-text-muted">작업자</span><p className="font-semibold">{selectedResult.workerName}</p></div>
              </div>
            </div>
            <div className="p-4 border border-border rounded-lg text-center">
              <p className="text-sm text-text-muted mb-1">C/H 실측값</p>
              <p className="text-3xl font-bold text-primary">{selectedResult.crimpHeightActual.toFixed(2)} mm</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={() => handleApproval('REJECTED')} className="flex-1">
                <XCircle className="w-4 h-4 mr-1 text-red-500" />반려
              </Button>
              <Button onClick={() => handleApproval('APPROVED')} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-1" />승인
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ResultPage;
