"use client";

/**
 * @file src/app/(authenticated)/material/iqc-history/page.tsx
 * @description IQC 이력조회 페이지 - 수입검사 결과 조회 전용
 *
 * 초보자 가이드:
 * 1. **IQC**: Incoming Quality Control (수입검사)
 * 2. **결과**: PASS(합격), FAIL(불합격)
 * 3. **유형**: INITIAL(초도검사), RETEST(재검사)
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Search, RefreshCw, CheckCircle, XCircle, FileText, BarChart3 } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { createPartColumns } from '@/lib/table-utils';
import { ColumnDef } from '@tanstack/react-table';

interface IqcHistoryItem {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  inspectType: string;
  result: string;
  inspectorName: string;
  inspectDate: string;
}

const resultColors: Record<string, string> = {
  PASS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  FAIL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const mockData: IqcHistoryItem[] = [
  { id: '1', lotNo: 'L20260201-A01', partCode: 'WIRE-001', partName: 'AWG18 적색', inspectType: 'INITIAL', result: 'PASS', inspectorName: '김검사', inspectDate: '2026-02-01 10:30' },
  { id: '2', lotNo: 'L20260201-B01', partCode: 'TERM-001', partName: '단자 110형', inspectType: 'INITIAL', result: 'PASS', inspectorName: '이검사', inspectDate: '2026-02-01 11:00' },
  { id: '3', lotNo: 'L20260203-A01', partCode: 'CONN-001', partName: '커넥터 6핀', inspectType: 'INITIAL', result: 'FAIL', inspectorName: '김검사', inspectDate: '2026-02-03 14:00' },
  { id: '4', lotNo: 'L20260203-A01', partCode: 'CONN-001', partName: '커넥터 6핀', inspectType: 'RETEST', result: 'PASS', inspectorName: '박검사', inspectDate: '2026-02-04 09:00' },
  { id: '5', lotNo: 'L20260205-B01', partCode: 'WIRE-002', partName: 'AWG20 흑색', inspectType: 'INITIAL', result: 'FAIL', inspectorName: '이검사', inspectDate: '2026-02-05 16:00' },
];

function IqcHistoryPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const resultOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'PASS', label: 'PASS' },
    { value: 'FAIL', label: 'FAIL' },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'INITIAL', label: 'INITIAL' },
    { value: 'RETEST', label: 'RETEST' },
  ], [t]);

  const filteredData = useMemo(() => {
    return mockData.filter(item => {
      const matchResult = !resultFilter || item.result === resultFilter;
      const matchType = !typeFilter || item.inspectType === typeFilter;
      const matchSearch = !searchText || item.lotNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
      return matchResult && matchType && matchSearch;
    });
  }, [searchText, resultFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    pass: mockData.filter(d => d.result === 'PASS').length,
    fail: mockData.filter(d => d.result === 'FAIL').length,
    passRate: Math.round((mockData.filter(d => d.result === 'PASS').length / mockData.length) * 100),
  }), []);

  const columns = useMemo<ColumnDef<IqcHistoryItem>[]>(() => [
    { accessorKey: 'lotNo', header: 'LOT No.', size: 160 },
    ...createPartColumns<IqcHistoryItem>(t),
    { accessorKey: 'inspectType', header: t('material.iqcHistory.inspectType'), size: 100, cell: ({ getValue }) => <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">{getValue() as string}</span> },
    { accessorKey: 'result', header: t('material.iqcHistory.result'), size: 80, cell: ({ getValue }) => {
      const r = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${resultColors[r] || ''}`}>{r}</span>;
    }},
    { accessorKey: 'inspectorName', header: t('material.iqcHistory.inspector'), size: 100 },
    { accessorKey: 'inspectDate', header: t('material.iqcHistory.inspectDate'), size: 140 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-primary" />{t('material.iqcHistory.title')}</h1>
          <p className="text-text-muted mt-1">{t('material.iqcHistory.subtitle')}</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('material.iqcHistory.stats.total')} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t('material.iqcHistory.stats.pass')} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t('material.iqcHistory.stats.fail')} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t('material.iqcHistory.stats.passRate')} value={`${stats.passRate}%`} icon={BarChart3} color="purple" />
      </div>
      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1"><Input placeholder={t('material.iqcHistory.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-32"><Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth /></div>
          <div className="w-32"><Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth /></div>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default IqcHistoryPage;
