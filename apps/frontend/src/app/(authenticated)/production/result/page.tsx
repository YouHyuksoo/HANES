"use client";

/**
 * @file src/pages/production/ProdResultPage.tsx
 * @description 생산실적 조회 페이지
 *
 * 초보자 가이드:
 * 1. **생산실적**: 작업지시에 대한 실제 생산 결과 기록
 * 2. **LOT**: 동일 조건에서 생산된 제품 묶음 단위
 * 3. **양품/불량**: 검사를 통과한 제품과 불합격 제품 구분
 *
 * 사용 방법:
 * - 날짜, 라인, 공정 필터로 실적 조회
 * - 실적 등록 버튼으로 새 실적 입력
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  RefreshCw,
  Download,
  Calendar,
  Factory,
  Package,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

/** 생산실적 인터페이스 */
interface ProdResult {
  id: string;
  resultNo: string;
  orderNo: string;
  partCode: string;
  partName: string;
  lineName: string;
  processName: string;
  equipName: string;
  workerName: string;
  lotNo: string;
  goodQty: number;
  defectQty: number;
  totalQty: number;
  workDate: string;
  startTime: string;
  endTime: string;
  workHours: number;
}

// Mock 데이터
const mockResults: ProdResult[] = [
  {
    id: '1',
    resultNo: 'PR-20250126-001',
    orderNo: 'JO-20250126-002',
    partCode: 'H-002',
    partName: '서브 하네스 B',
    lineName: 'L2-조립',
    processName: '2차 조립',
    equipName: 'ASSY-001',
    workerName: '김작업',
    lotNo: 'LOT-20250126-001',
    goodQty: 145,
    defectQty: 5,
    totalQty: 150,
    workDate: '2025-01-26',
    startTime: '09:00',
    endTime: '12:00',
    workHours: 3
  },
  {
    id: '2',
    resultNo: 'PR-20250126-002',
    orderNo: 'JO-20250126-004',
    partCode: 'H-005',
    partName: '트렁크 하네스 E',
    lineName: 'L2-조립',
    processName: '2차 조립',
    equipName: 'ASSY-002',
    workerName: '박작업',
    lotNo: 'LOT-20250126-002',
    goodQty: 278,
    defectQty: 2,
    totalQty: 280,
    workDate: '2025-01-26',
    startTime: '08:30',
    endTime: '15:30',
    workHours: 7
  },
  {
    id: '3',
    resultNo: 'PR-20250125-001',
    orderNo: 'JO-20250125-001',
    partCode: 'H-003',
    partName: '도어 하네스 C',
    lineName: 'L1-조립',
    processName: '1차 조립',
    equipName: 'ASSY-003',
    workerName: '이작업',
    lotNo: 'LOT-20250125-001',
    goodQty: 195,
    defectQty: 5,
    totalQty: 200,
    workDate: '2025-01-25',
    startTime: '08:00',
    endTime: '17:00',
    workHours: 9
  },
  {
    id: '4',
    resultNo: 'PR-20250125-002',
    orderNo: 'JO-20250125-002',
    partCode: 'H-001',
    partName: '메인 하네스 A',
    lineName: 'L1-조립',
    processName: '1차 조립',
    equipName: 'ASSY-001',
    workerName: '최작업',
    lotNo: 'LOT-20250125-002',
    goodQty: 98,
    defectQty: 2,
    totalQty: 100,
    workDate: '2025-01-25',
    startTime: '13:00',
    endTime: '18:00',
    workHours: 5
  },
  {
    id: '5',
    resultNo: 'PR-20250124-001',
    orderNo: 'JO-20250124-001',
    partCode: 'H-004',
    partName: '엔진룸 하네스 D',
    lineName: 'L3-조립',
    processName: '특수 조립',
    equipName: 'ASSY-SP1',
    workerName: '정작업',
    lotNo: 'LOT-20250124-001',
    goodQty: 48,
    defectQty: 2,
    totalQty: 50,
    workDate: '2025-01-24',
    startTime: '09:00',
    endTime: '16:00',
    workHours: 7
  },
];

function ProdResultPage() {
  const { t } = useTranslation();
  /** 라인 필터 옵션 */
  const lineOptions = useMemo(() => [
    { value: '', label: t('production.result.allLines') },
    { value: 'L1-조립', label: 'L1-조립' },
    { value: 'L2-조립', label: 'L2-조립' },
    { value: 'L3-조립', label: 'L3-조립' },
  ], [t]);

  /** 공정 필터 옵션 */
  const processOptions = useMemo(() => [
    { value: '', label: t('production.result.allProcesses') },
    { value: '1차 조립', label: '1차 조립' },
    { value: '2차 조립', label: '2차 조립' },
    { value: '특수 조립', label: '특수 조립' },
  ], [t]);

  // 필터 상태
  const [lineFilter, setLineFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  // 모달 상태
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // 등록 폼 상태
  const [formData, setFormData] = useState({
    orderNo: '',
    equipName: '',
    workerName: '',
    lotNo: '',
    goodQty: '',
    defectQty: '',
    startTime: '',
    endTime: '',
    remark: ''
  });

  /** 필터링된 실적 목록 */
  const filteredResults = useMemo(() => {
    return mockResults.filter((result) => {
      const matchLine = !lineFilter || result.lineName === lineFilter;
      const matchProcess = !processFilter || result.processName === processFilter;
      const matchSearch = !searchText ||
        result.resultNo.toLowerCase().includes(searchText.toLowerCase()) ||
        result.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        result.lotNo.toLowerCase().includes(searchText.toLowerCase());
      const matchStartDate = !startDate || result.workDate >= startDate;
      const matchEndDate = !endDate || result.workDate <= endDate;
      return matchLine && matchProcess && matchSearch && matchStartDate && matchEndDate;
    });
  }, [lineFilter, processFilter, searchText, startDate, endDate]);

  /** 불량률 계산 */
  const getDefectRate = (result: ProdResult): string => {
    if (result.totalQty === 0) return '0.0';
    return ((result.defectQty / result.totalQty) * 100).toFixed(1);
  };

  /** 폼 데이터 변경 핸들러 */
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /** 실적 등록 핸들러 */
  const handleSubmit = () => {
    console.log('실적 등록:', formData);
    // 실제로는 API 호출 후 목록 갱신
    setIsRegisterModalOpen(false);
    setFormData({
      orderNo: '',
      equipName: '',
      workerName: '',
      lotNo: '',
      goodQty: '',
      defectQty: '',
      startTime: '',
      endTime: '',
      remark: ''
    });
  };

  /** 통계 데이터 계산 */
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
      {
        accessorKey: 'resultNo',
        header: t('production.result.resultNo'),
        size: 150
      },
      {
        accessorKey: 'workDate',
        header: t('production.result.workDate'),
        size: 100
      },
      {
        accessorKey: 'orderNo',
        header: t('production.result.orderNo'),
        size: 150
      },
      {
        accessorKey: 'partName',
        header: t('production.result.partName'),
        size: 150
      },
      {
        accessorKey: 'equipName',
        header: t('production.result.equipment'),
        size: 100
      },
      {
        accessorKey: 'workerName',
        header: t('production.result.worker'),
        size: 80
      },
      {
        accessorKey: 'lotNo',
        header: t('production.result.lotNo'),
        size: 150
      },
      {
        accessorKey: 'goodQty',
        header: t('production.result.goodQty'),
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-green-600 dark:text-green-400 font-medium">
            {(getValue() as number).toLocaleString()}
          </span>
        )
      },
      {
        accessorKey: 'defectQty',
        header: t('production.result.defectQty'),
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {(getValue() as number).toLocaleString()}
          </span>
        )
      },
      {
        id: 'defectRate',
        header: t('production.result.defectRate'),
        size: 80,
        cell: ({ row }) => {
          const rate = parseFloat(getDefectRate(row.original));
          return (
            <span className={`${rate > 3 ? 'text-red-500' : 'text-text-muted'}`}>
              {rate}%
            </span>
          );
        }
      },
      {
        id: 'workTime',
        header: t('production.result.workTime'),
        size: 120,
        cell: ({ row }) => (
          <span className="text-text-muted">
            {row.original.startTime} ~ {row.original.endTime}
          </span>
        )
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
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> {t('common.excel')}
          </Button>
          <Button size="sm" onClick={() => setIsRegisterModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('production.result.register')}
          </Button>
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
          {/* 검색 필터 */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('production.result.searchPlaceholder')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
            <div className="w-36">
              <Select
                options={lineOptions}
                value={lineFilter}
                onChange={setLineFilter}
                placeholder={t('production.result.line')}
                fullWidth
              />
            </div>
            <div className="w-36">
              <Select
                options={processOptions}
                value={processFilter}
                onChange={setProcessFilter}
                placeholder={t('production.result.processCol')}
                fullWidth
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
              <span className="text-text-muted">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
            <Button variant="secondary">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* 데이터 그리드 */}
          <DataGrid
            data={filteredResults}
            columns={columns}
            pageSize={10}
            onRowClick={(row) => console.log('Selected:', row)}
          />
        </CardContent>
      </Card>

      {/* 실적 등록 모달 */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title={t('production.result.registerTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('production.result.orderNo')}
              options={[
                { value: 'JO-20250126-001', label: 'JO-20250126-001 (메인 하네스 A)' },
                { value: 'JO-20250126-002', label: 'JO-20250126-002 (서브 하네스 B)' },
                { value: 'JO-20250126-003', label: 'JO-20250126-003 (엔진룸 하네스 D)' },
                { value: 'JO-20250126-004', label: 'JO-20250126-004 (트렁크 하네스 E)' },
              ]}
              value={formData.orderNo}
              onChange={(v) => handleFormChange('orderNo', v)}
              fullWidth
            />
            <Select
              label={t('production.result.equipment')}
              options={[
                { value: 'ASSY-001', label: 'ASSY-001' },
                { value: 'ASSY-002', label: 'ASSY-002' },
                { value: 'ASSY-003', label: 'ASSY-003' },
                { value: 'ASSY-SP1', label: 'ASSY-SP1 (특수)' },
              ]}
              value={formData.equipName}
              onChange={(v) => handleFormChange('equipName', v)}
              fullWidth
            />
            <Input
              label={t('production.result.worker')}
              placeholder={t('production.result.workerPlaceholder')}
              value={formData.workerName}
              onChange={(e) => handleFormChange('workerName', e.target.value)}
              fullWidth
            />
            <Input
              label={t('production.result.lotNo')}
              placeholder="LOT-YYYYMMDD-XXX"
              value={formData.lotNo}
              onChange={(e) => handleFormChange('lotNo', e.target.value)}
              fullWidth
            />
            <Input
              label={t('production.result.goodQtyLabel')}
              type="number"
              placeholder="0"
              value={formData.goodQty}
              onChange={(e) => handleFormChange('goodQty', e.target.value)}
              fullWidth
            />
            <Input
              label={t('production.result.defectQtyLabel')}
              type="number"
              placeholder="0"
              value={formData.defectQty}
              onChange={(e) => handleFormChange('defectQty', e.target.value)}
              fullWidth
            />
            <Input
              label={t('production.result.startTime')}
              type="time"
              value={formData.startTime}
              onChange={(e) => handleFormChange('startTime', e.target.value)}
              fullWidth
            />
            <Input
              label={t('production.result.endTime')}
              type="time"
              value={formData.endTime}
              onChange={(e) => handleFormChange('endTime', e.target.value)}
              fullWidth
            />
          </div>
          <Input
            label={t('common.remark')}
            placeholder={t('production.result.remarkPlaceholder')}
            value={formData.remark}
            onChange={(e) => handleFormChange('remark', e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsRegisterModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              <Plus className="w-4 h-4 mr-1" /> {t('common.register')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ProdResultPage;
