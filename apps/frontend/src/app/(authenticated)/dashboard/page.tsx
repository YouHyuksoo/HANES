"use client";

/**
 * @file src/app/(authenticated)/dashboard/page.tsx
 * @description 대시보드 페이지 — KPI, 일상/정기/예방점검 현황, 최근 작업지시
 *
 * 초보자 가이드:
 * 1. **KPI 카드**: 오늘 생산량, 재고현황, 품질합격률, 인터락 발생
 * 2. **점검 현황**: 일상점검, 정기점검, 예방보전(PM WO) 오늘 기준 요약
 * 3. **최근 작업지시**: DataGrid 테이블 (하단)
 * 4. API: /dashboard/kpi, /daily-inspect/calendar/day, /periodic-inspect/calendar/day,
 *         /pm-work-orders/calendar/day, /dashboard/recent-productions
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Factory, Package, Shield, AlertTriangle,
  TrendingUp, TrendingDown, LayoutDashboard, RefreshCw,
  ClipboardCheck, CalendarCheck, Wrench,
} from "lucide-react";
import { Card, CardHeader, CardContent, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import InspectSummaryCard from "./components/InspectSummaryCard";
import type { InspectItem } from "./components/InspectSummaryCard";
import api from "@/services/api";

/* ── KPI Card ── */
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

/* ── Types ── */
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

interface InspectSummary {
  items: InspectItem[];
  total: number;
  completed: number;
  pass: number;
  fail: number;
}

const defaultKpi: KpiData = {
  todayProduction: { value: 0, change: 0 },
  inventoryStatus: { value: 0, change: 0 },
  qualityPassRate: { value: "0", change: 0 },
  interlockCount: { value: 0, change: 0 },
};

const emptySummary: InspectSummary = { items: [], total: 0, completed: 0, pass: 0, fail: 0 };

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [kpi, setKpi] = useState<KpiData>(defaultKpi);
  const [productions, setProductions] = useState<RecentProduction[]>([]);
  const [daily, setDaily] = useState<InspectSummary>(emptySummary);
  const [periodic, setPeriodic] = useState<InspectSummary>(emptySummary);
  const [pm, setPm] = useState<InspectSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);

  const statusDisplayMap: Record<string, string> = useMemo(() => ({
    WAIT: t("dashboard.statusWaiting"),
    RUNNING: t("dashboard.statusInProgress"),
    DONE: t("dashboard.statusCompleted"),
  }), [t]);

  const today = formatDate(new Date());

  /** 일상/정기 점검 day 응답 → InspectSummary 변환 */
  const parseInspectDay = useCallback((data: any[]): InspectSummary => {
    const items: InspectItem[] = data.map((d: any) => ({
      equipCode: d.equipCode || "",
      equipName: d.equipName || "",
      result: d.inspected ? (d.overallResult || "PASS") : null,
      inspectorName: d.inspectorName || null,
      lineCode: d.lineCode || null,
    }));
    const total = items.length;
    const completed = items.filter((i) => i.result !== null).length;
    const pass = items.filter((i) => i.result === "PASS").length;
    const fail = items.filter((i) => i.result === "FAIL").length;
    return { items, total, completed, pass, fail };
  }, []);

  /** PM WO day 응답 → InspectSummary 변환 */
  const parsePmDay = useCallback((data: any[]): InspectSummary => {
    const items: InspectItem[] = data.map((d: any) => ({
      equipCode: d.equip?.equipCode || d.equipId || "",
      equipName: d.equip?.equipName || "",
      result: d.status === "COMPLETED" ? (d.overallResult || "COMPLETED") : null,
      inspectorName: null,
      lineCode: d.equip?.lineCode || null,
    }));
    const total = items.length;
    const completed = items.filter((i) => i.result !== null).length;
    const pass = items.filter((i) => i.result === "PASS" || i.result === "COMPLETED").length;
    const fail = items.filter((i) => i.result === "FAIL").length;
    return { items, total, completed, pass, fail };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setInspectLoading(true);
    try {
      const [kpiRes, prodRes, dailyRes, periodicRes, pmRes] = await Promise.all([
        api.get("/dashboard/kpi"),
        api.get("/dashboard/recent-productions"),
        api.get("/equipment/daily-inspect/calendar/day", { params: { date: today } }).catch(() => ({ data: { data: [] } })),
        api.get("/equipment/periodic-inspect/calendar/day", { params: { date: today } }).catch(() => ({ data: { data: [] } })),
        api.get("/equipment/pm-work-orders/calendar/day", { params: { date: today } }).catch(() => ({ data: { data: [] } })),
      ]);
      setKpi(kpiRes.data?.data ?? defaultKpi);
      setProductions(prodRes.data?.data ?? []);
      setDaily(parseInspectDay(dailyRes.data?.data ?? []));
      setPeriodic(parseInspectDay(periodicRes.data?.data ?? []));
      setPm(parsePmDay(pmRes.data?.data ?? []));
    } catch {
      /* keep current state */
    } finally {
      setLoading(false);
      setInspectLoading(false);
    }
  }, [today, parseInspectDay, parsePmDay]);

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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-primary" />{t("dashboard.title")}
          </h1>
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

      {/* Inspection Summary (3 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InspectSummaryCard
          title={t("dashboard.inspect.dailyTitle", "일상점검")}
          icon={ClipboardCheck}
          iconColor="bg-blue-500"
          items={daily.items}
          total={daily.total}
          completed={daily.completed}
          pass={daily.pass}
          fail={daily.fail}
          loading={inspectLoading}
          linkPath="/equipment/inspect-calendar"
        />
        <InspectSummaryCard
          title={t("dashboard.inspect.periodicTitle", "정기점검")}
          icon={CalendarCheck}
          iconColor="bg-purple-500"
          items={periodic.items}
          total={periodic.total}
          completed={periodic.completed}
          pass={periodic.pass}
          fail={periodic.fail}
          loading={inspectLoading}
          linkPath="/equipment/periodic-inspect-calendar"
        />
        <InspectSummaryCard
          title={t("dashboard.inspect.pmTitle", "예방보전")}
          icon={Wrench}
          iconColor="bg-orange-500"
          items={pm.items}
          total={pm.total}
          completed={pm.completed}
          pass={pm.pass}
          fail={pm.fail}
          loading={inspectLoading}
          linkPath="/equipment/pm-calendar"
        />
      </div>

      {/* Recent Production Table (bottom) */}
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
