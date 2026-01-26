/**
 * @file src/pages/quality/InspectPage.tsx
 * @description 검사실적 페이지 - 검사 결과 조회, 합격률 통계
 *
 * 초보자 가이드:
 * 1. **검사 결과 목록**: 시간, 시리얼, 검사유형, 합격여부, 에러코드
 * 2. **합격률 통계**: 일별/유형별 합격률 표시
 * 3. **필터**: 날짜, 합격/불합격 필터링
 */
import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  RefreshCw,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';

// ========================================
// 타입 정의
// ========================================
type InspectType = 'CONTINUITY' | 'INSULATION' | 'HI_POT' | 'VISUAL';
type InspectResult = 'PASS' | 'FAIL';

interface InspectRecord {
  id: string;
  inspectedAt: string;
  serialNo: string;
  inspectType: InspectType;
  result: InspectResult;
  errorCode?: string;
  errorDesc?: string;
  workOrderNo: string;
  equipmentNo: string;
  inspectTime: number; // 검사 소요시간 (초)
}

// ========================================
// Mock 데이터
// ========================================
const mockInspections: InspectRecord[] = [
  {
    id: 'INS-001',
    inspectedAt: '2024-01-15 09:00:15',
    serialNo: 'SN-2024011500001',
    inspectType: 'CONTINUITY',
    result: 'PASS',
    workOrderNo: 'WO-2024-0115-001',
    equipmentNo: 'INS-01',
    inspectTime: 3,
  },
  {
    id: 'INS-002',
    inspectedAt: '2024-01-15 09:01:22',
    serialNo: 'SN-2024011500002',
    inspectType: 'CONTINUITY',
    result: 'FAIL',
    errorCode: 'E001',
    errorDesc: '1번 핀 단선',
    workOrderNo: 'WO-2024-0115-001',
    equipmentNo: 'INS-01',
    inspectTime: 5,
  },
  {
    id: 'INS-003',
    inspectedAt: '2024-01-15 09:02:45',
    serialNo: 'SN-2024011500003',
    inspectType: 'INSULATION',
    result: 'PASS',
    workOrderNo: 'WO-2024-0115-002',
    equipmentNo: 'INS-02',
    inspectTime: 8,
  },
  {
    id: 'INS-004',
    inspectedAt: '2024-01-15 09:04:10',
    serialNo: 'SN-2024011500004',
    inspectType: 'HI_POT',
    result: 'PASS',
    workOrderNo: 'WO-2024-0115-002',
    equipmentNo: 'INS-02',
    inspectTime: 12,
  },
  {
    id: 'INS-005',
    inspectedAt: '2024-01-15 09:05:30',
    serialNo: 'SN-2024011500005',
    inspectType: 'VISUAL',
    result: 'FAIL',
    errorCode: 'V002',
    errorDesc: '외관 스크래치',
    workOrderNo: 'WO-2024-0115-003',
    equipmentNo: 'INS-03',
    inspectTime: 6,
  },
  {
    id: 'INS-006',
    inspectedAt: '2024-01-15 09:06:15',
    serialNo: 'SN-2024011500006',
    inspectType: 'CONTINUITY',
    result: 'PASS',
    workOrderNo: 'WO-2024-0115-003',
    equipmentNo: 'INS-01',
    inspectTime: 4,
  },
  {
    id: 'INS-007',
    inspectedAt: '2024-01-15 09:07:40',
    serialNo: 'SN-2024011500007',
    inspectType: 'CONTINUITY',
    result: 'PASS',
    workOrderNo: 'WO-2024-0115-004',
    equipmentNo: 'INS-01',
    inspectTime: 3,
  },
  {
    id: 'INS-008',
    inspectedAt: '2024-01-15 09:09:05',
    serialNo: 'SN-2024011500008',
    inspectType: 'INSULATION',
    result: 'FAIL',
    errorCode: 'I003',
    errorDesc: '절연저항 미달',
    workOrderNo: 'WO-2024-0115-004',
    equipmentNo: 'INS-02',
    inspectTime: 10,
  },
];

const inspectTypeOptions = [
  { value: '', label: '전체 검사유형' },
  { value: 'CONTINUITY', label: '통전검사' },
  { value: 'INSULATION', label: '절연검사' },
  { value: 'HI_POT', label: '고전압검사' },
  { value: 'VISUAL', label: '외관검사' },
];

const resultOptions = [
  { value: '', label: '전체 결과' },
  { value: 'PASS', label: '합격' },
  { value: 'FAIL', label: '불합격' },
];

const inspectTypeLabels: Record<InspectType, string> = {
  CONTINUITY: '통전검사',
  INSULATION: '절연검사',
  HI_POT: '고전압검사',
  VISUAL: '외관검사',
};

// ========================================
// 결과 배지 컴포넌트
// ========================================
function ResultBadge({ result }: { result: InspectResult }) {
  const config = {
    PASS: {
      icon: CheckCircle,
      label: '합격',
      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    },
    FAIL: {
      icon: XCircle,
      label: '불합격',
      className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
  };

  const { icon: Icon, label, className } = config[result];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ========================================
// 검사유형 배지 컴포넌트
// ========================================
function TypeBadge({ type }: { type: InspectType }) {
  const config: Record<InspectType, string> = {
    CONTINUITY: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    INSULATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    HI_POT: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    VISUAL: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${config[type]}`}>
      {inspectTypeLabels[type]}
    </span>
  );
}

// ========================================
// 메인 컴포넌트
// ========================================
function InspectPage() {
  // 상태 관리
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [inspectType, setInspectType] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [searchSerial, setSearchSerial] = useState('');

  // 필터링된 데이터
  const filteredInspections = useMemo(() => {
    return mockInspections.filter((record) => {
      if (inspectType && record.inspectType !== inspectType) return false;
      if (resultFilter && record.result !== resultFilter) return false;
      if (searchSerial && !record.serialNo.toLowerCase().includes(searchSerial.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [inspectType, resultFilter, searchSerial]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = filteredInspections.length;
    const passed = filteredInspections.filter((r) => r.result === 'PASS').length;
    const failed = filteredInspections.filter((r) => r.result === 'FAIL').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    const avgTime =
      total > 0
        ? (filteredInspections.reduce((sum, r) => sum + r.inspectTime, 0) / total).toFixed(1)
        : '0.0';

    // 검사유형별 통계
    const byType: Record<InspectType, { total: number; passed: number }> = {
      CONTINUITY: { total: 0, passed: 0 },
      INSULATION: { total: 0, passed: 0 },
      HI_POT: { total: 0, passed: 0 },
      VISUAL: { total: 0, passed: 0 },
    };

    filteredInspections.forEach((r) => {
      byType[r.inspectType].total += 1;
      if (r.result === 'PASS') byType[r.inspectType].passed += 1;
    });

    return { total, passed, failed, passRate, avgTime, byType };
  }, [filteredInspections]);

  // 컬럼 정의
  const columns = useMemo<ColumnDef<InspectRecord>[]>(
    () => [
      {
        accessorKey: 'inspectedAt',
        header: '검사시간',
        size: 150,
      },
      {
        accessorKey: 'serialNo',
        header: '시리얼번호',
        size: 170,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'inspectType',
        header: '검사유형',
        size: 100,
        cell: ({ getValue }) => <TypeBadge type={getValue() as InspectType} />,
      },
      {
        accessorKey: 'result',
        header: '결과',
        size: 80,
        cell: ({ getValue }) => <ResultBadge result={getValue() as InspectResult} />,
      },
      {
        accessorKey: 'errorCode',
        header: '에러코드',
        size: 80,
        cell: ({ getValue }) => {
          const code = getValue() as string | undefined;
          return code ? (
            <span className="text-red-500 font-mono">{code}</span>
          ) : (
            <span className="text-text-muted">-</span>
          );
        },
      },
      {
        accessorKey: 'errorDesc',
        header: '에러내용',
        size: 150,
        cell: ({ getValue }) => {
          const desc = getValue() as string | undefined;
          return desc || <span className="text-text-muted">-</span>;
        },
      },
      {
        accessorKey: 'inspectTime',
        header: '소요시간',
        size: 80,
        cell: ({ getValue }) => (
          <span className="font-mono">{getValue() as number}초</span>
        ),
      },
      {
        accessorKey: 'equipmentNo',
        header: '설비',
        size: 80,
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">검사실적</h1>
          <p className="text-text-muted mt-1">검사 결과와 합격률 통계를 확인합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="sm">
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-text-muted" />
              <span className="text-text-muted text-sm">총 검사</span>
            </div>
            <div className="text-2xl font-bold text-text mt-1">{stats.total}건</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-text-muted text-sm">합격률</span>
            </div>
            <div className="text-2xl font-bold text-green-500 mt-1">{stats.passRate}%</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-text-muted text-sm">합격</span>
            </div>
            <div className="text-2xl font-bold text-green-500 mt-1">{stats.passed}건</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-text-muted text-sm">불합격</span>
            </div>
            <div className="text-2xl font-bold text-red-500 mt-1">{stats.failed}건</div>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="text-text-muted text-sm">평균시간</span>
            </div>
            <div className="text-2xl font-bold text-text mt-1">{stats.avgTime}초</div>
          </CardContent>
        </Card>
      </div>

      {/* 검사유형별 합격률 */}
      <Card>
        <CardHeader title="검사유형별 합격률" subtitle="유형별 검사 성과" />
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.entries(stats.byType) as [InspectType, { total: number; passed: number }][]).map(
              ([type, data]) => {
                const rate = data.total > 0 ? ((data.passed / data.total) * 100).toFixed(1) : '0.0';
                return (
                  <div key={type} className="p-4 bg-background rounded-lg">
                    <div className="mb-2">
                      <TypeBadge type={type} />
                    </div>
                    <div className="text-2xl font-bold text-text">{rate}%</div>
                    <div className="text-sm text-text-muted">
                      {data.passed}/{data.total}건
                    </div>
                    {/* 프로그레스바 */}
                    <div className="mt-2 h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* 필터 영역 */}
      <Card padding="sm">
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text">필터</span>
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
            <span className="text-text-muted">~</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Input
              placeholder="시리얼번호 검색"
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
            />
            <Select
              options={inspectTypeOptions}
              value={inspectType}
              onChange={setInspectType}
              placeholder="검사유형"
            />
            <Select
              options={resultOptions}
              value={resultFilter}
              onChange={setResultFilter}
              placeholder="결과"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setSearchSerial('');
                setInspectType('');
                setResultFilter('');
              }}
            >
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 그리드 */}
      <Card>
        <CardHeader
          title="검사 결과 목록"
          subtitle={`총 ${filteredInspections.length}건`}
        />
        <CardContent>
          <DataGrid
            data={filteredInspections}
            columns={columns}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default InspectPage;
