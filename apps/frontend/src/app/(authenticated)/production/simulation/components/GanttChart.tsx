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

export interface GanttChartProps {
  plans: SimPlanResult[];
  schedule: SimDaySchedule[];
}

/* ── 바 색상 함수 ── */
const BAR_COLORS = [
  "bg-blue-400 dark:bg-blue-600",
  "bg-green-400 dark:bg-green-600",
  "bg-purple-400 dark:bg-purple-600",
  "bg-orange-400 dark:bg-orange-600",
  "bg-cyan-400 dark:bg-cyan-600",
  "bg-teal-400 dark:bg-teal-600",
];

function getBarColor(plan: SimPlanResult): string {
  if (!plan.onTime) return "bg-red-400 dark:bg-red-600";
  const hash = plan.itemCode
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return BAR_COLORS[hash % BAR_COLORS.length];
}

/* ── 주말 체크 ── */
function isWeekend(dayOfWeek: string): boolean {
  return dayOfWeek === "토" || dayOfWeek === "일"
    || dayOfWeek === "Sat" || dayOfWeek === "Sun";
}

export default function GanttChart({ plans, schedule }: GanttChartProps) {
  const { t } = useTranslation();

  if (!plans.length || !schedule.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-text-muted px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-600" />
          {t("simulation.legend.production")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-red-500" />
          {t("simulation.legend.dueMarker")}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          {t("simulation.legend.onTime")}
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          {t("simulation.legend.delay")}
        </span>
      </div>

      {/* 차트 본체 */}
      <div className="flex border border-border rounded-lg overflow-hidden
                      bg-white dark:bg-slate-900">
        {/* 좌측 고정: 계획 정보 */}
        <div className="w-72 flex-shrink-0 border-r border-border">
          {/* 헤더 */}
          <div
            className="h-12 border-b border-border bg-surface dark:bg-slate-800
                        px-3 flex items-center text-xs font-medium text-text gap-3"
          >
            <span className="flex-1">{t("simulation.planInfo")}</span>
            <span className="w-16 text-right">{t("monthlyPlan.planQty")}</span>
            <span className="w-10 text-center">{t("simulation.dueDate")}</span>
          </div>
          {/* 행 */}
          {plans.map((plan) => (
            <div
              key={plan.planNo}
              className="h-14 border-b border-border px-3 flex flex-col
                         justify-center text-xs gap-0.5"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-text truncate">
                  {plan.itemName}
                </span>
                <span className="text-text-muted truncate text-[10px]">
                  {plan.customerName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text">
                  {plan.planQty.toLocaleString()}
                </span>
                <span className="text-text-muted">
                  {plan.dueDate?.slice(5) ?? "-"}
                </span>
                <span className="text-text-muted">
                  ~{plan.endDate.slice(5)}
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
                className={`w-10 flex-shrink-0 text-center text-[10px] leading-tight
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
          {plans.map((plan) => (
            <div key={plan.planNo} className="h-14 border-b border-border flex">
              {schedule.map((day) => {
                const item = day.items.find((i) => i.planNo === plan.planNo);
                const isDueDate = plan.dueDate === day.date;
                const isEnd = plan.endDate === day.date && item;

                return (
                  <div
                    key={day.date}
                    className={`w-10 flex-shrink-0 relative border-r border-border/10
                      ${isWeekend(day.dayOfWeek) ? "bg-red-50/50 dark:bg-red-900/5" : ""}`}
                  >
                    {item && (
                      <div
                        className={`absolute inset-x-0.5 top-1 bottom-1 rounded-sm
                          ${getBarColor(plan)} flex items-center justify-center`}
                        title={`${plan.itemCode}: ${item.qty.toLocaleString()} (${item.cumQty.toLocaleString()})`}
                      >
                        {isEnd && (
                          <CheckCircle2 className="w-3 h-3 text-white/80" />
                        )}
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
