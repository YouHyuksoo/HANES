"use client";

/**
 * @file src/app/(authenticated)/dashboard/page.tsx
 * @description 대시보드 페이지 - 실시간 생산 현황, OEE, 품질 합격률
 *
 * 초보자 가이드:
 * 1. **KPI 카드**: 주요 지표를 카드 형태로 표시
 * 2. **최근 실적**: DataGrid로 테이블 표시
 * 3. **반응형**: 그리드 레이아웃으로 화면 크기에 따라 조정
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Factory,
  Package,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  LayoutDashboard,
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
  changeLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function KpiCard({ title, value, unit, change, changeLabel, icon: Icon, color }: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card padding="sm" className="relative overflow-hidden">
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-text leading-tight">{value}</span>
              {unit && <span className="text-xs text-text-muted">{unit}</span>}
            </div>
            {change !== undefined && (
              <div
                className={`
                  flex items-center gap-1 mt-1 text-xs
                  ${isPositive ? 'text-success' : ''}
                  ${isNegative ? 'text-error' : ''}
                  ${!isPositive && !isNegative ? 'text-text-muted' : ''}
                `}
              >
                {isPositive && <TrendingUp className="w-3 h-3" />}
                {isNegative && <TrendingDown className="w-3 h-3" />}
                <span>
                  {isPositive && '+'}
                  {change}% {changeLabel}
                </span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-md ${color}`}>
            <Icon className="w-5 h-5 text-white" />
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
  const { t } = useTranslation();

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

  // 상태 표시 매핑 (데이터 값 -> 번역 키)
  const statusDisplayMap: Record<string, string> = {
    '대기': t('dashboard.statusWaiting'),
    '진행중': t('dashboard.statusInProgress'),
    '완료': t('dashboard.statusCompleted'),
  };

  // DataGrid 컬럼 정의
  const columns = useMemo<ColumnDef<RecentProduction>[]>(
    () => [
      {
        accessorKey: 'orderNo',
        header: t('dashboard.orderNo'),
      },
      {
        accessorKey: 'partName',
        header: t('dashboard.partName'),
      },
      {
        accessorKey: 'line',
        header: t('dashboard.line'),
      },
      {
        accessorKey: 'planQty',
        header: t('dashboard.planQty'),
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'actualQty',
        header: t('dashboard.actualQty'),
        cell: ({ getValue }) => getValue<number>().toLocaleString(),
      },
      {
        accessorKey: 'progress',
        header: t('dashboard.progress'),
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
        header: t('dashboard.status'),
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
              {statusDisplayMap[status] || status}
            </span>
          );
        },
      },
    ],
    [t, statusDisplayMap]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2"><LayoutDashboard className="w-7 h-7 text-primary" />{t('dashboard.title')}</h1>
        <p className="text-text-muted mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('dashboard.todayProduction')}
          value={1247}
          unit="EA"
          change={12.5}
          changeLabel={t('common.vsYesterday')}
          icon={Factory}
          color="bg-primary"
        />
        <KpiCard
          title={t('dashboard.inventoryStatus')}
          value={8543}
          unit="EA"
          change={-3.2}
          changeLabel={t('common.vsYesterday')}
          icon={Package}
          color="bg-secondary"
        />
        <KpiCard
          title={t('dashboard.qualityPassRate')}
          value="98.7"
          unit="%"
          change={0.5}
          changeLabel={t('common.vsYesterday')}
          icon={Shield}
          color="bg-success"
        />
        <KpiCard
          title={t('dashboard.interlockOccurrence')}
          value={3}
          unit={t('common.count')}
          change={-50}
          changeLabel={t('common.vsYesterday')}
          icon={AlertTriangle}
          color="bg-warning"
        />
      </div>

      {/* Recent Production Table */}
      <Card>
        <CardHeader
          title={t('dashboard.recentOrders')}
          subtitle={t('dashboard.recentOrdersDesc')}
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
