"use client";

/**
 * @file src/app/(authenticated)/production/wip-stock/page.tsx
 * @description 반제품/제품재고 페이지 - Stock (partType=WIP/FG) 조회 전용
 *
 * 초보자 가이드:
 * 1. **목적**: 반제품(WIP)과 완제품(FG) 재고 현황 조회
 * 2. **partType**: WIP(반제품), FG(완제품) 필터링
 * 3. API: GET /production/wip-stock
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Warehouse, Package, Box, Layers } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/services/api';

interface WipStock {
  id: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  whCode: string;
  whName: string;
  qty: number;
  unit: string;
  lotNo: string;
  updatedAt: string;
}

export default function WipStockPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WipStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const typeOptions = useMemo(() => [
    { value: '', label: t('production.wipStock.allType') },
    { value: 'WIP', label: t('production.wipStock.wip') },
    { value: 'FG', label: t('production.wipStock.fg') },
  ], [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (typeFilter) params.itemType = typeFilter;
      const res = await api.get('/production/wip-stock', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    totalItems: data.length,
    wipQty: data.filter(d => d.itemType === 'WIP').reduce((s, r) => s + r.qty, 0),
    fgQty: data.filter(d => d.itemType === 'FG').reduce((s, r) => s + r.qty, 0),
    totalQty: data.reduce((s, r) => s + r.qty, 0),
  }), [data]);

  const columns = useMemo<ColumnDef<WipStock>[]>(() => [
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: 'itemName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'itemType', header: t('production.wipStock.type'), size: 90,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'WIP'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{t('production.wipStock.wipLabel')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('production.wipStock.fgLabel')}</span>;
      },
    },
    { accessorKey: 'whName', header: t('production.wipStock.warehouse'), size: 110, meta: { filterType: 'text' as const } },
    { accessorKey: 'qty', header: t('production.wipStock.stockQty'), size: 100, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'unit', header: t('production.wipStock.unit'), size: 60, meta: { filterType: 'text' as const } },
    { accessorKey: 'lotNo', header: t('production.wipStock.lotNo'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'updatedAt', header: t('production.wipStock.updatedAt'), size: 110, meta: { filterType: 'date' as const } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Warehouse className="w-7 h-7 text-primary" />{t('production.wipStock.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.wipStock.description')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.wipStock.itemCount')} value={stats.totalItems} icon={Package} color="blue" />
        <StatCard label={t('production.wipStock.wipStock')} value={stats.wipQty} icon={Box} color="orange" />
        <StatCard label={t('production.wipStock.fgStock')} value={stats.fgQty} icon={Layers} color="green" />
        <StatCard label={t('production.wipStock.totalStock')} value={stats.totalQty} icon={Warehouse} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.wipStock.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.wipStock.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
