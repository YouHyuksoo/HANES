"use client";

/**
 * @file src/pages/interface/DashboardPage.tsx
 * @description ERP 인터페이스 현황 대시보드
 */
import { useMemo } from 'react';
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { Card, CardContent, Button, StatCard } from '@/components/ui';
import { BarChart } from '@/components/charts';

interface RecentLog {
  id: string;
  direction: string;
  messageType: string;
  interfaceId: string;
  status: string;
  createdAt: string;
}

const recentLogs: RecentLog[] = [
  { id: '1', direction: 'IN', messageType: 'JOB_ORDER', interfaceId: 'JO-2025-001', status: 'SUCCESS', createdAt: '2025-01-27 10:30:15' },
  { id: '2', direction: 'OUT', messageType: 'PROD_RESULT', interfaceId: 'PR-2025-001', status: 'SUCCESS', createdAt: '2025-01-27 10:25:00' },
  { id: '3', direction: 'IN', messageType: 'BOM_SYNC', interfaceId: 'BOM-001', status: 'SUCCESS', createdAt: '2025-01-27 10:20:00' },
  { id: '4', direction: 'OUT', messageType: 'PROD_RESULT', interfaceId: 'PR-2025-002', status: 'FAIL', createdAt: '2025-01-27 10:15:00' },
  { id: '5', direction: 'IN', messageType: 'PART_SYNC', interfaceId: 'PART-001', status: 'SUCCESS', createdAt: '2025-01-27 10:10:00' },
];

const statusColors: Record<string, string> = {
  SUCCESS: 'text-green-600 dark:text-green-400',
  FAIL: 'text-red-600 dark:text-red-400',
  PENDING: 'text-yellow-600 dark:text-yellow-400',
  RETRY: 'text-blue-600 dark:text-blue-400',
};

const directionLabels: Record<string, string> = {
  IN: '수신',
  OUT: '송신',
};

const messageTypeLabels: Record<string, string> = {
  JOB_ORDER: '작업지시',
  PROD_RESULT: '생산실적',
  BOM_SYNC: 'BOM동기화',
  PART_SYNC: '품목동기화',
};

function InterfaceDashboardPage() {
  const stats = useMemo(() => ({
    total: 1234,
    today: 45,
    success: 1180,
    failed: 12,
    pending: 3,
    inbound: 650,
    outbound: 584,
  }), []);

  const chartData = useMemo(() => [
    { label: '월', value: 270 },
    { label: '화', value: 380 },
    { label: '수', value: 320 },
    { label: '목', value: 420 },
    { label: '금', value: 360 },
    { label: '토', value: 110 },
    { label: '일', value: 70 },
  ], []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Activity className="w-7 h-7 text-primary" />ERP 인터페이스 현황</h1>
          <p className="text-text-muted mt-1">ERP 연동 상태를 모니터링합니다.</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="오늘 전송" value={stats.today} icon={Activity} color="blue" />
        <StatCard label="성공" value={stats.success} icon={CheckCircle} color="green" />
        <StatCard label="실패" value={stats.failed} icon={XCircle} color="red" />
        <StatCard label="대기중" value={stats.pending} icon={Clock} color="yellow" />
      </div>

      {/* 송수신 현황 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">수신 (Inbound)</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.inbound}</p>
                <p className="text-xs text-text-muted mt-1">ERP → MES</p>
              </div>
              <ArrowDownCircle className="w-12 h-12 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">송신 (Outbound)</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.outbound}</p>
                <p className="text-xs text-text-muted mt-1">MES → ERP</p>
              </div>
              <ArrowUpCircle className="w-12 h-12 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 차트 및 최근 로그 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 일별 추이 */}
        <Card>
          <CardContent>
            <div className="text-sm font-medium text-text mb-3">일별 전송 추이</div>
            <div className="h-64">
              <BarChart data={chartData} />
            </div>
          </CardContent>
        </Card>

        {/* 최근 로그 */}
        <Card>
          <CardContent>
            <div className="text-sm font-medium text-text mb-3">최근 전송 로그</div>
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-surface rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {log.direction === 'IN' ? (
                      <ArrowDownCircle className="w-5 h-5 text-blue-500" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-purple-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text">
                          {messageTypeLabels[log.messageType]}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-background text-text-muted">
                          {directionLabels[log.direction]}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{log.interfaceId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${statusColors[log.status]}`}>
                      {log.status === 'SUCCESS' ? '성공' : log.status === 'FAIL' ? '실패' : log.status}
                    </span>
                    <p className="text-xs text-text-muted">{log.createdAt.split(' ')[1]}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default InterfaceDashboardPage;
