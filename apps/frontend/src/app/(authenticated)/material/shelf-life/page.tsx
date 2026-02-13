"use client";

/**
 * @file src/app/(authenticated)/material/shelf-life/page.tsx
 * @description 유수명자재 페이지 - 유효기한이 있는 LOT 현황 조회
 *
 * 초보자 가이드:
 * 1. **유수명**: 유효기한(Shelf Life)이 있는 자재
 * 2. **만료 임박**: 30일 이내 만료 예정 자재 경고
 * 3. **만료됨**: 이미 유효기한이 지난 자재
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface ShelfLifeItem {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  currentQty: number;
  unit: string;
  expireDate: string;
  remainDays: number;
  expiryLabel: string;
}

const expiryColors: Record<string, string> = {
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  NEAR_EXPIRY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  VALID: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const mockData: ShelfLifeItem[] = [
  { id: '1', lotNo: 'L20260101-A01', partCode: 'CHEM-001', partName: '접착제 A형', currentQty: 500, unit: 'KG', expireDate: '2026-01-15', remainDays: -29, expiryLabel: 'EXPIRED' },
  { id: '2', lotNo: 'L20260110-B01', partCode: 'CHEM-002', partName: '세척제 B형', currentQty: 200, unit: 'L', expireDate: '2026-03-01', remainDays: 16, expiryLabel: 'NEAR_EXPIRY' },
  { id: '3', lotNo: 'L20260115-C01', partCode: 'SEAL-001', partName: '실리콘 패킹', currentQty: 1000, unit: 'EA', expireDate: '2026-06-30', remainDays: 137, expiryLabel: 'VALID' },
  { id: '4', lotNo: 'L20260120-A02', partCode: 'CHEM-001', partName: '접착제 A형', currentQty: 300, unit: 'KG', expireDate: '2026-02-28', remainDays: 15, expiryLabel: 'NEAR_EXPIRY' },
  { id: '5', lotNo: 'L20260125-D01', partCode: 'TAPE-002', partName: '특수테이프', currentQty: 100, unit: 'ROLL', expireDate: '2026-12-31', remainDays: 321, expiryLabel: 'VALID' },
];

function ShelfLifePage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');

  const expiryOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'EXPIRED', label: t('material.shelfLife.expired') },
    { value: 'NEAR_EXPIRY', label: t('material.shelfLife.nearExpiry') },
    { value: 'VALID', label: t('material.shelfLife.valid') },
  ], [t]);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      const matchExpiry = !expiryFilter || item.expiryLabel === expiryFilter;
      const matchSearch = !searchText || item.lotNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchExpiry && matchSearch;
    });
  }, [searchText, expiryFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    expired: mockData.filter(d => d.expiryLabel === 'EXPIRED').length,
    nearExpiry: mockData.filter(d => d.expiryLabel === 'NEAR_EXPIRY').length,
    valid: mockData.filter(d => d.expiryLabel === 'VALID').length,
  }), []);

  const columns = useMemo<ColumnDef<ShelfLifeItem>[]>(() => [
    { accessorKey: 'lotNo', header: 'LOT No.', size: 160 },
    { accessorKey: 'partCode', header: t('material.shelfLife.partCode'), size: 100 },
    { accessorKey: 'partName', header: t('material.shelfLife.partName'), size: 130 },
    { accessorKey: 'currentQty', header: t('material.shelfLife.currentQty'), size: 110, cell: ({ row }) => <span>{row.original.currentQty.toLocaleString()} {row.original.unit}</span> },
    { accessorKey: 'expireDate', header: t('material.shelfLife.expireDate'), size: 110 },
    { accessorKey: 'remainDays', header: t('material.shelfLife.remainDays'), size: 100, cell: ({ getValue }) => {
      const days = getValue() as number;
      const color = days < 0 ? 'text-red-600' : days <= 30 ? 'text-yellow-600' : 'text-green-600';
      return <span className={`font-medium ${color}`}>{days}{t('material.shelfLife.days')}</span>;
    }},
    { accessorKey: 'expiryLabel', header: t('common.status'), size: 100, cell: ({ getValue }) => {
      const label = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${expiryColors[label] || ''}`}>{label}</span>;
    }},
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Timer className="w-7 h-7 text-primary" />{t('material.shelfLife.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.shelfLife.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.shelfLife.stats.total')} value={stats.total} icon={Clock} color="blue" />
        <StatCard label={t('material.shelfLife.stats.expired')} value={stats.expired} icon={XCircle} color="red" />
        <StatCard label={t('material.shelfLife.stats.nearExpiry')} value={stats.nearExpiry} icon={AlertTriangle} color="yellow" />
        <StatCard label={t('material.shelfLife.stats.valid')} value={stats.valid} icon={CheckCircle} color="green" />
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.shelfLife.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={expiryOptions} value={expiryFilter} onChange={setExpiryFilter} fullWidth /></div>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default ShelfLifePage;
