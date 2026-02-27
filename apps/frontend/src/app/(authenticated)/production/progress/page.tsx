"use client";

/**
 * @file src/app/(authenticated)/production/progress/page.tsx
 * @description 작업지시 진행현황 대시보드 - 계획수량 vs 실적수량, 진행률, 상태별 현황
 *
 * 초보자 가이드:
 * 1. **목적**: 현재 작업지시들의 진행 상태를 한눈에 파악
 * 2. **StatCard**: 상태별 건수 요약 (대기/진행/완료/전체)
 * 3. API: GET /production/job-orders
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, BarChart3, Clock, Play, CheckCircle, ListChecks, Calendar } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useComCodeOptions } from '@/hooks/useComCode';
import api from '@/services/api';

interface ProgressItem {
  id: string;
  orderNo: string;
  part?: { itemCode?: string; itemName?: string };
  itemCode?: string;
  lineCode: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  progress: number;
  status: string;
  planDate: string;
  priority: number;
}

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
const getToday = () => new Date().toISOString().slice(0, 10);

export default function ProgressPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planDateFrom, setPlanDateFrom] = useState(getToday());
  const [planDateTo, setPlanDateTo] = useState(getToday());

  const comCodeStatusOptions = useComCodeOptions('JOB_ORDER_STATUS');
  const statusOptions = useMemo(() => [
    { value: '', label: t('common.allStatus') }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (planDateFrom) params.planDateFrom = planDateFrom;
      if (planDateTo) params.planDateTo = planDateTo;
      const res = await api.get('/production/job-orders', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, planDateFrom, planDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    waiting: data.filter(d => d.status === 'WAIT' || d.status === 'WAITING').length,
    running: data.filter(d => d.status === 'RUNNING').length,
    done: data.filter(d => d.status === 'DONE').length,
  }), [data]);

  const columns = useMemo<ColumnDef<ProgressItem>[]>(() => [
    { accessorKey: 'orderNo', header: t('production.progress.orderNo'), size: 160, meta: { filterType: 'text' as const } },
    { accessorFn: (row) => row.part?.itemCode, id: 'partCode', header: t('common.partCode'), size: 100, meta: { filterType: 'text' as const } },
    { accessorFn: (row) => row.part?.itemName, id: 'partName', header: t('common.partName'), size: 130, meta: { filterType: 'text' as const } },
    { accessorKey: 'lineCode', header: t('production.progress.line'), size: 90, meta: { filterType: 'text' as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: 'planQty', header: t('production.progress.planQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: 'goodQty', header: t('production.progress.goodQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: 'defectQty', header: t('production.progress.defectQty'), size: 90, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400">{(getValue() as number).toLocaleString()}</span> },
    {
      id: 'progress', header: t('production.progress.progressRate'), size: 140,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const { planQty, goodQty } = row.original;
        const p = planQty > 0 ? Math.min(Math.round((goodQty / planQty) * 100), 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${p >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${p}%` }} />
            </div>
            <span className="text-xs text-text-muted w-10">{p}%</span>
          </div>
        );
      },
    },
    { accessorKey: 'status', header: t('production.progress.status'), size: 90, meta: { filterType: 'multi' as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} /> },
    { accessorKey: 'planDate', header: t('production.progress.planDate'), size: 100, meta: { filterType: 'date' as const } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary" />{t('production.progress.title')}
        </h1>
        <p className="text-text-muted mt-1">{t('production.progress.description')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.progress.totalOrders')} value={stats.total} icon={ListChecks} color="blue" />
        <StatCard label={t('production.progress.statusWaiting')} value={stats.waiting} icon={Clock} color="yellow" />
        <StatCard label={t('production.progress.statusRunning')} value={stats.running} icon={Play} color="green" />
        <StatCard label={t('production.progress.statusDone')} value={stats.done} icon={CheckCircle} color="purple" />
      </div>
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t('production.progress.title')}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t('production.progress.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={planDateFrom} onChange={e => setPlanDateFrom(e.target.value)} leftIcon={<Calendar className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={planDateTo} onChange={e => setPlanDateTo(e.target.value)} leftIcon={<Calendar className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
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
