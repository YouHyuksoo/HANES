"use client";

/**
 * @file src/app/(authenticated)/production/progress/page.tsx
 * @description 작업지시 진행현황 대시보드 - 계획수량 vs 실적수량, 진행률, 상태별 현황
 *
 * 초보자 가이드:
 * 1. **목적**: 현재 작업지시들의 진행 상태를 한눈에 파악
 * 2. **StatCard**: 상태별 건수 요약 (대기/진행/완료/전체)
 * 3. **DataGrid**: 작업지시별 상세 진행률 표시
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, BarChart3, Clock, Play, CheckCircle, ListChecks } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ProgressItem {
  id: string;
  orderNo: string;
  partCode: string;
  partName: string;
  lineCode: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  progress: number;
  status: string;
  planDate: string;
  priority: number;
}

const mockData: ProgressItem[] = [
  { id: '1', orderNo: 'JO-20250126-001', partCode: 'H-001', partName: '메인 하네스 A', lineCode: 'L1', planQty: 500, goodQty: 0, defectQty: 0, progress: 0, status: 'WAITING', planDate: '2025-01-26', priority: 1 },
  { id: '2', orderNo: 'JO-20250126-002', partCode: 'H-002', partName: '서브 하네스 B', lineCode: 'L2', planQty: 300, goodQty: 150, defectQty: 5, progress: 50, status: 'RUNNING', planDate: '2025-01-26', priority: 2 },
  { id: '3', orderNo: 'JO-20250125-001', partCode: 'H-003', partName: '도어 하네스 C', lineCode: 'L1', planQty: 200, goodQty: 200, defectQty: 5, progress: 100, status: 'DONE', planDate: '2025-01-25', priority: 3 },
  { id: '4', orderNo: 'JO-20250126-003', partCode: 'H-004', partName: '엔진룸 하네스 D', lineCode: 'L3', planQty: 100, goodQty: 40, defectQty: 2, progress: 40, status: 'RUNNING', planDate: '2025-01-26', priority: 2 },
  { id: '5', orderNo: 'JO-20250126-004', partCode: 'H-005', partName: '트렁크 하네스 E', lineCode: 'L2', planQty: 400, goodQty: 280, defectQty: 2, progress: 70, status: 'RUNNING', planDate: '2025-01-26', priority: 1 },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    WAITING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PAUSED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    DONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    CANCELED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labelMap: Record<string, string> = { WAITING: '대기', RUNNING: '진행', PAUSED: '일시정지', DONE: '완료', CANCELED: '취소' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || ''}`}>{labelMap[status] || status}</span>;
};

function ProgressPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const statusOptions = useMemo(() => [
    { value: '', label: '전체 상태' },
    { value: 'WAITING', label: '대기' },
    { value: 'RUNNING', label: '진행중' },
    { value: 'DONE', label: '완료' },
  ], []);

  const filteredData = useMemo(() => mockData.filter(item => {
    const matchSearch = !searchText || item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter || item.status === statusFilter;
    return matchSearch && matchStatus;
  }), [searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    waiting: mockData.filter(d => d.status === 'WAITING').length,
    running: mockData.filter(d => d.status === 'RUNNING').length,
    done: mockData.filter(d => d.status === 'DONE').length,
  }), []);

  const columns = useMemo<ColumnDef<ProgressItem>[]>(() => [
    { accessorKey: 'orderNo', header: '작업지시번호', size: 160 },
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 150 },
    { accessorKey: 'lineCode', header: '라인', size: 70 },
    { accessorKey: 'planQty', header: '계획수량', size: 90, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'goodQty', header: '양품수량', size: 90, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: '불량수량', size: 90, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400">{(getValue() as number).toLocaleString()}</span> },
    {
      id: 'progress', header: '진행률', size: 140,
      cell: ({ row }) => {
        const p = row.original.progress;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${p >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${Math.min(p, 100)}%` }} />
            </div>
            <span className="text-xs text-text-muted w-10">{p}%</span>
          </div>
        );
      },
    },
    { accessorKey: 'status', header: '상태', size: 90, cell: ({ getValue }) => statusBadge(getValue() as string) },
    { accessorKey: 'planDate', header: '계획일', size: 100 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary" />작업지시 진행현황
        </h1>
        <p className="text-text-muted mt-1">작업지시별 계획 대비 실적 진행률을 확인합니다</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="전체 작업" value={stats.total} icon={ListChecks} color="blue" />
        <StatCard label="대기" value={stats.waiting} icon={Clock} color="yellow" />
        <StatCard label="진행중" value={stats.running} icon={Play} color="green" />
        <StatCard label="완료" value={stats.done} icon={CheckCircle} color="purple" />
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="지시번호, 품목명 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-36"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default ProgressPage;
