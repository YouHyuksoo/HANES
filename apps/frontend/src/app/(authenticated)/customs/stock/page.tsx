"use client";

/**
 * @file src/pages/customs/StockPage.tsx
 * @description 보세 자재 재고 현황 페이지
 */
import { useState, useMemo } from 'react';
import { RefreshCw, Download, Search, Package } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface CustomsLot {
  id: string;
  entryNo: string;
  lotNo: string;
  partCode: string;
  partName: string;
  origin: string;
  qty: number;
  usedQty: number;
  remainQty: number;
  status: string;
  declarationDate: string;
}

const mockData: CustomsLot[] = [
  {
    id: '1',
    entryNo: 'IMP20250125001',
    lotNo: 'LOT250125-001',
    partCode: 'WIRE-001',
    partName: '전선 AWG22 적색',
    origin: 'CN',
    qty: 1000,
    usedQty: 300,
    remainQty: 700,
    status: 'PARTIAL',
    declarationDate: '2025-01-25',
  },
  {
    id: '2',
    entryNo: 'IMP20250125001',
    lotNo: 'LOT250125-002',
    partCode: 'WIRE-002',
    partName: '전선 AWG22 흑색',
    origin: 'CN',
    qty: 500,
    usedQty: 0,
    remainQty: 500,
    status: 'BONDED',
    declarationDate: '2025-01-25',
  },
  {
    id: '3',
    entryNo: 'IMP20250124001',
    lotNo: 'LOT250124-001',
    partCode: 'TERM-001',
    partName: '단자 250형',
    origin: 'JP',
    qty: 5000,
    usedQty: 5000,
    remainQty: 0,
    status: 'RELEASED',
    declarationDate: '2025-01-24',
  },
];

const statusColors: Record<string, string> = {
  BONDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  PARTIAL: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  RELEASED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

const statusLabels: Record<string, string> = {
  BONDED: '보세중',
  PARTIAL: '일부사용',
  RELEASED: '반출완료',
};

function CustomsStockPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filteredData = useMemo(() => {
    return mockData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.lotNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = !statusFilter || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [searchTerm, statusFilter]);

  const columns = useMemo<ColumnDef<CustomsLot>[]>(
    () => [
      { accessorKey: 'entryNo', header: '수입신고번호', size: 140 },
      { accessorKey: 'lotNo', header: 'LOT번호', size: 130 },
      { accessorKey: 'partCode', header: '품목코드', size: 100 },
      { accessorKey: 'partName', header: '품목명', size: 150 },
      { accessorKey: 'origin', header: '원산지', size: 70 },
      {
        accessorKey: 'qty',
        header: '입고수량',
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'usedQty',
        header: '사용수량',
        size: 90,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'remainQty',
        header: '잔여수량',
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return (
            <span className={val === 0 ? 'text-text-muted' : 'font-semibold text-primary'}>
              {val.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: '상태',
        size: 90,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>
          );
        },
      },
      { accessorKey: 'declarationDate', header: '신고일', size: 100 },
    ],
    []
  );

  // 통계 계산
  const stats = useMemo(() => {
    const bondedLots = mockData.filter((d) => d.status !== 'RELEASED');
    const totalRemain = bondedLots.reduce((sum, d) => sum + d.remainQty, 0);
    return {
      totalLots: mockData.length,
      bondedLots: bondedLots.length,
      totalRemain,
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />보세 자재 재고</h1>
          <p className="text-text-muted mt-1">보세 자재의 LOT별 재고 현황을 조회합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> 엑셀 다운로드
          </Button>
          <Button variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="전체 LOT" value={stats.totalLots} icon={Package} color="blue" />
        <StatCard label="보세중 LOT" value={stats.bondedLots} icon={Package} color="purple" />
        <StatCard label="잔여수량 합계" value={stats.totalRemain.toLocaleString()} icon={Package} color="green" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="LOT번호, 품목 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={[{ value: '', label: '전체 상태' }, { value: 'BONDED', label: '보세중' }, { value: 'PARTIAL', label: '일부사용' }, { value: 'RELEASED', label: '반출완료' }]} value={statusFilter} onChange={setStatusFilter} placeholder="상태" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
          <DataGrid data={filteredData} columns={columns} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  );
}

export default CustomsStockPage;
