"use client";

/**
 * @file src/pages/consumables/LifePage.tsx
 * @description 소모품 수명 현황 페이지 - 컴팩트 테이블 디자인
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, RotateCcw, Activity, Search } from 'lucide-react';
import { Card, CardContent, Button, ComCodeBadge, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface LifeStatus {
  id: string;
  consumableCode: string;
  name: string;
  category: string;
  currentCount: number;
  expectedLife: number;
  warningCount: number;
  lifePercentage: number;
  remainingLife: number;
  status: 'NORMAL' | 'WARNING' | 'REPLACE';
  lastReplaced: string | null;
  location: string;
}

// 더 많은 테스트 데이터
const mockData: LifeStatus[] = [
  { id: '1', consumableCode: 'TOOL-001', name: '절단날 표준형', category: 'TOOL', currentCount: 10500, expectedLife: 10000, warningCount: 8000, lifePercentage: 105, remainingLife: -500, status: 'REPLACE', lastReplaced: '2024-12-01', location: '커팅라인 A' },
  { id: '2', consumableCode: 'JIG-001', name: '조립지그 001', category: 'JIG', currentCount: 48000, expectedLife: 50000, warningCount: 40000, lifePercentage: 96, remainingLife: 2000, status: 'WARNING', lastReplaced: '2024-10-15', location: '조립라인 B' },
  { id: '3', consumableCode: 'MOLD-001', name: '압착금형 A타입', category: 'MOLD', currentCount: 85000, expectedLife: 100000, warningCount: 80000, lifePercentage: 85, remainingLife: 15000, status: 'WARNING', lastReplaced: '2024-08-20', location: '압착라인 1' },
  { id: '4', consumableCode: 'MOLD-002', name: '압착금형 B타입', category: 'MOLD', currentCount: 45000, expectedLife: 100000, warningCount: 80000, lifePercentage: 45, remainingLife: 55000, status: 'NORMAL', lastReplaced: '2024-11-10', location: '압착라인 2' },
  { id: '5', consumableCode: 'MOLD-003', name: '압착금형 C타입', category: 'MOLD', currentCount: 20000, expectedLife: 100000, warningCount: 80000, lifePercentage: 20, remainingLife: 80000, status: 'NORMAL', lastReplaced: '2025-01-05', location: '압착라인 3' },
  { id: '6', consumableCode: 'TOOL-002', name: '절단날 대형', category: 'TOOL', currentCount: 9800, expectedLife: 10000, warningCount: 8000, lifePercentage: 98, remainingLife: 200, status: 'WARNING', lastReplaced: '2024-11-20', location: '커팅라인 B' },
  { id: '7', consumableCode: 'JIG-002', name: '검사지그 001', category: 'JIG', currentCount: 25000, expectedLife: 50000, warningCount: 40000, lifePercentage: 50, remainingLife: 25000, status: 'NORMAL', lastReplaced: '2024-09-15', location: '검사라인' },
  { id: '8', consumableCode: 'MOLD-004', name: '커넥터금형 A', category: 'MOLD', currentCount: 92000, expectedLife: 100000, warningCount: 80000, lifePercentage: 92, remainingLife: 8000, status: 'WARNING', lastReplaced: '2024-07-10', location: '조립라인 A' },
  { id: '9', consumableCode: 'TOOL-003', name: '스트리퍼블레이드', category: 'TOOL', currentCount: 5000, expectedLife: 15000, warningCount: 12000, lifePercentage: 33, remainingLife: 10000, status: 'NORMAL', lastReplaced: '2025-01-10', location: '커팅라인 C' },
  { id: '10', consumableCode: 'JIG-003', name: '포장지그 001', category: 'JIG', currentCount: 12000, expectedLife: 30000, warningCount: 24000, lifePercentage: 40, remainingLife: 18000, status: 'NORMAL', lastReplaced: '2024-12-20', location: '포장라인' },
  { id: '11', consumableCode: 'MOLD-005', name: '터미널금형 B', category: 'MOLD', currentCount: 100500, expectedLife: 100000, warningCount: 80000, lifePercentage: 100.5, remainingLife: -500, status: 'REPLACE', lastReplaced: '2024-06-01', location: '압착라인 4' },
  { id: '12', consumableCode: 'TOOL-004', name: '크림핑다이', category: 'TOOL', currentCount: 7500, expectedLife: 10000, warningCount: 8000, lifePercentage: 75, remainingLife: 2500, status: 'NORMAL', lastReplaced: '2024-12-15', location: '크림핑라인' },
];

function ConsumableLifePage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchCategory = !categoryFilter || item.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [searchTerm, statusFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    normal: mockData.filter((d) => d.status === 'NORMAL').length,
    warning: mockData.filter((d) => d.status === 'WARNING').length,
    replace: mockData.filter((d) => d.status === 'REPLACE').length,
  }), []);

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REPLACE':
        return <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">교체</span>;
      case 'WARNING':
        return <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">주의</span>;
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">정상</span>;
    }
  };

  const columns = useMemo<ColumnDef<LifeStatus>[]>(
    () => [
      {
        accessorKey: 'status',
        header: '상태',
        size: 60,
        cell: ({ getValue }) => getStatusBadge(getValue() as string),
      },
      {
        accessorKey: 'consumableCode',
        header: t('consumables.master.code'),
        size: 110,
      },
      {
        accessorKey: 'name',
        header: t('consumables.master.name'),
        size: 140,
      },
      {
        accessorKey: 'category',
        header: '구분',
        size: 70,
        cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} />,
      },
      {
        accessorKey: 'location',
        header: '설비/위치',
        size: 110,
      },
      {
        accessorKey: 'lifePercentage',
        header: '수명',
        size: 100,
        cell: ({ row }) => {
          const pct = row.original.lifePercentage;
          return (
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${getProgressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className={`text-xs ${pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-text-muted'}`}>
                {pct}%
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'currentCount',
        header: '현재/기준',
        size: 110,
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.currentCount.toLocaleString()} / {row.original.expectedLife.toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: 'remainingLife',
        header: '잔여',
        size: 70,
        cell: ({ getValue, row }) => {
          const val = getValue() as number;
          return (
            <span className={`text-xs ${val < 0 ? 'text-red-600 font-medium' : 'text-text-muted'}`}>
              {val < 0 ? `+${Math.abs(val).toLocaleString()}` : val.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: 'lastReplaced',
        header: '최근교체',
        size: 90,
        cell: ({ getValue }) => getValue() ? <span className="text-xs text-text-muted">{getValue() as string}</span> : '-',
      },
      {
        id: 'actions',
        header: '관리',
        size: 70,
        cell: ({ row }) => (
          row.original.status === 'REPLACE' ? (
            <Button size="sm" variant="secondary">
              <RotateCcw className="w-3 h-3 mr-1" /> 교체
            </Button>
          ) : null
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-3 animate-fade-in">
      {/* 헤더 - 컴팩트 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-text">{t('consumables.life.title')}</h1>
          <span className="text-xs text-text-muted">{filteredData.length}건</span>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 상태 요약 - 인라인 배지 형태 */}
      <div className="flex gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
          <Activity className="w-3 h-3" /> 전체 {stats.total}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded">
          <CheckCircle className="w-3 h-3" /> 정상 {stats.normal}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded">
          <AlertTriangle className="w-3 h-3" /> 주의 {stats.warning}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded">
          <XCircle className="w-3 h-3" /> 교체 {stats.replace}
        </span>
      </div>

      {/* 필터 바 */}
      <Card className="p-2">
        <div className="flex gap-2">
          <div className="flex-1 min-w-[180px]">
            <Input 
              placeholder="코드, 이름, 위치 검색..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              leftIcon={<Search className="w-3.5 h-3.5" />} 
              fullWidth 
            />
          </div>
          <Select 
            options={[
              { value: '', label: '전체 상태' },
              { value: 'NORMAL', label: '정상' },
              { value: 'WARNING', label: '주의' },
              { value: 'REPLACE', label: '교체필요' },
            ]} 
            value={statusFilter} 
            onChange={setStatusFilter}
          />
          <Select 
            options={[
              { value: '', label: '전체 구분' },
              { value: 'MOLD', label: '금형' },
              { value: 'JIG', label: '지그' },
              { value: 'TOOL', label: '공구' },
            ]} 
            value={categoryFilter} 
            onChange={setCategoryFilter}
          />
          <Button size="sm" variant="secondary" onClick={() => { setSearchTerm(''); setStatusFilter(''); setCategoryFilter(''); }}>
            초기화
          </Button>
        </div>
      </Card>

      {/* 데이터 테이블 - 더 많은 데이터 표시 */}
      <Card className="overflow-hidden">
        <DataGrid 
          data={filteredData} 
          columns={columns} 
          pageSize={15}
        />
      </Card>
    </div>
  );
}

export default ConsumableLifePage;
