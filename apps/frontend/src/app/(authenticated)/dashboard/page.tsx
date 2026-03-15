"use client";

/**
 * @file src/app/(authenticated)/dashboard/page.tsx
 * @description 대시보드 페이지 — 설비/작업지시/자재/품질 현황 + 점검 요약
 *
 * 초보자 가이드:
 * 1. **현황 카드 4개**: 설비 가동, 작업지시 진행, 자재 알림, 품질 이슈
 * 2. **점검 현황**: 일상점검, 정기점검, 예방보전(PM WO) 오늘 기준 요약
 * 3. API: /equipment/equips/stats, /production/job-orders, /material/stocks,
 *         /material/shelf-life, /quality/defect-logs/stats/by-status
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Cpu, ClipboardList, PackageSearch, Bug,
  LayoutDashboard, RefreshCw,
  ClipboardCheck, CalendarCheck, Wrench,
} from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import InspectSummaryCard from "./components/InspectSummaryCard";
import type { InspectItem } from "./components/InspectSummaryCard";
import api from "@/services/api";

/* ── Status Card ── */
interface StatusCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: { label: string; value: number; accent?: string }[];
}

function StatusCard({ title, icon: Icon, color, items }: StatusCardProps) {
  return (
    <Card padding="sm" className="relative overflow-hidden">
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-1.5 rounded-md ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-semibold text-text">{title}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center p-1.5 rounded-md bg-surface dark:bg-slate-800/50">
              <div className={`text-lg font-bold leading-tight ${item.accent || "text-text"}`}>
                {item.value}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Types ── */
interface EquipStats {
  normal: number; maint: number; stop: number; total: number;
}
interface JobStats {
  wait: number; running: number; done: number; total: number;
}
interface MatAlert {
  lowStock: number; nearExpiry: number; expired: number;
}
interface DefectStats {
  wait: number; repair: number; rework: number; done: number; total: number;
}

interface InspectSummary {
  items: InspectItem[];
  total: number;
  completed: number;
  pass: number;
  fail: number;
}

const emptySummary: InspectSummary = { items: [], total: 0, completed: 0, pass: 0, fail: 0 };

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [equip, setEquip] = useState<EquipStats>({ normal: 0, maint: 0, stop: 0, total: 0 });
  const [job, setJob] = useState<JobStats>({ wait: 0, running: 0, done: 0, total: 0 });
  const [mat, setMat] = useState<MatAlert>({ lowStock: 0, nearExpiry: 0, expired: 0 });
  const [defect, setDefect] = useState<DefectStats>({ wait: 0, repair: 0, rework: 0, done: 0, total: 0 });
  const [daily, setDaily] = useState<InspectSummary>(emptySummary);
  const [periodic, setPeriodic] = useState<InspectSummary>(emptySummary);
  const [pm, setPm] = useState<InspectSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);

  const today = formatDate(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setInspectLoading(true);
    try {
      const res = await api.get("/dashboard/summary", { params: { date: today } });
      const { equip, job, mat, defect, daily, periodic, pm } = res.data.data;

      if (equip) setEquip(equip);
      if (job) setJob(job);
      if (mat) setMat(mat);
      if (defect) setDefect(defect);
      if (daily) setDaily(daily);
      if (periodic) setPeriodic(periodic);
      if (pm) setPm(pm);
    } catch {
      /* keep current state */
    } finally {
      setLoading(false);
      setInspectLoading(false);
    }
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
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

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <StatusCard
          title={t("dashboard.equipStatus", "설비 가동 현황")}
          icon={Cpu} color="bg-primary"
          items={[
            { label: t("dashboard.equipNormal", "가동"), value: equip.normal, accent: "text-success" },
            { label: t("dashboard.equipMaint", "정비중"), value: equip.maint, accent: "text-warning" },
            { label: t("dashboard.equipStop", "정지"), value: equip.stop, accent: equip.stop > 0 ? "text-error" : "text-text" },
            { label: t("dashboard.equipTotal", "전체"), value: equip.total },
          ]}
        />
        <StatusCard
          title={t("dashboard.jobStatus", "오늘 작업지시")}
          icon={ClipboardList} color="bg-blue-500"
          items={[
            { label: t("dashboard.jobWait", "대기"), value: job.wait },
            { label: t("dashboard.jobRunning", "진행"), value: job.running, accent: "text-info" },
            { label: t("dashboard.jobDone", "완료"), value: job.done, accent: "text-success" },
            { label: t("dashboard.jobTotal", "전체"), value: job.total },
          ]}
        />
        <StatusCard
          title={t("dashboard.matAlert", "자재 알림")}
          icon={PackageSearch} color="bg-orange-500"
          items={[
            { label: t("dashboard.matLowStock", "안전재고 미달"), value: mat.lowStock, accent: mat.lowStock > 0 ? "text-warning" : "text-text" },
            { label: t("dashboard.matNearExpiry", "유효기한 임박"), value: mat.nearExpiry, accent: mat.nearExpiry > 0 ? "text-warning" : "text-text" },
            { label: t("dashboard.matExpired", "기한 초과"), value: mat.expired, accent: mat.expired > 0 ? "text-error" : "text-text" },
            { label: t("dashboard.matAlertTotal", "알림 합계"), value: mat.lowStock + mat.nearExpiry + mat.expired },
          ]}
        />
        <StatusCard
          title={t("dashboard.defectStatus", "불량 현황")}
          icon={Bug} color="bg-red-500"
          items={[
            { label: t("dashboard.defectWait", "미처리"), value: defect.wait, accent: defect.wait > 0 ? "text-error" : "text-text" },
            { label: t("dashboard.defectRepair", "수리중"), value: defect.repair, accent: "text-warning" },
            { label: t("dashboard.defectRework", "재작업"), value: defect.rework, accent: "text-warning" },
            { label: t("dashboard.defectDone", "처리완료"), value: defect.done, accent: "text-success" },
          ]}
        />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
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
      </div>
    </div>
  );
}
