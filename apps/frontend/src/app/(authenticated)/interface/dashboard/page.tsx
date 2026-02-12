"use client";

/**
 * @file src/pages/interface/DashboardPage.tsx
 * @description ERP 인터페이스 현황 대시보드
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

function InterfaceDashboardPage() {
  const { t } = useTranslation();

  const directionLabels: Record<string, string> = {
    IN: t('interface.dashboard.inbound'),
    OUT: t('interface.dashboard.outbound'),
  };

  const messageTypeLabels: Record<string, string> = {
    JOB_ORDER: t('interface.dashboard.msgJobOrder'),
    PROD_RESULT: t('interface.dashboard.msgProdResult'),
    BOM_SYNC: t('interface.dashboard.msgBomSync'),
    PART_SYNC: t('interface.dashboard.msgPartSync'),
  };
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Activity className="w-7 h-7 text-primary" />{t('interface.dashboard.title')}</h1>
          <p className="text-text-muted mt-1">{t('interface.dashboard.description')}</p>
        </div>
        <Button variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" /> {t('common.refresh')}
        </Button>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t('interface.dashboard.todayTransfer')} value={stats.today} icon={Activity} color="blue" />
        <StatCard label={t('interface.dashboard.success')} value={stats.success} icon={CheckCircle} color="green" />
        <StatCard label={t('interface.dashboard.failed')} value={stats.failed} icon={XCircle} color="red" />
        <StatCard label={t('interface.dashboard.pending')} value={stats.pending} icon={Clock} color="yellow" />
      </div>

      {/* 송수신 현황 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">{t('interface.dashboard.inboundLabel')}</p>
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
                <p className="text-sm text-text-muted">{t('interface.dashboard.outboundLabel')}</p>
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
            <div className="text-sm font-medium text-text mb-3">{t('interface.dashboard.dailyTrend')}</div>
            <div className="h-64">
              <BarChart data={chartData} />
            </div>
          </CardContent>
        </Card>

        {/* 최근 로그 */}
        <Card>
          <CardContent>
            <div className="text-sm font-medium text-text mb-3">{t('interface.dashboard.recentLogs')}</div>
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
                      {log.status === 'SUCCESS' ? t('interface.dashboard.success') : log.status === 'FAIL' ? t('interface.dashboard.failed') : log.status}
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
