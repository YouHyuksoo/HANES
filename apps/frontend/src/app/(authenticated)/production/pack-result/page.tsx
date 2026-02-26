"use client";

/**
 * @file src/app/(authenticated)/production/pack-result/page.tsx
 * @description 포장실적조회 페이지 - BoxMaster 조회 전용
 *
 * 초보자 가이드:
 * 1. **목적**: 포장 완료된 박스 실적을 조회
 * 2. **BoxMaster**: 박스번호, LOT번호, 포장수량 등 관리
 * 3. API: GET /production/pack-results
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, BoxIcon, Package, Layers, Truck } from 'lucide-react';
import { Card, CardContent, Button, Input, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/services/api';

interface PackResult {
  id: string;
  boxNo: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  packQty: number;
  boxType: string;
  packDate: string;
  packer: string;
  destination: string;
  remark: string;
}

export default function PackResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<PackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (startDate) params.packDateFrom = startDate;
      if (endDate) params.packDateTo = endDate;
      const res = await api.get('/production/pack-results', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    totalBox: data.length,
    totalQty: data.reduce((s, r) => s + r.packQty, 0),
    destinations: new Set(data.map(d => d.destination)).size,
  }), [data]);

  const columns = useMemo<ColumnDef<PackResult>[]>(() => [
    { accessorKey: 'packDate', header: t('production.packResult.packDate'), size: 100, meta: { filterType: 'date' as const } },
    { accessorKey: 'boxNo', header: t('production.packResult.boxNo'), size: 170, meta: { filterType: 'text' as const } },
    { accessorKey: 'lotNo', header: t('production.packResult.lotNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: 'itemName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'packQty', header: t('production.packResult.packQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'boxType', header: t('production.packResult.boxType'), size: 80, meta: { filterType: 'text' as const } },
    { accessorKey: 'packer', header: t('production.packResult.packer'), size: 80, meta: { filterType: 'text' as const } },
    { accessorKey: 'destination', header: t('production.packResult.destination'), size: 140, meta: { filterType: 'text' as const } },
    { accessorKey: 'remark', header: t('production.packResult.remark'), size: 100, meta: { filterType: 'text' as const } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BoxIcon className="w-7 h-7 text-primary" />{t('production.packResult.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.packResult.description')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('production.packResult.totalBox')} value={stats.totalBox} icon={Package} color="blue" />
        <StatCard label={t('production.packResult.totalPackQty')} value={stats.totalQty} icon={Layers} color="green" />
        <StatCard label={t('production.packResult.destination')} value={`${stats.destinations}${t('production.packResult.places')}`} icon={Truck} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.packResult.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.packResult.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
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
