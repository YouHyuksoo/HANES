/**
 * @file src/app/(authenticated)/production/simulation/page.tsx
 * @description 생산계획 시뮬레이션 페이지 - 납기/CAPA/월력 기반 스케줄 시뮬레이션
 *
 * 초보자 가이드:
 * 1. **대상월 선택**: input type="month"로 YYYY-MM 형식 입력
 * 2. **시뮬레이션 실행**: POST /production/prod-plans/simulate API 호출
 * 3. **요약 카드**: 총 계획/납기 준수/지연/가동률을 StatCard로 표시
 * 4. **Gantt 차트**: GanttChart 컴포넌트로 날짜별 생산 스케줄 시각화
 */

"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GanttChartSquare, Play, Loader2 } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import api from "@/services/api";
import GanttChart from "./components/GanttChart";

/* ── 타입 정의 ── */

interface SimPlanResult {
  planNo: string;
  itemCode: string;
  itemName: string;
  customer: string;
  customerName: string;
  planQty: number;
  dueDate: string | null;
  priority: number;
  startDate: string;
  endDate: string;
  onTime: boolean;
  delayDays: number;
}

interface SimDayItem {
  planNo: string;
  itemCode: string;
  qty: number;
  cumQty: number;
}

interface SimDaySchedule {
  date: string;
  dayOfWeek: string;
  items: SimDayItem[];
}

interface SimSummary {
  totalPlans: number;
  onTimeCount: number;
  delayCount: number;
  totalQty: number;
  workDays: number;
  utilizationRate: number;
}

interface SimulationResult {
  plans: SimPlanResult[];
  schedule: SimDaySchedule[];
  summary: SimSummary;
}

/* ── 메인 컴포넌트 ── */

export default function SimulationPage() {
  const { t } = useTranslation();

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [strategy, setStrategy] = useState("DUE_DATE");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const strategyOptions = [
    { value: "DUE_DATE", label: t("simulation.strategy.dueDate") },
    { value: "MIN_SETUP", label: t("simulation.strategy.minSetup") },
  ];

  const runSimulation = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await api.post("/production/prod-plans/simulate", { month, strategy });
      setResult(res.data ?? null);
    } catch (err: unknown) {
      console.error("[Simulation] error:", err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [month, strategy]);

  const summary = result?.summary;

  return (
    <div className="flex flex-col h-full animate-fade-in p-6 gap-4 overflow-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-start flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GanttChartSquare className="w-7 h-7 text-primary" />
            {t("simulation.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("simulation.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-44">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              fullWidth
            />
          </div>
          <div className="w-48">
            <Select
              options={strategyOptions}
              value={strategy}
              onChange={setStrategy}
              fullWidth
            />
          </div>
          <Button size="sm" onClick={runSimulation} disabled={loading || !month}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            {t("simulation.run")}
          </Button>
        </div>
      </div>

      {/* 요약 카드 (결과 있을 때만) */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <StatCard
            label={t("simulation.totalPlans")}
            value={summary.totalPlans}
            icon={GanttChartSquare}
            color="blue"
          />
          <StatCard
            label={t("simulation.onTime")}
            value={summary.onTimeCount}
            icon={GanttChartSquare}
            color="green"
          />
          <StatCard
            label={t("simulation.delayed")}
            value={summary.delayCount}
            icon={GanttChartSquare}
            color="red"
          />
          <StatCard
            label={t("simulation.utilization")}
            value={`${summary.utilizationRate}%`}
            icon={GanttChartSquare}
            color="purple"
          />
        </div>
      )}

      {/* Gantt 차트 영역 */}
      {result ? (
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 overflow-auto">
            <GanttChart plans={result.plans} schedule={result.schedule} />
          </CardContent>
        </Card>
      ) : (
        !loading && (
          <Card className="flex-1 min-h-0">
            <CardContent className="h-full flex items-center justify-center">
              <p className="text-text-muted text-sm">
                {t("simulation.emptyGuide")}
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
