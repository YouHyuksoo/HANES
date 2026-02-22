"use client";

/**
 * @file src/app/(authenticated)/production/result/page.tsx
 * @description 생산실적 조회 페이지 (절단/압착/조립/검사/포장 통합 + 작업자 선택)
 *
 * 초보자 가이드:
 * 1. **생산실적**: 작업지시에 대한 실제 생산 결과 기록
 * 2. **공정유형**: CUT(절단), CRIMP(압착), ASSY(조립), INSP(검사), PACK(포장)
 * 3. **작업자 아바타**: 부서별 색상 이니셜 아바타 표시
 * 4. API: GET /production/prod-results
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw,
  Factory, Package, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useComCodeOptions } from '@/hooks/useComCode';
import { WorkerAvatar } from '@/components/worker/WorkerSelector';
import api from '@/services/api';

/** 생산실적 인터페이스 */
interface ProdResult {
  id: string;
  resultNo: string;
  orderNo: string;
  processType: string;
  partCode: string;
  partName: string;
  lineName: string;
  processName: string;
  equipName: string;
  workerName: string;
  workerDept: string;
  lotNo: string;
  goodQty: number;
  defectQty: number;
  totalQty: number;
  workDate: string;
  startAt: string;
  endAt: string;
  workHours: number;
}

export default function ProdResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProdResult[]>([]);
  const [loading, setLoading] = useState(false);

  /** 공정 유형 필터 */
  const comCodeProcessOptions = useComCodeOptions('PROCESS_TYPE');
  const processTypeOptions = useMemo(() => [
    { value: '', label: t('production.order.processAll') },
    ...comCodeProcessOptions.filter(o => ['CUT','CRIMP','ASSY','INSP','PACK'].includes(o.value))
  ], [t, comCodeProcessOptions]);

  // 필터 상태
  const [processTypeFilter, setProcessTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '5000' };
      if (searchText) params.search = searchText;
      if (processTypeFilter) params.processCode = processTypeFilter;
      if (startDate) params.startTimeFrom = startDate;
      if (endDate) params.startTimeTo = endDate;
      const res = await api.get('/production/prod-results', { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, processTypeFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getDefectRate = (result: ProdResult): string => {
    if (result.totalQty === 0) return '0.0';
    return ((result.defectQty / result.totalQty) * 100).toFixed(1);
  };

  /** 통계 */
  const stats = useMemo(() => {
    const totalGood = data.reduce((sum, r) => sum + r.goodQty, 0);
    const totalDefect = data.reduce((sum, r) => sum + r.defectQty, 0);
    const totalQty = data.reduce((sum, r) => sum + r.totalQty, 0);
    const totalHours = data.reduce((sum, r) => sum + r.workHours, 0);
    const avgDefectRate = totalQty > 0 ? ((totalDefect / totalQty) * 100).toFixed(2) : '0.00';
    return { totalGood, totalDefect, totalQty, totalHours, avgDefectRate };
  }, [data]);

  /** 컬럼 정의 */
  const columns = useMemo<ColumnDef<ProdResult>[]>(
    () => [
      { accessorKey: 'resultNo', header: t('production.result.resultNo'), size: 150, meta: { filterType: 'text' as const } },
      { accessorKey: 'workDate', header: t('production.result.workDate'), size: 100 },
      {
        accessorKey: 'processType', header: t('production.order.processType'), size: 80,
        cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
      },
      { accessorKey: 'orderNo', header: t('production.result.orderNo'), size: 150, meta: { filterType: 'text' as const } },
      { accessorKey: 'partName', header: t('production.result.partName'), size: 130, meta: { filterType: 'text' as const } },
      { accessorKey: 'equipName', header: t('production.result.equipment'), size: 90 },
      {
        accessorKey: 'workerName', header: t('production.result.worker'), size: 110,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <WorkerAvatar name={row.original.workerName} dept={row.original.workerDept} size="sm" />
            <span className="text-sm">{row.original.workerName}</span>
          </div>
        )
      },
      { accessorKey: 'lotNo', header: t('production.result.lotNo'), size: 150, meta: { filterType: 'text' as const } },
      {
        accessorKey: 'goodQty', header: t('production.result.goodQty'), size: 70,
        cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{(getValue() as number).toLocaleString()}</span>
      },
      {
        accessorKey: 'defectQty', header: t('production.result.defectQty'), size: 70,
        cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">{(getValue() as number).toLocaleString()}</span>
      },
      {
        id: 'defectRate', header: t('production.result.defectRate'), size: 80,
        cell: ({ row }) => {
          const rate = parseFloat(getDefectRate(row.original));
          return <span className={`${rate > 3 ? 'text-red-500' : 'text-text-muted'}`}>{rate}%</span>;
        }
      },
      {
        id: 'workTime', header: t('production.result.workTime'), size: 120,
        cell: ({ row }) => <span className="text-text-muted">{row.original.startAt} ~ {row.original.endAt}</span>
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Factory className="w-7 h-7 text-primary" />
            {t('production.result.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('production.result.description')}</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('production.result.totalProduction')} value={stats.totalQty.toLocaleString()} icon={Package} color="blue" />
        <StatCard label={t('production.result.goodQty')} value={stats.totalGood.toLocaleString()} icon={CheckCircle} color="green" />
        <StatCard label={t('production.result.defectWithRate')} value={`${stats.totalDefect.toLocaleString()} (${stats.avgDefectRate}%)`} icon={XCircle} color="red" />
        <StatCard label={t('production.result.totalWorkHours')} value={`${stats.totalHours}${t('common.hours')}`} icon={Clock} color="purple" />
      </div>

      {/* 메인 카드 */}
      <Card>
        <CardContent>
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
            enableExport exportFileName={t('production.result.title')}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t('production.result.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-32 flex-shrink-0">
                  <Select options={processTypeOptions} value={processTypeFilter} onChange={setProcessTypeFilter} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
                </div>
                <Button variant="secondary" onClick={fetchData}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            } />
        </CardContent>
      </Card>
    </div>
  );
}
