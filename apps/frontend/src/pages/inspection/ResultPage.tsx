/**
 * @file src/pages/inspection/ResultPage.tsx
 * @description 통전검사 실적 페이지 - PASS/FAIL 검사 결과 조회, 시리얼별 검사 이력
 *
 * 초보자 가이드:
 * 1. **검사 결과 목록**: DataGrid로 시리얼, 결과, 에러코드 표시
 * 2. **통계 카드**: 합격률, 검사건수 실시간 통계
 * 3. **필터링**: 날짜, 결과, 검사기 필터
 */
import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  RefreshCw, Filter, Calendar, CheckCircle, XCircle,
  TrendingUp, Activity, Cpu, Search,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';

// ========================================
// 타입 정의
// ========================================
type InspectResult = 'PASS' | 'FAIL';

interface InspectRecord {
  id: string;
  inspectedAt: string;
  serialNo: string;
  result: InspectResult;
  errorCode?: string;
  errorDesc?: string;
  workOrderNo: string;
  equipmentNo: string;
  voltage: number;
  current: number;
}

// ========================================
// Mock 데이터
// ========================================
const mockInspections: InspectRecord[] = [
  { id: 'INS-001', inspectedAt: '2024-01-15 09:00:15', serialNo: 'SN-2024011500001', result: 'PASS', workOrderNo: 'WO-2024-0115-001', equipmentNo: 'INSP-01', voltage: 12.1, current: 0.52 },
  { id: 'INS-002', inspectedAt: '2024-01-15 09:01:22', serialNo: 'SN-2024011500002', result: 'FAIL', errorCode: 'E001', errorDesc: '1번 핀 단선', workOrderNo: 'WO-2024-0115-001', equipmentNo: 'INSP-01', voltage: 0, current: 0 },
  { id: 'INS-003', inspectedAt: '2024-01-15 09:02:45', serialNo: 'SN-2024011500003', result: 'PASS', workOrderNo: 'WO-2024-0115-002', equipmentNo: 'INSP-02', voltage: 12.0, current: 0.51 },
  { id: 'INS-004', inspectedAt: '2024-01-15 09:04:10', serialNo: 'SN-2024011500004', result: 'PASS', workOrderNo: 'WO-2024-0115-002', equipmentNo: 'INSP-02', voltage: 12.2, current: 0.53 },
  { id: 'INS-005', inspectedAt: '2024-01-15 09:05:30', serialNo: 'SN-2024011500005', result: 'FAIL', errorCode: 'E002', errorDesc: '절연저항 미달', workOrderNo: 'WO-2024-0115-003', equipmentNo: 'INSP-01', voltage: 12.1, current: 1.25 },
  { id: 'INS-006', inspectedAt: '2024-01-15 09:06:15', serialNo: 'SN-2024011500006', result: 'PASS', workOrderNo: 'WO-2024-0115-003', equipmentNo: 'INSP-02', voltage: 11.9, current: 0.50 },
  { id: 'INS-007', inspectedAt: '2024-01-15 09:07:40', serialNo: 'SN-2024011500007', result: 'PASS', workOrderNo: 'WO-2024-0115-004', equipmentNo: 'INSP-01', voltage: 12.0, current: 0.52 },
  { id: 'INS-008', inspectedAt: '2024-01-15 09:09:05', serialNo: 'SN-2024011500008', result: 'FAIL', errorCode: 'E003', errorDesc: '3번 핀 쇼트', workOrderNo: 'WO-2024-0115-004', equipmentNo: 'INSP-02', voltage: 12.1, current: 2.10 },
];

const resultOptions = [
  { value: '', label: '전체 결과' },
  { value: 'PASS', label: '합격' },
  { value: 'FAIL', label: '불합격' },
];

const equipOptions = [
  { value: '', label: '전체 검사기' },
  { value: 'INSP-01', label: 'INSP-01' },
  { value: 'INSP-02', label: 'INSP-02' },
];

// ========================================
// 결과 배지 컴포넌트
// ========================================
function ResultBadge({ result }: { result: InspectResult }) {
  const config = {
    PASS: { icon: CheckCircle, label: '합격', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    FAIL: { icon: XCircle, label: '불합격', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  };
  const { icon: Icon, label, className } = config[result];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${className}`}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

// ========================================
// 메인 컴포넌트
// ========================================
function ResultPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [equipFilter, setEquipFilter] = useState('');
  const [searchSerial, setSearchSerial] = useState('');

  const filteredData = useMemo(() => {
    return mockInspections.filter((r) => {
      if (resultFilter && r.result !== resultFilter) return false;
      if (equipFilter && r.equipmentNo !== equipFilter) return false;
      if (searchSerial && !r.serialNo.toLowerCase().includes(searchSerial.toLowerCase())) return false;
      return true;
    });
  }, [resultFilter, equipFilter, searchSerial]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const passed = filteredData.filter((r) => r.result === 'PASS').length;
    const failed = total - passed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    return { total, passed, failed, passRate };
  }, [filteredData]);

  const columns = useMemo<ColumnDef<InspectRecord>[]>(() => [
    { accessorKey: 'inspectedAt', header: '검사시간', size: 150 },
    { accessorKey: 'serialNo', header: '시리얼번호', size: 170, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: 'result', header: '결과', size: 80, cell: ({ getValue }) => <ResultBadge result={getValue() as InspectResult} /> },
    { accessorKey: 'errorCode', header: '에러코드', size: 80, cell: ({ getValue }) => (getValue() as string) || <span className="text-text-muted">-</span> },
    { accessorKey: 'errorDesc', header: '에러내용', size: 150, cell: ({ getValue }) => (getValue() as string) || <span className="text-text-muted">-</span> },
    { accessorKey: 'voltage', header: '전압(V)', size: 80, cell: ({ getValue }) => <span className="font-mono">{(getValue() as number).toFixed(1)}</span> },
    { accessorKey: 'current', header: '전류(A)', size: 80, cell: ({ getValue }) => <span className="font-mono">{(getValue() as number).toFixed(2)}</span> },
    { accessorKey: 'equipmentNo', header: '검사기', size: 90 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Cpu className="w-7 h-7 text-primary" />통전검사 실적</h1>
          <p className="text-text-muted mt-1">통전검사 결과와 합격률을 확인합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><RefreshCw className="w-4 h-4 mr-1" />새로고침</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><Activity className="w-5 h-5 text-text-muted" /><span className="text-text-muted text-sm">총 검사</span></div><div className="text-2xl font-bold text-text mt-1">{stats.total}건</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" /><span className="text-text-muted text-sm">합격률</span></div><div className="text-2xl font-bold text-green-500 mt-1">{stats.passRate}%</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-text-muted text-sm">합격</span></div><div className="text-2xl font-bold text-green-500 mt-1">{stats.passed}건</div></CardContent></Card>
        <Card padding="sm"><CardContent><div className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" /><span className="text-text-muted text-sm">불합격</span></div><div className="text-2xl font-bold text-red-500 mt-1">{stats.failed}건</div></CardContent></Card>
      </div>

      <Card padding="sm">
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-text-muted" /><span className="text-sm font-medium text-text">필터</span></div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} leftIcon={<Calendar className="w-4 h-4" />} />
            <span className="text-text-muted">~</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Input placeholder="시리얼번호 검색" value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} leftIcon={<Search className="w-4 h-4" />} />
            <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} placeholder="결과" />
            <Select options={equipOptions} value={equipFilter} onChange={setEquipFilter} placeholder="검사기" />
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setSearchSerial(''); setResultFilter(''); setEquipFilter(''); }}>초기화</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="검사 결과 목록" subtitle={`총 ${filteredData.length}건`} />
        <CardContent><DataGrid data={filteredData} columns={columns} pageSize={10} /></CardContent>
      </Card>
    </div>
  );
}

export default ResultPage;
