"use client";

/**
 * @file src/app/(authenticated)/production/wip-stock/page.tsx
 * @description 반제품/제품재고 페이지 - Stock (partType=WIP/FG) 조회 전용
 *
 * 초보자 가이드:
 * 1. **목적**: 반제품(WIP)과 완제품(FG) 재고 현황 조회
 * 2. **partType**: WIP(반제품), FG(완제품) 필터링
 * 3. **조회 전용**: 재고 수량과 위치 확인
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, Warehouse, Package, Box, Layers } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface WipStock {
  id: string;
  partCode: string;
  partName: string;
  partType: 'WIP' | 'FG';
  whCode: string;
  whName: string;
  qty: number;
  unit: string;
  lotNo: string;
  updatedAt: string;
}

const mockData: WipStock[] = [
  { id: '1', partCode: 'WIP-001', partName: '1차 조립 반제품', partType: 'WIP', whCode: 'WH-WIP', whName: 'WIP 창고', qty: 500, unit: 'EA', lotNo: 'LOT-W-001', updatedAt: '2025-01-26' },
  { id: '2', partCode: 'WIP-002', partName: '2차 조립 반제품', partType: 'WIP', whCode: 'WH-WIP', whName: 'WIP 창고', qty: 300, unit: 'EA', lotNo: 'LOT-W-002', updatedAt: '2025-01-26' },
  { id: '3', partCode: 'FG-001', partName: '메인 하네스 A (완제품)', partType: 'FG', whCode: 'WH-FG', whName: '완제품 창고', qty: 200, unit: 'EA', lotNo: 'LOT-F-001', updatedAt: '2025-01-26' },
  { id: '4', partCode: 'FG-002', partName: '서브 하네스 B (완제품)', partType: 'FG', whCode: 'WH-FG', whName: '완제품 창고', qty: 150, unit: 'EA', lotNo: 'LOT-F-002', updatedAt: '2025-01-25' },
  { id: '5', partCode: 'WIP-003', partName: '특수 조립 반제품', partType: 'WIP', whCode: 'WH-WIP', whName: 'WIP 창고', qty: 80, unit: 'EA', lotNo: 'LOT-W-003', updatedAt: '2025-01-25' },
  { id: '6', partCode: 'FG-003', partName: '도어 하네스 C (완제품)', partType: 'FG', whCode: 'WH-FG', whName: '완제품 창고', qty: 400, unit: 'EA', lotNo: 'LOT-F-003', updatedAt: '2025-01-24' },
];

function WipStockPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const typeOptions = useMemo(() => [
    { value: '', label: '전체 유형' },
    { value: 'WIP', label: '반제품 (WIP)' },
    { value: 'FG', label: '완제품 (FG)' },
  ], []);

  const filteredData = useMemo(() => mockData.filter(item => {
    const matchSearch = !searchText || item.partCode.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
    const matchType = !typeFilter || item.partType === typeFilter;
    return matchSearch && matchType;
  }), [searchText, typeFilter]);

  const stats = useMemo(() => ({
    totalItems: mockData.length,
    wipQty: mockData.filter(d => d.partType === 'WIP').reduce((s, r) => s + r.qty, 0),
    fgQty: mockData.filter(d => d.partType === 'FG').reduce((s, r) => s + r.qty, 0),
    totalQty: mockData.reduce((s, r) => s + r.qty, 0),
  }), []);

  const columns = useMemo<ColumnDef<WipStock>[]>(() => [
    { accessorKey: 'partCode', header: '품목코드', size: 120 },
    { accessorKey: 'partName', header: '품목명', size: 180 },
    {
      accessorKey: 'partType', header: '유형', size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'WIP'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">반제품</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">완제품</span>;
      },
    },
    { accessorKey: 'whName', header: '창고', size: 110 },
    { accessorKey: 'qty', header: '재고수량', size: 100, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'unit', header: '단위', size: 60 },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 130 },
    { accessorKey: 'updatedAt', header: '최종 갱신일', size: 110 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Warehouse className="w-7 h-7 text-primary" />반제품/제품 재고</h1>
          <p className="text-text-muted mt-1">반제품(WIP)과 완제품(FG)의 재고 현황을 조회합니다</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀 다운로드</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="품목 수" value={stats.totalItems} icon={Package} color="blue" />
        <StatCard label="반제품 재고" value={stats.wipQty} icon={Box} color="orange" />
        <StatCard label="완제품 재고" value={stats.fgQty} icon={Layers} color="green" />
        <StatCard label="총 재고" value={stats.totalQty} icon={Warehouse} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder="품목코드, 품목명 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default WipStockPage;
