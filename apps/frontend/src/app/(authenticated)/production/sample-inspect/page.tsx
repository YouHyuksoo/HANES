"use client";

/**
 * @file src/app/(authenticated)/production/sample-inspect/page.tsx
 * @description 샘플검사이력 페이지 - InspectResult 조회 전용
 *
 * 초보자 가이드:
 * 1. **목적**: 과거 검사 결과 이력을 조회하는 페이지
 * 2. **필터**: 합격/불합격, 기간, 검색어로 필터링
 * 3. **조회 전용**: 데이터 수정 없이 이력만 확인
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, FlaskConical, CheckCircle, XCircle, Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

interface SampleInspect {
  id: string;
  lotNo: string;
  orderNo: string;
  partCode: string;
  partName: string;
  inspectType: string;
  sampleQty: number;
  passQty: number;
  failQty: number;
  passYn: string;
  inspectDate: string;
  inspector: string;
  remark: string;
}

const mockData: SampleInspect[] = [
  { id: '1', lotNo: 'LOT-20250126-001', orderNo: 'JO-20250126-001', partCode: 'H-001', partName: '메인 하네스 A', inspectType: '외관검사', sampleQty: 10, passQty: 10, failQty: 0, passYn: 'Y', inspectDate: '2025-01-26', inspector: '검사원A', remark: '' },
  { id: '2', lotNo: 'LOT-20250126-002', orderNo: 'JO-20250126-002', partCode: 'H-002', partName: '서브 하네스 B', inspectType: '치수검사', sampleQty: 5, passQty: 5, failQty: 0, passYn: 'Y', inspectDate: '2025-01-26', inspector: '검사원B', remark: '' },
  { id: '3', lotNo: 'LOT-20250125-001', orderNo: 'JO-20250125-001', partCode: 'H-003', partName: '도어 하네스 C', inspectType: '전기검사', sampleQty: 10, passQty: 7, failQty: 3, passYn: 'N', inspectDate: '2025-01-25', inspector: '검사원A', remark: '단선 불량' },
  { id: '4', lotNo: 'LOT-20250125-002', orderNo: 'JO-20250125-002', partCode: 'H-004', partName: '엔진룸 하네스 D', inspectType: '외관검사', sampleQty: 8, passQty: 8, failQty: 0, passYn: 'Y', inspectDate: '2025-01-25', inspector: '검사원C', remark: '' },
  { id: '5', lotNo: 'LOT-20250124-001', orderNo: 'JO-20250124-001', partCode: 'H-005', partName: '트렁크 하네스 E', inspectType: '치수검사', sampleQty: 5, passQty: 4, failQty: 1, passYn: 'N', inspectDate: '2025-01-24', inspector: '검사원B', remark: '공차 초과' },
];

function SampleInspectPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [passFilter, setPassFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const passOptions = useMemo(() => [
    { value: '', label: t('production.sampleInspect.allJudgment') },
    { value: 'Y', label: t('production.sampleInspect.pass') },
    { value: 'N', label: t('production.sampleInspect.fail') },
  ], [t]);

  const filteredData = useMemo(() => mockData.filter(item => {
    const matchSearch = !searchText || item.lotNo.toLowerCase().includes(searchText.toLowerCase()) || item.partName.toLowerCase().includes(searchText.toLowerCase());
    const matchPass = !passFilter || item.passYn === passFilter;
    const matchStart = !startDate || item.inspectDate >= startDate;
    const matchEnd = !endDate || item.inspectDate <= endDate;
    return matchSearch && matchPass && matchStart && matchEnd;
  }), [searchText, passFilter, startDate, endDate]);

  const stats = useMemo(() => ({
    total: mockData.length,
    pass: mockData.filter(d => d.passYn === 'Y').length,
    fail: mockData.filter(d => d.passYn === 'N').length,
    passRate: mockData.length > 0 ? Math.round((mockData.filter(d => d.passYn === 'Y').length / mockData.length) * 100) : 0,
  }), []);

  const columns = useMemo<ColumnDef<SampleInspect>[]>(() => [
    { accessorKey: 'inspectDate', header: t('production.sampleInspect.inspectDate'), size: 100 },
    { accessorKey: 'lotNo', header: t('production.sampleInspect.lotNo'), size: 160 },
    { accessorKey: 'orderNo', header: t('production.sampleInspect.orderNo'), size: 160 },
    { accessorKey: 'partCode', header: t('production.sampleInspect.partCode'), size: 100 },
    { accessorKey: 'partName', header: t('production.sampleInspect.partName'), size: 140 },
    { accessorKey: 'inspectType', header: t('production.sampleInspect.inspectType'), size: 90 },
    { accessorKey: 'sampleQty', header: t('production.sampleInspect.sampleQty'), size: 70 },
    { accessorKey: 'passQty', header: t('production.sampleInspect.passQty'), size: 70, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400">{getValue() as number}</span> },
    { accessorKey: 'failQty', header: t('production.sampleInspect.failQty'), size: 70, cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400">{getValue() as number}</span> },
    {
      accessorKey: 'passYn', header: t('production.sampleInspect.judgment'), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === 'Y'
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('production.sampleInspect.pass')}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('production.sampleInspect.fail')}</span>;
      },
    },
    { accessorKey: 'inspector', header: t('production.sampleInspect.inspector'), size: 80 },
    { accessorKey: 'remark', header: t('production.sampleInspect.remark'), size: 120 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FlaskConical className="w-7 h-7 text-primary" />{t('production.sampleInspect.title')}</h1>
          <p className="text-text-muted mt-1">{t('production.sampleInspect.description')}</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t('production.sampleInspect.excelDownload')}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('production.sampleInspect.totalInspect')} value={stats.total} icon={FlaskConical} color="blue" />
        <StatCard label={t('production.sampleInspect.pass')} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t('production.sampleInspect.fail')} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t('production.sampleInspect.passRate')} value={`${stats.passRate}%`} icon={BarChart3} color="purple" />
      </div>

      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t('production.sampleInspect.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-32"><Select options={passOptions} value={passFilter} onChange={setPassFilter} fullWidth /></div>
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

export default SampleInspectPage;
