"use client";

/**
 * @file src/app/(authenticated)/production/pack-result/page.tsx
 * @description 포장실적조회 페이지 - BoxMaster 조회 전용
 *
 * 초보자 가이드:
 * 1. **목적**: 포장 완료된 박스 실적을 조회
 * 2. **BoxMaster**: 박스번호, LOT번호, 포장수량 등 관리
 * 3. **조회 전용**: 포장 결과만 확인하는 페이지
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, BoxIcon, Package, Calendar, Layers, Truck } from 'lucide-react';
import { Card, CardContent, Button, Input, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface PackResult {
  id: string;
  boxNo: string;
  lotNo: string;
  partCode: string;
  partName: string;
  packQty: number;
  boxType: string;
  packDate: string;
  packer: string;
  destination: string;
  remark: string;
}

const mockData: PackResult[] = [
  { id: '1', boxNo: 'BOX-20250126-001', lotNo: 'LOT-20250126-001', partCode: 'H-001', partName: '메인 하네스 A', packQty: 50, boxType: 'A형', packDate: '2025-01-26', packer: '포장원A', destination: '현대자동차 울산', remark: '' },
  { id: '2', boxNo: 'BOX-20250126-002', lotNo: 'LOT-20250126-001', partCode: 'H-001', partName: '메인 하네스 A', packQty: 50, boxType: 'A형', packDate: '2025-01-26', packer: '포장원A', destination: '현대자동차 울산', remark: '' },
  { id: '3', boxNo: 'BOX-20250126-003', lotNo: 'LOT-20250126-002', partCode: 'H-002', partName: '서브 하네스 B', packQty: 30, boxType: 'B형', packDate: '2025-01-26', packer: '포장원B', destination: '기아 광주', remark: '' },
  { id: '4', boxNo: 'BOX-20250125-001', lotNo: 'LOT-20250125-001', partCode: 'H-003', partName: '도어 하네스 C', packQty: 40, boxType: 'A형', packDate: '2025-01-25', packer: '포장원A', destination: '현대자동차 아산', remark: '특별 포장' },
  { id: '5', boxNo: 'BOX-20250125-002', lotNo: 'LOT-20250125-002', partCode: 'H-004', partName: '엔진룸 하네스 D', packQty: 25, boxType: 'C형', packDate: '2025-01-25', packer: '포장원C', destination: '현대자동차 울산', remark: '' },
];

function PackResultPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredData = useMemo(() => mockData.filter(item => {
    const matchSearch = !searchText || item.boxNo.toLowerCase().includes(searchText.toLowerCase()) || item.lotNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
    const matchStart = !startDate || item.packDate >= startDate;
    const matchEnd = !endDate || item.packDate <= endDate;
    return matchSearch && matchStart && matchEnd;
  }), [searchText, startDate, endDate]);

  const stats = useMemo(() => ({
    totalBox: mockData.length,
    totalQty: mockData.reduce((s, r) => s + r.packQty, 0),
    destinations: new Set(mockData.map(d => d.destination)).size,
  }), []);

  const columns = useMemo<ColumnDef<PackResult>[]>(() => [
    { accessorKey: 'packDate', header: '포장일', size: 100 },
    { accessorKey: 'boxNo', header: '박스번호', size: 170 },
    { accessorKey: 'lotNo', header: 'LOT번호', size: 160 },
    { accessorKey: 'partCode', header: '품목코드', size: 100 },
    { accessorKey: 'partName', header: '품목명', size: 140 },
    { accessorKey: 'packQty', header: '포장수량', size: 90, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'boxType', header: '박스유형', size: 80 },
    { accessorKey: 'packer', header: '포장자', size: 80 },
    { accessorKey: 'destination', header: '납품처', size: 140 },
    { accessorKey: 'remark', header: '비고', size: 100 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BoxIcon className="w-7 h-7 text-primary" />포장실적조회</h1>
          <p className="text-text-muted mt-1">포장 완료된 박스 실적을 조회합니다</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀 다운로드</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="총 박스 수" value={stats.totalBox} icon={Package} color="blue" />
        <StatCard label="포장 총수량" value={stats.totalQty} icon={Layers} color="green" />
        <StatCard label="납품처" value={`${stats.destinations}곳`} icon={Truck} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder="박스번호, LOT번호, 품목명 검색..." value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
            <span className="text-text-muted">~</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
          </div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default PackResultPage;
