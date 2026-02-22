"use client";

/**
 * @file src/app/(authenticated)/dashboard/page.tsx
 * @description 대시보드 페이지 - 실시간 생산 현황, OEE, 품질 합격률
 *
 * 초보자 가이드:
 * 1. **KPI 카드**: 주요 지표를 카드 형태로 표시
 * 2. **최근 실적**: DataGrid로 테이블 표시
 * 3. **반응형**: 그리드 레이아웃으로 화면 크기에 따라 조정
 * 4. API: GET /dashboard/kpi, GET /dashboard/recent-productions
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Factory, Package, Shield, AlertTriangle,
  TrendingUp, TrendingDown, LayoutDashboard, RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardContent, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

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
              <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? "text-success" : ""} ${isNegative ? "text-error" : ""} ${!isPositive && !isNegative ? "text-text-muted" : ""}`}>
                {isPositive && <TrendingUp className="w-3 h-3" />}
                {isNegative && <TrendingDown className="w-3 h-3" />}
                <span>{isPositive && "+"}{change}% {changeLabel}</span>
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

interface KpiData {
  todayProduction: { value: number; change: number };
  inventoryStatus: { value: number; change: number };
  qualityPassRate: { value: string; change: number };
  interlockCount: { value: number; change: number };
}

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

const defaultKpi: KpiData = {
  todayProduction: { value: 0, change: 0 },
  inventoryStatus: { value: 0, change: 0 },
  qualityPassRate: { value: "0", change: 0 },
  interlockCount: { value: 0, change: 0 },
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const [kpi, setKpi] = useState<KpiData>(defaultKpi);
  const [productions, setProductions] = useState<RecentProduction[]>([]);
  const [loading, setLoading] = useState(false);

  const statusDisplayMap: Record<string, string> = useMemo(() => ({
    WAIT: t("dashboard.statusWaiting"),
    RUNNING: t("dashboard.statusInProgress"),
    DONE: t("dashboard.statusCompleted"),
  }), [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, prodRes] = await Promise.all([
        api.get("/dashboard/kpi"),
        api.get("/dashboard/recent-productions"),
      ]);
      setKpi(kpiRes.data?.data ?? defaultKpi);
      setProductions(prodRes.data?.data ?? []);
    } catch {
      /* keep current state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo<ColumnDef<RecentProduction>[]>(() => [
    { accessorKey: "orderNo", header: t("dashboard.orderNo"), size: 160 },
    { accessorKey: "partName", header: t("dashboard.partName"), size: 180 },
    { accessorKey: "line", header: t("dashboard.line"), size: 100 },
    { accessorKey: "planQty", header: t("dashboard.planQty"), size: 90, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "actualQty", header: t("dashboard.actualQty"), size: 90, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    {
      accessorKey: "progress", header: t("dashboard.progress"), size: 160,
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
            </div>
            <span className="text-sm">{value.toFixed(1)}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("dashboard.status"), size: 90,
      cell: ({ getValue }) => {
        const status = getValue() as string;
        const colorMap: Record<string, string> = {
          WAIT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
          RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
          DONE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        };
        return (
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colorMap[status] || ""}`}>
            {statusDisplayMap[status] || status}
          </span>
        );
      },
    },
  ], [t, statusDisplayMap]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><LayoutDashboard className="w-7 h-7 text-primary" />{t("dashboard.title")}</h1>
          <p className="text-text-muted mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={t("dashboard.todayProduction")} value={kpi.todayProduction.value} unit="EA" change={kpi.todayProduction.change} changeLabel={t("common.vsYesterday")} icon={Factory} color="bg-primary" />
        <KpiCard title={t("dashboard.inventoryStatus")} value={kpi.inventoryStatus.value} unit="EA" change={kpi.inventoryStatus.change} changeLabel={t("common.vsYesterday")} icon={Package} color="bg-secondary" />
        <KpiCard title={t("dashboard.qualityPassRate")} value={kpi.qualityPassRate.value} unit="%" change={kpi.qualityPassRate.change} changeLabel={t("common.vsYesterday")} icon={Shield} color="bg-success" />
        <KpiCard title={t("dashboard.interlockOccurrence")} value={kpi.interlockCount.value} unit={t("common.count")} change={kpi.interlockCount.change} changeLabel={t("common.vsYesterday")} icon={AlertTriangle} color="bg-warning" />
      </div>

      {/* Recent Production Table */}
      <Card>
        <CardHeader title={t("dashboard.recentOrders")} subtitle={t("dashboard.recentOrdersDesc")} />
        <CardContent>
          <DataGrid
            data={productions}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("dashboard.recentOrders")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
