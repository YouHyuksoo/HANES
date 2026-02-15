"use client";

/**
 * @file src/app/(authenticated)/production/result/page.tsx
 * @description 생산실적 조회 페이지 (절단/압착/조립/검사/포장 통합 + 작업자 선택)
 *
 * 초보자 가이드:
 * 1. **생산실적**: 작업지시에 대한 실제 생산 결과 기록
 * 2. **공정유형**: CUT(절단), CRIMP(압착), ASSY(조립), INSP(검사), PACK(포장)
 * 3. **작업자 아바타**: 부서별 색상 이니셜 아바타 표시
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, RefreshCw, Download, Calendar,
  Factory, Package, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { useComCodeOptions } from '@/hooks/useComCode';
import { WorkerAvatar } from '@/components/worker/WorkerSelector';

/** 공정 유형 */
type ProcessType = 'CUT' | 'CRIMP' | 'ASSY' | 'INSP' | 'PACK';


/** 생산실적 인터페이스 */
interface ProdResult {
  id: string;
  resultNo: string;
  orderNo: string;
  processType: ProcessType;
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
  startTime: string;
  endTime: string;
  workHours: number;
}

// Mock 데이터 (절단/압착 실적 포함)
const mockResults: ProdResult[] = [
  {
    id: '1', resultNo: 'PR-20250126-001', orderNo: 'JO-20250126-004',
    processType: 'CUT', partCode: 'W-002', partName: 'AVSS 0.3sq 흰색',
    lineName: 'L1-절단', processName: '전선절단', equipName: 'CUT-001',
    workerName: '김작업', workerDept: '절단팀', lotNo: 'LOT-20250126-C01',
    goodQty: 5900, defectQty: 100, totalQty: 6000,
    workDate: '2025-01-26', startTime: '08:30', endTime: '15:30', workHours: 7
  },
  {
    id: '2', resultNo: 'PR-20250126-002', orderNo: 'JO-20250126-002',
    processType: 'CRIMP', partCode: 'T-001', partName: '110형 단자 압착',
    lineName: 'L2-압착', processName: '단자압착', equipName: 'CRM-001',
    workerName: '이압착', workerDept: '압착팀', lotNo: 'LOT-20250126-R01',
    goodQty: 1480, defectQty: 20, totalQty: 1500,
    workDate: '2025-01-26', startTime: '09:00', endTime: '14:00', workHours: 5
  },
  {
    id: '3', resultNo: 'PR-20250126-003', orderNo: 'JO-20250126-003',
    processType: 'ASSY', partCode: 'H-001', partName: '메인 하네스 A',
    lineName: 'L3-조립', processName: '1차 조립', equipName: 'ASSY-001',
    workerName: '박조립', workerDept: '조립팀', lotNo: 'LOT-20250126-A01',
    goodQty: 145, defectQty: 5, totalQty: 150,
    workDate: '2025-01-26', startTime: '09:00', endTime: '12:00', workHours: 3
  },
  {
    id: '4', resultNo: 'PR-20250126-004', orderNo: 'JO-20250126-005',
    processType: 'INSP', partCode: 'H-001', partName: '메인 하네스 A',
    lineName: 'L4-검사', processName: '통전검사', equipName: 'TST-001',
    workerName: '최검사', workerDept: '품질팀', lotNo: 'LOT-20250126-I01',
    goodQty: 148, defectQty: 2, totalQty: 150,
    workDate: '2025-01-26', startTime: '10:00', endTime: '13:00', workHours: 3
  },
  {
    id: '5', resultNo: 'PR-20250125-001', orderNo: 'JO-20250125-001',
    processType: 'ASSY', partCode: 'H-003', partName: '도어 하네스 C',
    lineName: 'L1-조립', processName: '2차 조립', equipName: 'ASSY-003',
    workerName: '박조립', workerDept: '조립팀', lotNo: 'LOT-20250125-A01',
    goodQty: 195, defectQty: 5, totalQty: 200,
    workDate: '2025-01-25', startTime: '08:00', endTime: '17:00', workHours: 9
  },
  {
    id: '6', resultNo: 'PR-20250126-005', orderNo: 'JO-20250126-006',
    processType: 'CRIMP', partCode: 'T-002', partName: '250형 단자 압착',
    lineName: 'L2-압착', processName: '단자압착', equipName: 'CRM-001',
    workerName: '오압착', workerDept: '압착팀', lotNo: 'LOT-20250126-R02',
    goodQty: 3960, defectQty: 40, totalQty: 4000,
    workDate: '2025-01-26', startTime: '08:00', endTime: '14:00', workHours: 6
  },
  {
    id: '7', resultNo: 'PR-20250126-006', orderNo: 'JO-20250126-007',
    processType: 'PACK', partCode: 'H-003', partName: '도어 하네스 C',
    lineName: 'L5-포장', processName: '포장', equipName: 'PACK-001',
    workerName: '정포장', workerDept: '포장팀', lotNo: 'LOT-20250126-P01',
    goodQty: 100, defectQty: 0, totalQty: 100,
    workDate: '2025-01-26', startTime: '13:00', endTime: '15:00', workHours: 2
  },
];

function ProdResultPage() {
  const { t } = useTranslation();

  /** 공정 유형 필터 */
  const comCodeProcessOptions = useComCodeOptions('PROCESS_TYPE');
  const processTypeOptions = useMemo(() => [
    { value: '', label: t('production.order.processAll') },
    ...comCodeProcessOptions.filter(o => ['CUT','CRIMP','ASSY','INSP','PACK'].includes(o.value))
  ], [t, comCodeProcessOptions]);

  /** 라인 필터 옵션 */
  const lineOptions = useMemo(() => [
    { value: '', label: t('production.result.allLines') },
    { value: 'L1-절단', label: 'L1-절단' },
    { value: 'L2-압착', label: 'L2-압착' },
    { value: 'L3-조립', label: 'L3-조립' },
    { value: 'L4-검사', label: 'L4-검사' },
    { value: 'L5-포장', label: 'L5-포장' },
  ], [t]);

  // 필터 상태
  const [processTypeFilter, setProcessTypeFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  /** 필터링된 실적 목록 */
  const filteredResults = useMemo(() => {
    return mockResults.filter((result) => {
      const matchProcessType = !processTypeFilter || result.processType === processTypeFilter;
      const matchLine = !lineFilter || result.lineName === lineFilter;
      const matchSearch = !searchText ||
        result.resultNo.toLowerCase().includes(searchText.toLowerCase()) ||
        result.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        result.lotNo.toLowerCase().includes(searchText.toLowerCase());
      const matchStartDate = !startDate || result.workDate >= startDate;
      const matchEndDate = !endDate || result.workDate <= endDate;
      return matchProcessType && matchLine && matchSearch && matchStartDate && matchEndDate;
    });
  }, [processTypeFilter, lineFilter, searchText, startDate, endDate]);

  const getDefectRate = (result: ProdResult): string => {
    if (result.totalQty === 0) return '0.0';
    return ((result.defectQty / result.totalQty) * 100).toFixed(1);
  };

  /** 통계 */
  const stats = useMemo(() => {
    const totalGood = filteredResults.reduce((sum, r) => sum + r.goodQty, 0);
    const totalDefect = filteredResults.reduce((sum, r) => sum + r.defectQty, 0);
    const totalQty = filteredResults.reduce((sum, r) => sum + r.totalQty, 0);
    const totalHours = filteredResults.reduce((sum, r) => sum + r.workHours, 0);
    const avgDefectRate = totalQty > 0 ? ((totalDefect / totalQty) * 100).toFixed(2) : '0.00';
    return { totalGood, totalDefect, totalQty, totalHours, avgDefectRate };
  }, [filteredResults]);

  /** 컬럼 정의 */
  const columns = useMemo<ColumnDef<ProdResult>[]>(
    () => [
      { accessorKey: 'resultNo', header: t('production.result.resultNo'), size: 150 },
      { accessorKey: 'workDate', header: t('production.result.workDate'), size: 100 },
      {
        accessorKey: 'processType', header: t('production.order.processType'), size: 80,
        cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
      },
      { accessorKey: 'orderNo', header: t('production.result.orderNo'), size: 150 },
      { accessorKey: 'partName', header: t('production.result.partName'), size: 130 },
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
      { accessorKey: 'lotNo', header: t('production.result.lotNo'), size: 150 },
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
        cell: ({ row }) => <span className="text-text-muted">{row.original.startTime} ~ {row.original.endTime}</span>
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
        <Button variant="secondary" size="sm">
          <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
        </Button>
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
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t('production.result.searchPlaceholder')} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="w-32">
              <Select options={processTypeOptions} value={processTypeFilter} onChange={setProcessTypeFilter} placeholder={t('production.order.processType')} fullWidth />
            </div>
            <div className="w-36">
              <Select options={lineOptions} value={lineFilter} onChange={setLineFilter} placeholder={t('production.result.line')} fullWidth />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            </div>
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>

          <DataGrid data={filteredResults} columns={columns} pageSize={10} onRowClick={(row) => console.log('Selected:', row)} />
        </CardContent>
      </Card>

    </div>
  );
}

export default ProdResultPage;
