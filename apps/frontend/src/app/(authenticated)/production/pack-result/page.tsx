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
import { Search, RefreshCw, BoxIcon, Package, Layers, CheckCircle } from 'lucide-react';
import { Card, CardContent, Button, Input, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/services/api';

interface PackResult {
  boxNo: string;
  itemCode: string;
  itemName: string;
  packQty: number;
  status: string;
  palletNo: string;
  oqcStatus: string;
  packer: string;
  packDate: string;
  closeTime: string;
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
      if (startDate) params.dateFrom = startDate;
      if (endDate) params.dateTo = endDate;
      const res = await api.get('/production/pack-result', { params });
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
    totalQty: data.reduce((s, r) => s + (r.packQty ?? 0), 0),
    closedBox: data.filter(d => d.status === 'CLOSED').length,
  }), [data]);

  const columns = useMemo<ColumnDef<PackResult>[]>(() => [
    { accessorKey: 'packDate', header: t('production.packResult.packDate'), size: 120,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? '-' },
    { accessorKey: 'boxNo', header: t('production.packResult.boxNo'), size: 170,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: 'itemCode', header: t('common.partCode'), size: 120,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: 'itemName', header: t('common.partName'), size: 160,
      meta: { filterType: 'text' as const } },
    { accessorKey: 'packQty', header: t('production.packResult.packQty'), size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number)?.toLocaleString()}</span> },
    { accessorKey: 'status', header: t('common.status'), size: 90,
      meta: { filterType: 'multi' as const } },
    { accessorKey: 'palletNo', header: t('production.packResult.palletNo'), size: 130,
      meta: { filterType: 'text' as const } },
    { accessorKey: 'oqcStatus', header: 'OQC', size: 90,
      meta: { filterType: 'multi' as const } },
    { accessorKey: 'packer', header: t('production.packResult.packer'), size: 90,
      meta: { filterType: 'text' as const } },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BoxIcon className="w-7 h-7 text-primary" />{t('production.packResult.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.packResult.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        <StatCard label={t('production.packResult.totalBox')} value={stats.totalBox} icon={Package} color="blue" />
        <StatCard label={t('production.packResult.totalPackQty')} value={stats.totalQty} icon={Layers} color="green" />
        <StatCard label={t('production.packResult.closedBox')} value={stats.closedBox} icon={CheckCircle} color="purple" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
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
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
