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

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GanttChartSquare, Play, Loader2, Save, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
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
  requiredDays: number;
  bottleneckProcess: string;
  dailyCapa: number;
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
  requiredHours: number;
  availableHours: number;
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
  const [selectedPlanNo, setSelectedPlanNo] = useState<string | null>(null);

  /** 계획 순서 목록 (↑↓ 버튼으로 변경) */
  interface PlanOrderItem { planNo: string; itemName: string; customerName: string; planQty: number; dueDate?: string }
  const [planOrder, setPlanOrder] = useState<PlanOrderItem[]>([]);

  const strategyOptions = [
    { value: "DUE_DATE", label: t("simulation.strategy.dueDate") },
    { value: "MIN_SETUP", label: t("simulation.strategy.minSetup") },
  ];

  /** 계획 목록 조회 (월 변경 시) */
  const loadPlans = useCallback(async (m: string) => {
    try {
      const res = await api.get("/production/prod-plans", { params: { planMonth: m, limit: 100 } });
      const plans = (res.data?.data ?? []).map((p: { planNo: string; part?: { itemName?: string }; customer?: string; planQty: number }) => ({
        planNo: p.planNo,
        itemName: p.part?.itemName ?? p.planNo,
        customerName: p.customer ?? "",
        planQty: p.planQty,
      }));
      setPlanOrder(plans);
    } catch { setPlanOrder([]); }
  }, []);

  useEffect(() => { if (month) loadPlans(month); }, [month, loadPlans]);

  /* 페이지 진입 시 마지막 결과 로드 */
  useEffect(() => {
    api.get("/production/prod-plans/simulate/latest", { params: { month } })
      .then(res => { if (res.data?.data) setResult(res.data.data); })
      .catch(() => { /* 없으면 무시 */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** ↑ 순서 올리기 */
  const moveUp = useCallback((idx: number) => {
    if (idx <= 0) return;
    setPlanOrder(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  /** ↓ 순서 내리기 */
  const moveDown = useCallback((idx: number) => {
    setPlanOrder(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const runSimulation = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const order = planOrder.length > 0 ? planOrder.map(p => p.planNo) : undefined;
      const res = await api.post("/production/prod-plans/simulate", { month, strategy, planOrder: order });
      const data = res.data?.data ?? null;
      // Gantt 결과를 좌측 순서 패널과 동일한 순서로 정렬
      if (data && order) {
        const orderMap = new Map(order.map((no, i) => [no, i]));
        data.plans.sort((a: { planNo: string }, b: { planNo: string }) =>
          (orderMap.get(a.planNo) ?? 999) - (orderMap.get(b.planNo) ?? 999)
        );
      }
      // 결과에서 dueDate를 순서 패널에 반영
      if (data?.plans) {
        const dueDateMap = new Map(data.plans.map((p: { planNo: string; dueDate?: string }) => [p.planNo, p.dueDate]));
        setPlanOrder(prev => prev.map(p => ({ ...p, dueDate: dueDateMap.get(p.planNo) as string | undefined })));
      }
      setResult(data);
    } catch (err: unknown) {
      console.error("[Simulation] error:", err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [month, strategy]);

  const [saving, setSaving] = useState(false);
  const handleSave = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post("/production/prod-plans/simulate/save", { month, strategy, result });
    } catch { /* api interceptor */ }
    finally { setSaving(false); }
  }, [month, strategy, result]);

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
          {result && (
            <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving} isLoading={saving}>
              <Save className="w-4 h-4 mr-1" />
              {t("common.save")}
            </Button>
          )}
        </div>
      </div>

      {/* 요약은 GanttChart 범례에 통합 */}

      {/* 메인 영역: 순서 패널 + Gantt */}
      <div className="flex flex-1 min-h-0 gap-3">
        {/* 좌측: 생산 순서 변경 */}
        {planOrder.length > 0 && (
          <Card className="w-64 flex-shrink-0 overflow-hidden" padding="none">
            <CardContent className="h-full flex flex-col p-0">
              <div className="px-3 py-2 bg-surface dark:bg-slate-800 border-b border-border text-xs font-medium text-text">
                {t("simulation.planOrder")} ({planOrder.length})
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {planOrder.map((p, idx) => (
                  <div key={p.planNo}
                    onClick={() => setSelectedPlanNo(selectedPlanNo === p.planNo ? null : p.planNo)}
                    className={`flex items-center gap-1 px-2 py-1.5 border-b border-border/50 text-xs cursor-pointer transition ${selectedPlanNo === p.planNo ? "bg-primary/10 dark:bg-primary/20 border-l-2 border-l-primary" : "hover:bg-surface/50"}`}>
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text truncate">{p.itemName}</div>
                      <div className="text-text-muted text-[10px]">
                        <span className="font-mono">{p.planNo}</span> · {p.customerName} · {p.planQty.toLocaleString()}
                        {p.dueDate && <span className="ml-1">· 납기 {p.dueDate.slice(5)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="p-0.5 hover:bg-surface rounded disabled:opacity-20">
                        <ChevronUp className="w-3 h-3 text-text-muted" />
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx === planOrder.length - 1}
                        className="p-0.5 hover:bg-surface rounded disabled:opacity-20">
                        <ChevronDown className="w-3 h-3 text-text-muted" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 우측: Gantt 차트 */}
        {result ? (
          <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
            <CardContent className="h-full p-4 overflow-auto">
              <GanttChart plans={result.plans} schedule={result.schedule} selectedPlanNo={selectedPlanNo} summary={result.summary} />
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
    </div>
  );
}
