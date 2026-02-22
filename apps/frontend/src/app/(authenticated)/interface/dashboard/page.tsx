"use client";

/**
 * @file src/app/(authenticated)/interface/dashboard/page.tsx
 * @description ERP 인터페이스 현황 대시보드
 *
 * 초보자 가이드:
 * 1. **주요 지표**: 오늘 전송건수, 성공/실패/대기 StatCard 표시
 * 2. **송수신 현황**: Inbound/Outbound 건수 카드
 * 3. **일별 추이**: BarChart로 최근 7일 전송 추이
 * 4. **최근 로그**: 최근 인터페이스 로그 리스트
 * 5. API: GET /interface/dashboard/stats, GET /interface/dashboard/chart, GET /interface/logs
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, CheckCircle, XCircle, Clock, Activity } from "lucide-react";
import { Card, CardContent, Button, StatCard } from "@/components/ui";
import { BarChart } from "@/components/charts";
import api from "@/services/api";

interface RecentLog {
  id: string;
  direction: string;
  messageType: string;
  interfaceId: string;
  status: string;
  createdAt: string;
}

interface DashboardStats {
  total: number;
  today: number;
  success: number;
  failed: number;
  pending: number;
  inbound: number;
  outbound: number;
}

const statusColors: Record<string, string> = {
  SUCCESS: "text-green-600 dark:text-green-400",
  FAIL: "text-red-600 dark:text-red-400",
  PENDING: "text-yellow-600 dark:text-yellow-400",
  RETRY: "text-blue-600 dark:text-blue-400",
};

export default function InterfaceDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({ total: 0, today: 0, success: 0, failed: 0, pending: 0, inbound: 0, outbound: 0 });
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(false);

  const directionLabels: Record<string, string> = useMemo(() => ({
    IN: t("interface.dashboard.inbound"),
    OUT: t("interface.dashboard.outbound"),
  }), [t]);

  const messageTypeLabels: Record<string, string> = useMemo(() => ({
    JOB_ORDER: t("interface.dashboard.msgJobOrder"),
    PROD_RESULT: t("interface.dashboard.msgProdResult"),
    BOM_SYNC: t("interface.dashboard.msgBomSync"),
    PART_SYNC: t("interface.dashboard.msgPartSync"),
  }), [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, chartRes, logsRes] = await Promise.all([
        api.get("/interface/dashboard/stats"),
        api.get("/interface/dashboard/chart"),
        api.get("/interface/logs", { params: { limit: "5", sort: "createdAt:desc" } }),
      ]);
      setStats(statsRes.data?.data ?? { total: 0, today: 0, success: 0, failed: 0, pending: 0, inbound: 0, outbound: 0 });
      setChartData(chartRes.data?.data ?? []);
      setRecentLogs(logsRes.data?.data ?? []);
    } catch {
      /* keep current state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Activity className="w-7 h-7 text-primary" />{t("interface.dashboard.title")}</h1>
          <p className="text-text-muted mt-1">{t("interface.dashboard.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
        </Button>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("interface.dashboard.todayTransfer")} value={stats.today} icon={Activity} color="blue" />
        <StatCard label={t("interface.dashboard.success")} value={stats.success} icon={CheckCircle} color="green" />
        <StatCard label={t("interface.dashboard.failed")} value={stats.failed} icon={XCircle} color="red" />
        <StatCard label={t("interface.dashboard.pending")} value={stats.pending} icon={Clock} color="yellow" />
      </div>

      {/* 송수신 현황 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">{t("interface.dashboard.inboundLabel")}</p>
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
                <p className="text-sm text-text-muted">{t("interface.dashboard.outboundLabel")}</p>
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
        <Card>
          <CardContent>
            <div className="text-sm font-medium text-text mb-3">{t("interface.dashboard.dailyTrend")}</div>
            <div className="h-64">
              <BarChart data={chartData} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-sm font-medium text-text mb-3">{t("interface.dashboard.recentLogs")}</div>
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    {log.direction === "IN" ? (
                      <ArrowDownCircle className="w-5 h-5 text-blue-500" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-purple-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text">{messageTypeLabels[log.messageType] || log.messageType}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-background text-text-muted">{directionLabels[log.direction] || log.direction}</span>
                      </div>
                      <p className="text-xs text-text-muted">{log.interfaceId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${statusColors[log.status] || ""}`}>
                      {log.status === "SUCCESS" ? t("interface.dashboard.success") : log.status === "FAIL" ? t("interface.dashboard.failed") : log.status}
                    </span>
                    <p className="text-xs text-text-muted">{log.createdAt?.split(" ")[1] || ""}</p>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">{t("common.noData")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
