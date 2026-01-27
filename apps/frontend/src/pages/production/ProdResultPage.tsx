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

/** 라인 필터 옵션 */
const lineOptions = [
  { value: '', label: '전체 라인' },
  { value: 'L1-조립', label: 'L1-조립' },
  { value: 'L2-조립', label: 'L2-조립' },
  { value: 'L3-조립', label: 'L3-조립' },
];

/** 공정 필터 옵션 */
const processOptions = [
  { value: '', label: '전체 공정' },
  { value: '1차 조립', label: '1차 조립' },
  { value: '2차 조립', label: '2차 조립' },
  { value: '특수 조립', label: '특수 조립' },
];

function ProdResultPage() {
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
        header: '실적번호',
        size: 150
      },
      {
        accessorKey: 'workDate',
        header: '작업일자',
        size: 100
      },
      {
        accessorKey: 'orderNo',
        header: '작업지시',
        size: 150
      },
      {
        accessorKey: 'partName',
        header: '품목명',
        size: 150
      },
      {
        accessorKey: 'equipName',
        header: '설비',
        size: 100
      },
      {
        accessorKey: 'workerName',
        header: '작업자',
        size: 80
      },
      {
        accessorKey: 'lotNo',
        header: 'LOT번호',
        size: 150
      },
      {
        accessorKey: 'goodQty',
        header: '양품',
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-green-600 dark:text-green-400 font-medium">
            {(getValue() as number).toLocaleString()}
          </span>
        )
      },
      {
        accessorKey: 'defectQty',
        header: '불량',
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {(getValue() as number).toLocaleString()}
          </span>
        )
      },
      {
        id: 'defectRate',
        header: '불량률',
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
        header: '작업시간',
        size: 120,
        cell: ({ row }) => (
          <span className="text-text-muted">
            {row.original.startTime} ~ {row.original.endTime}
          </span>
        )
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Factory className="w-7 h-7 text-primary" />
            생산실적 조회
          </h1>
          <p className="text-text-muted mt-1">생산 작업 실적을 조회하고 등록합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> 엑셀 다운로드
          </Button>
          <Button size="sm" onClick={() => setIsRegisterModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> 실적 등록
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="총 생산" value={stats.totalQty.toLocaleString()} icon={Package} color="blue" />
        <StatCard label="양품" value={stats.totalGood.toLocaleString()} icon={CheckCircle} color="green" />
        <StatCard label="불량 (불량률)" value={`${stats.totalDefect.toLocaleString()} (${stats.avgDefectRate}%)`} icon={XCircle} color="red" />
        <StatCard label="총 작업시간" value={`${stats.totalHours}시간`} icon={Clock} color="purple" />
      </div>

      {/* 메인 카드 */}
      <Card>
        <CardContent>
          {/* 검색 필터 */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="실적번호, 작업지시, LOT번호 검색..."
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
                placeholder="라인"
                fullWidth
              />
            </div>
            <div className="w-36">
              <Select
                options={processOptions}
                value={processFilter}
                onChange={setProcessFilter}
                placeholder="공정"
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
        title="생산실적 등록"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="작업지시"
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
              label="설비"
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
              label="작업자"
              placeholder="작업자명"
              value={formData.workerName}
              onChange={(e) => handleFormChange('workerName', e.target.value)}
              fullWidth
            />
            <Input
              label="LOT번호"
              placeholder="LOT-YYYYMMDD-XXX"
              value={formData.lotNo}
              onChange={(e) => handleFormChange('lotNo', e.target.value)}
              fullWidth
            />
            <Input
              label="양품수량"
              type="number"
              placeholder="0"
              value={formData.goodQty}
              onChange={(e) => handleFormChange('goodQty', e.target.value)}
              fullWidth
            />
            <Input
              label="불량수량"
              type="number"
              placeholder="0"
              value={formData.defectQty}
              onChange={(e) => handleFormChange('defectQty', e.target.value)}
              fullWidth
            />
            <Input
              label="시작시간"
              type="time"
              value={formData.startTime}
              onChange={(e) => handleFormChange('startTime', e.target.value)}
              fullWidth
            />
            <Input
              label="종료시간"
              type="time"
              value={formData.endTime}
              onChange={(e) => handleFormChange('endTime', e.target.value)}
              fullWidth
            />
          </div>
          <Input
            label="비고"
            placeholder="특이사항 입력"
            value={formData.remark}
            onChange={(e) => handleFormChange('remark', e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsRegisterModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit}>
              <Plus className="w-4 h-4 mr-1" /> 등록
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ProdResultPage;
