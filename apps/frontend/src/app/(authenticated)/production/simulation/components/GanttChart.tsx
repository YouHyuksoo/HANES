/**
 * @file src/app/(authenticated)/production/simulation/components/GanttChart.tsx
 * @description Gantt 차트 컴포넌트 - 시뮬레이션 결과를 날짜별 바 차트로 시각화
 *
 * 초보자 가이드:
 * 1. **좌측 고정 패널**: 계획 품목명/고객/수량/납기 등 요약 정보
 * 2. **우측 스크롤 영역**: 날짜별 생산 바 + 납기 마커(빨간 세로선)
 * 3. **바 색상**: 지연=빨강, 정상=itemCode 해시 기반 색상 구분
 * 4. Tailwind CSS만으로 구현 (외부 차트 라이브러리 없음)
 */

"use client";

import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertTriangle } from "lucide-react";

/* ── 타입 (부모 페이지와 공유) ── */
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

export interface GanttChartProps {
  plans: SimPlanResult[];
  schedule: SimDaySchedule[];
  selectedPlanNo?: string | null;
  summary?: SimSummary | null;
}

/* ── 바 색상 함수 ── */
const BAR_COLORS = [
  "bg-blue-400 dark:bg-blue-500",
  "bg-emerald-400 dark:bg-emerald-500",
  "bg-violet-400 dark:bg-violet-500",
  "bg-amber-400 dark:bg-amber-500",
  "bg-cyan-400 dark:bg-cyan-500",
  "bg-pink-400 dark:bg-pink-500",
  "bg-lime-400 dark:bg-lime-500",
  "bg-indigo-400 dark:bg-indigo-500",
  "bg-rose-400 dark:bg-rose-500",
  "bg-teal-400 dark:bg-teal-500",
  "bg-sky-400 dark:bg-sky-500",
  "bg-fuchsia-400 dark:bg-fuchsia-500",
];

/** 좌측 색상 표시용 dot 색상 */
const DOT_COLORS = [
  "bg-blue-400", "bg-emerald-400", "bg-violet-400", "bg-amber-400",
  "bg-cyan-400", "bg-pink-400", "bg-lime-400", "bg-indigo-400",
  "bg-rose-400", "bg-teal-400", "bg-sky-400", "bg-fuchsia-400",
];

/** 오더별 고유 색상 (planNo 인덱스 기반) */
function getBarColor(plan: SimPlanResult, planIndex: number): string {
  if (!plan.onTime) {
    if (plan.delayDays >= 7) return "bg-red-600 dark:bg-red-700";
    if (plan.delayDays >= 3) return "bg-red-400 dark:bg-red-500";
    return "bg-orange-400 dark:bg-orange-500";
  }
  return BAR_COLORS[planIndex % BAR_COLORS.length];
}

/* ── 주말 체크 ── */
function isWeekend(dayOfWeek: string): boolean {
  return dayOfWeek === "토" || dayOfWeek === "일"
    || dayOfWeek === "Sat" || dayOfWeek === "Sun";
}

export default function GanttChart({ plans, schedule, selectedPlanNo, summary }: GanttChartProps) {
  const { t } = useTranslation();

  if (!plans.length || !schedule.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 */}
      <div className="flex items-center gap-5 text-xs px-2 py-2 bg-surface dark:bg-slate-800 rounded-lg border border-border">
        <span className="font-medium text-text mr-1">{t("simulation.legend.production")}:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-3 rounded-sm bg-blue-400 dark:bg-blue-600" />
          <span className="text-text">{t("simulation.legend.onTime")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-3 rounded-sm bg-orange-400 dark:bg-orange-500" />
          <span className="text-text">1~2{t("simulation.delayDays")} {t("simulation.legend.delay")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-3 rounded-sm bg-red-400 dark:bg-red-500" />
          <span className="text-text">3~6{t("simulation.delayDays")} {t("simulation.legend.delay")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-3 rounded-sm bg-red-600 dark:bg-red-700" />
          <span className="text-text">7{t("simulation.delayDays")}+ {t("simulation.legend.delay")}</span>
        </span>
        <span className="border-l border-border pl-4 flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-red-500" />
          <span className="text-text">{t("simulation.legend.dueMarker")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <span className="text-text">{t("simulation.legend.onTime")}</span>
        </span>
        {summary && (
          <span className="border-l border-border pl-4 flex items-center gap-3 text-text-muted">
            <span>{t("simulation.totalPlans")} <b className="text-text">{summary.totalPlans}</b></span>
            <span>{t("simulation.onTime")} <b className="text-green-600 dark:text-green-400">{summary.onTimeCount}</b></span>
            <span>{t("simulation.delayed")} <b className="text-red-600 dark:text-red-400">{summary.delayCount}</b></span>
            <span>{t("simulation.manHours")} <b className="text-blue-600 dark:text-blue-400">{summary.requiredHours}h</b>/<b className="text-green-600 dark:text-green-400">{summary.availableHours}h</b>
              <span className={`ml-1 font-bold ${summary.requiredHours > summary.availableHours ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                ({summary.requiredHours > summary.availableHours ? `${Math.round(summary.requiredHours - summary.availableHours)}h↑` : `${Math.round(summary.availableHours - summary.requiredHours)}h↓`})
              </span>
            </span>
          </span>
        )}
      </div>

      {/* 차트 본체 */}
      <div className="flex border border-border rounded-lg overflow-hidden
                      bg-white dark:bg-slate-900">
        {/* 좌측 고정: 계획 정보 */}
        <div className="w-96 flex-shrink-0 border-r border-border">
          {/* 헤더 */}
          <div
            className="h-12 border-b border-border bg-surface dark:bg-slate-800
                        px-3 flex items-center text-xs font-medium text-text gap-3"
          >
            <span className="flex-1">{t("simulation.planInfo")}</span>
          </div>
          {/* 행 */}
          {plans.map((plan, planIdx) => (
            <div
              key={plan.planNo}
              className={`h-10 border-b border-border px-3 flex flex-col justify-center text-xs gap-0.5 transition ${selectedPlanNo === plan.planNo ? "bg-primary/10 dark:bg-primary/20" : ""}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-text truncate">
                  {plan.itemName}
                </span>
                <span className="px-1 py-0.5 text-[9px] rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 flex-shrink-0">
                  {plan.bottleneckProcess} {plan.dailyCapa.toLocaleString()}/일
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-text-muted text-[10px]">
                  {plan.planNo}
                </span>
                <span className="text-text font-medium">
                  {plan.planQty.toLocaleString()}
                </span>
                <span className="text-text-muted text-[10px]">
                  {plan.requiredDays}{t("simulation.delayDays")}소요
                </span>
                <span className="text-text-muted">
                  완료~{plan.endDate.slice(5)}
                </span>
                {plan.onTime ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>+{plan.delayDays}{t("simulation.delayDays")}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 우측 스크롤: 날짜별 바 */}
        <div className="flex-1 overflow-x-auto min-w-0">
          {/* 날짜 헤더 */}
          <div className="h-12 border-b border-border bg-surface dark:bg-slate-800 flex">
            {schedule.map((day) => (
              <div
                key={day.date}
                className={`w-8 flex-shrink-0 text-center text-[10px] leading-tight
                  flex flex-col justify-center
                  border-r border-border/50
                  ${isWeekend(day.dayOfWeek) ? "bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400" : "text-text"}`}
              >
                <div className="font-medium">{day.date.slice(8)}</div>
                <div className="text-text-muted">{day.dayOfWeek}</div>
              </div>
            ))}
          </div>

          {/* 바 영역 */}
          {plans.map((plan, planIdx) => (
            <div key={plan.planNo} className={`h-10 border-b border-border flex transition ${selectedPlanNo === plan.planNo ? "bg-primary/10 dark:bg-primary/20" : ""}`}>
              {schedule.map((day) => {
                const item = day.items.find((i) => i.planNo === plan.planNo);
                const isDueDate = plan.dueDate === day.date;
                const isEnd = plan.endDate === day.date && item;

                return (
                  <div
                    key={day.date}
                    className={`w-8 flex-shrink-0 relative border-r border-border/10
                      ${isWeekend(day.dayOfWeek) ? "bg-red-50/50 dark:bg-red-900/5" : ""}`}
                  >
                    {item && (
                      <div
                        className={`absolute inset-x-0.5 top-0.5 bottom-0.5 rounded-sm
                          ${getBarColor(plan, planIdx)} flex items-center justify-center overflow-hidden`}
                        title={`${plan.itemCode}: ${item.qty.toLocaleString()} (누적 ${item.cumQty.toLocaleString()})`}
                      >
                        <span className="text-[8px] text-white/90 font-medium leading-none">
                          {item.qty >= 1000 ? `${Math.round(item.qty / 1000)}k` : item.qty}
                        </span>
                      </div>
                    )}
                    {isDueDate && (
                      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-red-500 z-10" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
