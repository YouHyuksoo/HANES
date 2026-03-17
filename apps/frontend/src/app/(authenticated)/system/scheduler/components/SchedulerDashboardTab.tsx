"use client";

/**
 * @file system/scheduler/components/SchedulerDashboardTab.tsx
 * @description 스케줄러 대시보드 탭 - 통계카드 + 차트 + 최근 실패 테이블
 *
 * 초보자 가이드:
 * 1. **StatCard 4개**: 오늘 실행, 성공, 실패, 성공률
 * 2. **7일 추이 LineChart**: 성공/실패 일별 트렌드 (recharts)
 * 3. **작업별 BarChart**: 작업별 성공/실패 스택 바 차트
 * 4. **최근 실패**: 5건 테이블
 * 5. API: GET /scheduler/logs/summary
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Activity, CheckCircle, XCircle, TrendingUp, RefreshCw } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, Button, StatCard } from "@/components/ui";
import api from "@/services/api";

/** 대시보드 요약 데이터 */
interface DashboardSummary {
  todayTotal: number;
  todaySuccess: number;
  todayFail: number;
  successRate: number;
  trend: { date: string; success: number; fail: number }[];
  jobStats: { jobCode: string; jobName: string; success: number; fail: number }[];
  recentFails: {
    jobCode: string; startTime: string; errorMsg: string | null;
  }[];
}

const EMPTY: DashboardSummary = {
  todayTotal: 0, todaySuccess: 0, todayFail: 0, successRate: 0,
  trend: [], jobStats: [], recentFails: [],
};

export default function SchedulerDashboardTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardSummary>(EMPTY);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/scheduler/logs/summary");
      setData(res.data?.data ?? res.data ?? EMPTY);
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtDt = (v: string | null) => v ? v.replace("T", " ").slice(0, 19) : "-";

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto min-h-0">
      {/* 새로고침 */}
      <div className="flex justify-end flex-shrink-0">
        <Button size="sm" variant="secondary" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-4 gap-4 flex-shrink-0">
        <StatCard label={t("scheduler.todayTotal")} value={data.todayTotal}
          icon={Activity} color="blue" />
        <StatCard label={t("scheduler.todaySuccess")} value={data.todaySuccess}
          icon={CheckCircle} color="green" />
        <StatCard label={t("scheduler.todayFail")} value={data.todayFail}
          icon={XCircle} color="red" />
        <StatCard label={t("scheduler.successRate")}
          value={`${data.successRate.toFixed(1)}%`}
          icon={TrendingUp} color="purple" />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-2 gap-4 flex-shrink-0">
        {/* 7일 추이 LineChart */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-text mb-3">{t("scheduler.trendChart")}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="success" name={t("scheduler.todaySuccess")}
                  stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="fail" name={t("scheduler.todayFail")}
                  stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 작업별 BarChart */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-text mb-3">{t("scheduler.ratioChart")}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.jobStats}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="jobCode" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="success" name={t("scheduler.todaySuccess")}
                  stackId="a" fill="#22c55e" />
                <Bar dataKey="fail" name={t("scheduler.todayFail")}
                  stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 최근 실패 테이블 */}
      <Card className="flex-shrink-0">
        <CardContent>
          <h3 className="text-sm font-semibold text-text mb-3">{t("scheduler.recentFails")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="text-left px-3 py-2">{t("scheduler.jobCode")}</th>
                  <th className="text-left px-3 py-2">{t("scheduler.startTime")}</th>
                  <th className="text-left px-3 py-2">{t("scheduler.errorMsg")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFails.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-text-muted">
                      {t("common.noData", "데이터 없음")}
                    </td>
                  </tr>
                ) : (
                  data.recentFails.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface transition-colors">
                      <td className="px-3 py-2 text-primary font-medium">{row.jobCode}</td>
                      <td className="px-3 py-2">{fmtDt(row.startTime)}</td>
                      <td className="px-3 py-2 max-w-[400px] truncate text-red-600 dark:text-red-400">
                        {row.errorMsg ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
