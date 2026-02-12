"use client";

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
  Calendar,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Clock,
  Search,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, ComCodeBadge, StatCard } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useComCodeOptions } from '@/hooks/useComCode';

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



// ========================================
// 메인 컴포넌트
// ========================================
function InspectPage() {
  const comCodeResultOptions = useComCodeOptions('INSPECT_RESULT');
  const resultOptions = [{ value: '', label: '전체 결과' }, ...comCodeResultOptions];
  const comCodeTypeOptions = useComCodeOptions('INSPECT_TYPE');
  const inspectTypeOptions = [{ value: '', label: '전체 검사유형' }, ...comCodeTypeOptions];
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
        cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_TYPE" code={getValue() as string} />,
      },
      {
        accessorKey: 'result',
        header: '결과',
        size: 80,
        cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_RESULT" code={getValue() as string} />,
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Activity className="w-7 h-7 text-primary" />검사실적</h1>
          <p className="text-text-muted mt-1">검사 결과와 합격률 통계를 확인합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="총 검사" value={`${stats.total}건`} icon={Activity} color="blue" />
        <StatCard label="합격률" value={`${stats.passRate}%`} icon={TrendingUp} color="green" />
        <StatCard label="합격" value={`${stats.passed}건`} icon={CheckCircle} color="green" />
        <StatCard label="불합격" value={`${stats.failed}건`} icon={XCircle} color="red" />
        <StatCard label="평균 소요" value={`${stats.avgTime}초`} icon={Clock} color="yellow" />
      </div>

      {/* 검사유형별 합격률 */}
      <Card>
        <CardContent>
          <div className="text-sm font-medium text-text mb-3">검사유형별 합격률</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.entries(stats.byType) as [InspectType, { total: number; passed: number }][]).map(
              ([type, data]) => {
                const rate = data.total > 0 ? ((data.passed / data.total) * 100).toFixed(1) : '0.0';
                return (
                  <div key={type} className="p-4 bg-background rounded-lg">
                    <div className="mb-2">
                      <ComCodeBadge groupCode="INSPECT_TYPE" code={type} />
                    </div>
                    <div className="text-lg font-bold leading-tight text-text">{rate}%</div>
                    <div className="text-sm text-text-muted">
                      {data.passed}/{data.total}건
                    </div>
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

      {/* 필터 + 데이터 그리드 */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder="시리얼번호 검색..." value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-text-muted">~</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Select options={inspectTypeOptions} value={inspectType} onChange={setInspectType} placeholder="검사유형" />
            <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} placeholder="결과" />
            <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
          </div>
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
