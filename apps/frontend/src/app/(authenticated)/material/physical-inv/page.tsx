"use client";

/**
 * @file src/app/(authenticated)/material/physical-inv/page.tsx
 * @description 재고실사 페이지 - 시스템 재고 vs 실제 재고 대사
 *
 * 초보자 가이드:
 * 1. **실사**: 실제 재고를 세어 시스템 수량과 비교
 * 2. **반영**: 차이가 있으면 InvAdjLog에 기록하고 Stock 수량 업데이트
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Search, RefreshCw, CheckSquare, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface PhysicalInvItem {
  id: string;
  warehouseName: string;
  partCode: string;
  partName: string;
  lotNo: string;
  systemQty: number;
  countedQty: number | null;
  diffQty: number | null;
  unit: string;
  lastCountDate: string | null;
}

const mockData: PhysicalInvItem[] = [
  { id: '1', warehouseName: '자재창고A', partCode: 'WIRE-001', partName: 'AWG18 적색', lotNo: 'L20260201-A01', systemQty: 5000, countedQty: 4950, diffQty: -50, unit: 'M', lastCountDate: '2026-01-15' },
  { id: '2', warehouseName: '자재창고A', partCode: 'CONN-001', partName: '커넥터 6핀', lotNo: 'L20260203-A01', systemQty: 2000, countedQty: 2000, diffQty: 0, unit: 'EA', lastCountDate: '2026-01-15' },
  { id: '3', warehouseName: '자재창고B', partCode: 'TERM-001', partName: '단자 110형', lotNo: 'L20260201-B01', systemQty: 10000, countedQty: null, diffQty: null, unit: 'EA', lastCountDate: null },
  { id: '4', warehouseName: '자재창고B', partCode: 'TERM-002', partName: '단자 250형', lotNo: 'L20260205-B01', systemQty: 8000, countedQty: 7800, diffQty: -200, unit: 'EA', lastCountDate: '2026-01-20' },
  { id: '5', warehouseName: '부자재창고', partCode: 'TUBE-001', partName: '수축튜브 5mm', lotNo: 'L20260210-D01', systemQty: 100000, countedQty: 100500, diffQty: 500, unit: 'M', lastCountDate: '2026-02-01' },
];

function PhysicalInvPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const warehouseOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: '자재창고A', label: t('material.physicalInv.warehouseA') },
    { value: '자재창고B', label: t('material.physicalInv.warehouseB') },
    { value: '부자재창고', label: t('material.physicalInv.subMaterialWarehouse') },
  ], [t]);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      const matchWarehouse = !warehouseFilter || item.warehouseName === warehouseFilter;
      const matchSearch = !searchText || item.partCode.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchWarehouse && matchSearch;
    });
  }, [searchText, warehouseFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    counted: mockData.filter(d => d.countedQty !== null).length,
    mismatch: mockData.filter(d => d.diffQty !== null && d.diffQty !== 0).length,
    matched: mockData.filter(d => d.diffQty === 0).length,
  }), []);

  const columns = useMemo<ColumnDef<PhysicalInvItem>[]>(() => [
    { accessorKey: 'warehouseName', header: t('material.physicalInv.warehouse'), size: 100 },
    { accessorKey: 'partCode', header: t('material.physicalInv.partCode'), size: 100 },
    { accessorKey: 'partName', header: t('material.physicalInv.partName'), size: 130 },
    { accessorKey: 'lotNo', header: 'LOT No.', size: 150 },
    { accessorKey: 'systemQty', header: t('material.physicalInv.systemQty'), size: 100, cell: ({ row }) => <span>{row.original.systemQty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'countedQty', header: t('material.physicalInv.countedQty'), size: 100, cell: ({ getValue, row }) => {
      const v = getValue() as number | null;
      return v !== null ? <span className="font-medium">{v.toLocaleString()} {row.original.unit}</span> : <span className="text-text-muted">-</span>;
    }},
    { accessorKey: 'diffQty', header: t('material.physicalInv.diffQty'), size: 80, cell: ({ getValue }) => {
      const v = getValue() as number | null;
      if (v === null) return <span className="text-text-muted">-</span>;
      if (v === 0) return <span className="text-green-600">0</span>;
      return <span className={v > 0 ? 'text-blue-600 font-medium' : 'text-red-600 font-medium'}>{v > 0 ? '+' : ''}{v}</span>;
    }},
    { accessorKey: 'lastCountDate', header: t('material.physicalInv.lastCountDate'), size: 110, cell: ({ getValue }) => (getValue() as string) || <span className="text-text-muted">-</span> },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" />{t('material.physicalInv.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.physicalInv.subtitle')}</p>
        </div>
        <Button size="sm"><CheckSquare className="w-4 h-4 mr-1" />{t('material.physicalInv.applyCount')}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.physicalInv.stats.total')} value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label={t('material.physicalInv.stats.counted')} value={stats.counted} icon={CheckSquare} color="purple" />
        <StatCard label={t('material.physicalInv.stats.mismatch')} value={stats.mismatch} icon={AlertTriangle} color="red" />
        <StatCard label={t('material.physicalInv.stats.matched')} value={stats.matched} icon={CheckCircle} color="green" />
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.physicalInv.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={warehouseOptions} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default PhysicalInvPage;
