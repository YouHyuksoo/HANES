"use client";

/**
 * @file src/pages/material/StockPage.tsx
 * @description 재고현황 조회 페이지 - 창고별/품목별 재고 조회
 *
 * 초보자 가이드:
 * 1. **재고 목록**: 품목별 현재 재고 수량 표시
 * 2. **창고 필터**: 창고별로 재고 필터링
 * 3. **재고 요약**: 총 품목수, 총 수량, 안전재고 미달 등 통계
 */
import { useState, useMemo } from 'react';
import { Warehouse, Search, RefreshCw, Package, AlertTriangle, TrendingUp, Boxes } from 'lucide-react';
import { Card, CardContent, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { StatCard } from '@/components/ui';

/** 재고 인터페이스 */
interface Stock {
  id: string;
  partCode: string;
  partName: string;
  category: string;
  warehouse: string;
  location: string;
  quantity: number;
  safetyStock: number;
  unit: string;
  lastUpdated: string;
}

// Mock 데이터
const mockStocks: Stock[] = [
  { id: '1', partCode: 'WIRE-001', partName: 'AWG18 적색', category: '전선', warehouse: '자재창고A', location: 'A-01-01', quantity: 45000, safetyStock: 10000, unit: 'M', lastUpdated: '2025-01-26 09:00' },
  { id: '2', partCode: 'WIRE-002', partName: 'AWG20 흑색', category: '전선', warehouse: '자재창고A', location: 'A-01-02', quantity: 8000, safetyStock: 10000, unit: 'M', lastUpdated: '2025-01-26 08:30' },
  { id: '3', partCode: 'TERM-001', partName: '단자 110형', category: '단자', warehouse: '자재창고B', location: 'B-02-01', quantity: 50000, safetyStock: 20000, unit: 'EA', lastUpdated: '2025-01-26 10:00' },
  { id: '4', partCode: 'TERM-002', partName: '단자 250형', category: '단자', warehouse: '자재창고B', location: 'B-02-02', quantity: 15000, safetyStock: 20000, unit: 'EA', lastUpdated: '2025-01-25 17:00' },
  { id: '5', partCode: 'CONN-001', partName: '커넥터 6핀', category: '커넥터', warehouse: '자재창고A', location: 'A-03-01', quantity: 12000, safetyStock: 5000, unit: 'EA', lastUpdated: '2025-01-26 11:00' },
  { id: '6', partCode: 'CONN-002', partName: '커넥터 12핀', category: '커넥터', warehouse: '자재창고A', location: 'A-03-02', quantity: 3000, safetyStock: 5000, unit: 'EA', lastUpdated: '2025-01-26 09:30' },
  { id: '7', partCode: 'TUBE-001', partName: '수축튜브 5mm', category: '부자재', warehouse: '부자재창고', location: 'C-01-01', quantity: 100000, safetyStock: 30000, unit: 'M', lastUpdated: '2025-01-25 15:00' },
  { id: '8', partCode: 'TAPE-001', partName: '절연테이프', category: '부자재', warehouse: '부자재창고', location: 'C-01-02', quantity: 500, safetyStock: 200, unit: 'ROLL', lastUpdated: '2025-01-26 08:00' },
];

const warehouseOptions = [
  { value: '', label: '전체 창고' },
  { value: '자재창고A', label: '자재창고A' },
  { value: '자재창고B', label: '자재창고B' },
  { value: '부자재창고', label: '부자재창고' },
];

const categoryOptions = [
  { value: '', label: '전체 분류' },
  { value: '전선', label: '전선' },
  { value: '단자', label: '단자' },
  { value: '커넥터', label: '커넥터' },
  { value: '부자재', label: '부자재' },
];

/** 안전재고 대비 상태 표시 */
function StockLevelBadge({ quantity, safetyStock }: { quantity: number; safetyStock: number }) {
  const ratio = quantity / safetyStock;
  if (ratio < 1) {
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">부족</span>;
  } else if (ratio < 1.5) {
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">주의</span>;
  }
  return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">정상</span>;
}

function StockPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredStocks = useMemo(() => {
    return mockStocks.filter((s) => {
      const matchWarehouse = !warehouseFilter || s.warehouse === warehouseFilter;
      const matchCategory = !categoryFilter || s.category === categoryFilter;
      const matchSearch = !searchText || s.partCode.toLowerCase().includes(searchText.toLowerCase()) || s.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchWarehouse && matchCategory && matchSearch;
    });
  }, [warehouseFilter, categoryFilter, searchText]);

  const stats = useMemo(() => ({
    totalItems: mockStocks.length,
    totalQuantity: mockStocks.reduce((sum, s) => sum + s.quantity, 0),
    belowSafety: mockStocks.filter((s) => s.quantity < s.safetyStock).length,
    warningLevel: mockStocks.filter((s) => s.quantity >= s.safetyStock && s.quantity < s.safetyStock * 1.5).length,
  }), []);

  const columns = useMemo<ColumnDef<Stock>[]>(() => [
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'category', header: '분류', size: 80 },
    { accessorKey: 'warehouse', header: '창고', size: 100 },
    { accessorKey: 'location', header: '위치', size: 80 },
    { accessorKey: 'quantity', header: '재고수량', size: 100, cell: ({ row }) => {
      const stock = row.original;
      return <span className="font-medium">{stock.quantity.toLocaleString()} {stock.unit}</span>;
    }},
    { accessorKey: 'safetyStock', header: '안전재고', size: 100, cell: ({ row }) => {
      const stock = row.original;
      return <span className="text-text-muted">{stock.safetyStock.toLocaleString()} {stock.unit}</span>;
    }},
    { id: 'level', header: '상태', size: 80, cell: ({ row }) => {
      const stock = row.original;
      return <StockLevelBadge quantity={stock.quantity} safetyStock={stock.safetyStock} />;
    }},
    { accessorKey: 'lastUpdated', header: '최종수정', size: 130 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Warehouse className="w-7 h-7 text-primary" />재고현황</h1>
          <p className="text-text-muted mt-1">창고별 자재 재고 현황을 조회합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" /> 새로고침</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="총 품목수" value={stats.totalItems} icon={Package} color="blue" />
        <StatCard label="총 재고수량" value={stats.totalQuantity} icon={Boxes} color="purple" />
        <StatCard label="안전재고 미달" value={stats.belowSafety} icon={AlertTriangle} color="red" />
        <StatCard label="주의 품목" value={stats.warningLevel} icon={TrendingUp} color="yellow" />
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]"><Input placeholder="품목코드, 품목명 검색..." value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
            <div className="w-40"><Select options={warehouseOptions} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth /></div>
            <div className="w-40"><Select options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} fullWidth /></div>
          </div>
          <DataGrid data={filteredStocks} columns={columns} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  );
}

export default StockPage;
