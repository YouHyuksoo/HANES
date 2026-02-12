"use client";

/**
 * @file src/pages/cutting/ResultPage.tsx
 * @description 절단 작업실적 페이지 - 절단/탈피 결과 조회
 *
 * 초보자 가이드:
 * 1. **작업실적**: 절단 완료된 전선의 수량 및 품질 정보
 * 2. **양품/불량**: 절단 길이, 탈피 상태 검사 결과 구분
 * 3. **LOT 추적**: 어떤 릴에서 절단되었는지 추적 가능
 */
import { useState, useMemo } from 'react';
import { Search, RefreshCw, Download, Calendar, Scissors, Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { CuttingResult } from '@/types/cutting';

// Mock 데이터
const mockResults: CuttingResult[] = [
  { id: '1', resultNo: 'CR-20250126-001', orderNo: 'CT-20250126-002', workDate: '2025-01-26', wireCode: 'W-002', wireName: 'AVS 0.85sq', cutLength: 2000, stripLengthA: 6, stripLengthB: 6, goodQty: 450, defectQty: 5, equipCode: 'CUT-001', workerName: '김절단', reelLotNo: 'REEL-20250120-001', startTime: '08:00', endTime: '12:00' },
  { id: '2', resultNo: 'CR-20250125-001', orderNo: 'CT-20250125-001', workDate: '2025-01-25', wireCode: 'W-003', wireName: 'AVS 2.0sq', cutLength: 1200, stripLengthA: 8, stripLengthB: 8, goodQty: 498, defectQty: 2, equipCode: 'CUT-002', workerName: '이절단', reelLotNo: 'REEL-20250118-002', startTime: '09:00', endTime: '16:00' },
  { id: '3', resultNo: 'CR-20250124-001', orderNo: 'CT-20250124-001', workDate: '2025-01-24', wireCode: 'W-001', wireName: 'AVS 0.5sq', cutLength: 1500, stripLengthA: 5, stripLengthB: 7, goodQty: 980, defectQty: 20, equipCode: 'CUT-001', workerName: '박절단', reelLotNo: 'REEL-20250115-001', startTime: '08:30', endTime: '17:30' },
  { id: '4', resultNo: 'CR-20250124-002', orderNo: 'CT-20250124-002', workDate: '2025-01-24', wireCode: 'W-002', wireName: 'AVS 0.85sq', cutLength: 800, stripLengthA: 4, stripLengthB: 4, goodQty: 1495, defectQty: 5, equipCode: 'CUT-002', workerName: '김절단', reelLotNo: 'REEL-20250120-002', startTime: '13:00', endTime: '18:00' },
];

const equipOptions = [
  { value: '', label: '전체 설비' },
  { value: 'CUT-001', label: 'CUT-001' },
  { value: 'CUT-002', label: 'CUT-002' },
];

function ResultPage() {
  const [equipFilter, setEquipFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredResults = useMemo(() => {
    return mockResults.filter((r) => {
      const matchEquip = !equipFilter || r.equipCode === equipFilter;
      const matchSearch = !searchText ||
        r.resultNo.toLowerCase().includes(searchText.toLowerCase()) ||
        r.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        r.reelLotNo.toLowerCase().includes(searchText.toLowerCase());
      const matchStart = !startDate || r.workDate >= startDate;
      const matchEnd = !endDate || r.workDate <= endDate;
      return matchEquip && matchSearch && matchStart && matchEnd;
    });
  }, [equipFilter, searchText, startDate, endDate]);

  const stats = useMemo(() => {
    const totalGood = filteredResults.reduce((s, r) => s + r.goodQty, 0);
    const totalDefect = filteredResults.reduce((s, r) => s + r.defectQty, 0);
    const totalQty = totalGood + totalDefect;
    const defectRate = totalQty > 0 ? ((totalDefect / totalQty) * 100).toFixed(2) : '0.00';
    return { totalGood, totalDefect, totalQty, defectRate };
  }, [filteredResults]);

  const columns = useMemo<ColumnDef<CuttingResult>[]>(() => [
    { accessorKey: 'resultNo', header: '실적번호', size: 140 },
    { accessorKey: 'workDate', header: '작업일', size: 100 },
    { accessorKey: 'orderNo', header: '작업지시', size: 140 },
    { accessorKey: 'wireName', header: '전선명', size: 110 },
    { accessorKey: 'cutLength', header: '절단(mm)', size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { id: 'strip', header: '탈피(A/B)', size: 90, cell: ({ row }) => `${row.original.stripLengthA}/${row.original.stripLengthB}` },
    { accessorKey: 'goodQty', header: '양품', size: 70, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: '불량', size: 70, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'reelLotNo', header: '릴LOT', size: 140 },
    { accessorKey: 'workerName', header: '작업자', size: 80 },
    { id: 'time', header: '작업시간', size: 110, cell: ({ row }) => <span className="text-text-muted">{row.original.startTime}~{row.original.endTime}</span> },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Scissors className="w-7 h-7 text-primary" />절단 작업실적</h1>
          <p className="text-text-muted mt-1">절단 작업 실적을 조회합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀</Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="총 생산" value={stats.totalQty} icon={Package} color="blue" />
        <StatCard label="양품" value={stats.totalGood} icon={CheckCircle} color="green" />
        <StatCard label="불량" value={stats.totalDefect} icon={XCircle} color="red" />
        <StatCard label="불량률" value={`${stats.defectRate}%`} icon={Clock} color="purple" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="실적번호, 지시번호, 릴LOT 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={equipOptions} value={equipFilter} onChange={setEquipFilter} placeholder="설비" />
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
    </div>
  );
}

export default ResultPage;
