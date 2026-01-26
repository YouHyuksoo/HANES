/**
 * @file src/pages/dashboard/DashboardPage.tsx
 * @description 대시보드 페이지 - 실시간 생산 현황, OEE, 품질 합격률
 *
 * 초보자 가이드:
 * 1. **KPI 카드**: 주요 지표를 카드 형태로 표시
 * 2. **최근 실적**: DataGrid로 테이블 표시
 * 3. **반응형**: 그리드 레이아웃으로 화면 크기에 따라 조정
 */
import { useMemo } from 'react';
import {
  Factory,
  Package,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { ColumnDef } from '@tanstack/react-table';

// KPI 카드 컴포넌트
interface KpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function KpiCard({ title, value, unit, change, icon: Icon, color }: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-text">{value}</span>
              {unit && <span className="text-sm text-text-muted">{unit}</span>}
            </div>
            {change !== undefined && (
              <div
                className={`
                  flex items-center gap-1 mt-2 text-sm
                  ${isPositive ? 'text-success' : ''}
                  ${isNegative ? 'text-error' : ''}
                  ${!isPositive && !isNegative ? 'text-text-muted' : ''}
                `}
              >
                {isPositive && <TrendingUp className="w-4 h-4" />}
                {isNegative && <TrendingDown className="w-4 h-4" />}
                <span>
                  {isPositive && '+'}
                  {change}% 전일 대비
                </span>
              </div>
            )}
          </div>
          <div
            className={`
              p-3 rounded-lg
              ${color}
            `}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 샘플 데이터 타입
interface RecentProduction {
  id: string;
  orderNo: string;
  partName: string;
  line: string;
  planQty: number;
  actualQty: number;
  progress: number;
  status: string;
}

function DashboardPage() {
  // 샘플 데이터
  const recentProductions: RecentProduction[] = [
    {
      id: '1',
      orderNo: 'WO-2026-0126-001',
      partName: '메인 하네스 A타입',
      line: 'LINE-01',
      planQty: 500,
      actualQty: 423,
      progress: 84.6,
      status: '진행중',
    },
    {
      id: '2',
      orderNo: 'WO-2026-0126-002',
      partName: '서브 하네스 B타입',
      line: 'LINE-02',
      planQty: 300,
      actualQty: 300,
      progress: 100,
      status: '완료',
    },
    {
      id: '3',
      orderNo: 'WO-2026-0126-003',
      partName: '엔진룸 하네스',
      line: 'LINE-01',
      planQty: 200,
      actualQty: 0,
      progress: 0,
      status: '대기',
    },
    {
      id: '4',
      orderNo: 'WO-2026-0126-004',
      partName: '도어 하네스 L',
      line: 'LINE-03',
      planQty: 150,
      actualQty: 89,
      progress: 59.3,
      status: '진행중',
    },
  ];

  // DataGrid 컬럼 정의
  const columns = useMemo<ColumnDef<RecentProduction>[]>(
    () => [
      {
        accessorKey: 'orderNo',
        header: '작업지시번호',
      },
      {
        accessorKey: 'partName',
        header: '품목명',
      },
      {
        accessorKey: 'line',
        header: '라인',
      },
      {
        accessorKey: 'planQty',
        header: '계획수량',
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'actualQty',
        header: '실적수량',
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'progress',
        header: '진행률',
        cell: ({ getValue }) => {
          const value = getValue<number>();
          return (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(value, 100)}%` }}
                />
              </div>
              <span className="text-sm">{value.toFixed(1)}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          const colorMap: Record<string, string> = {
            대기: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
            진행중: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
            완료: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
          };
          return (
            <span
              className={`
                inline-flex px-2 py-1 text-xs font-medium rounded-full
                ${colorMap[status] || ''}
              `}
            >
              {status}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">대시보드</h1>
        <p className="text-text-muted mt-1">실시간 생산 현황을 한눈에 확인하세요.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="오늘 생산량"
          value={1247}
          unit="EA"
          change={12.5}
          icon={Factory}
          color="bg-primary"
        />
        <KpiCard
          title="재고 현황"
          value={8543}
          unit="EA"
          change={-3.2}
          icon={Package}
          color="bg-secondary"
        />
        <KpiCard
          title="품질 합격률"
          value="98.7"
          unit="%"
          change={0.5}
          icon={Shield}
          color="bg-success"
        />
        <KpiCard
          title="인터락 발생"
          value={3}
          unit="건"
          change={-50}
          icon={AlertTriangle}
          color="bg-warning"
        />
      </div>

      {/* Recent Production Table */}
      <Card>
        <CardHeader
          title="최근 작업지시"
          subtitle="오늘 진행 중인 작업지시 현황입니다."
        />
        <CardContent>
          <DataGrid
            data={recentProductions}
            columns={columns}
            pageSize={5}
            onRowClick={(row) => console.log('Row clicked:', row)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardPage;
