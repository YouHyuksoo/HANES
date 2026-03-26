/**
 * @file src/app/(authenticated)/production/simulation/components/GanttChart.tsx
 * @description Gantt 차트 컴포넌트 - 시뮬레이션 결과를 날짜별 바 차트로 시각화
 *
 * 초보자 가이드:
 * 1. **좌측 고정 패널**: 계획 품목명/고객/수량/납기 등 요약 정보
 * 2. **우측 스크롤 영역**: 날짜별 생산 바 + 납기 마커(빨간 세로선)
 * 3. **바 색상**: 공정코드 기반 - 모든 오더에서 같은 공정은 같은 색
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
  itemType: string;
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
  processCode: string;
  processName: string;
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

/* ── 공정별 색상 매핑 ── */
const PROCESS_COLORS: Record<string, string> = {
  "PRC-CUT": "bg-gray-400 dark:bg-gray-500",
  "PRC-STRIP": "bg-gray-300 dark:bg-gray-400",
  "PRC-CRIMP": "bg-yellow-400 dark:bg-yellow-500",
  "PRC-PRESUB": "bg-green-400 dark:bg-green-500",
  "PRC-ASSY": "bg-blue-400 dark:bg-blue-500",
  "PRC-TAPE": "bg-purple-400 dark:bg-purple-500",
  "PRC-TEST": "bg-cyan-400 dark:bg-cyan-500",
  "PRC-PACK": "bg-pink-400 dark:bg-pink-500",
};

/** 공정코드 → 한국어명 */
const PROCESS_NAMES: Record<string, string> = {
  "PRC-CUT": "절단",
  "PRC-STRIP": "탈피",
  "PRC-CRIMP": "압착",
  "PRC-PRESUB": "선조립",
  "PRC-ASSY": "조립",
  "PRC-TAPE": "테이핑",
  "PRC-TEST": "검사",
  "PRC-PACK": "포장",
};

/** 공정코드로 바 색상을 결정 (미등록 공정은 slate 폴백) */
function getProcessColor(processCode: string): string {
  return PROCESS_COLORS[processCode] ?? "bg-slate-400 dark:bg-slate-500";
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
      {/* 범례: 공정별 색상 + 납기 마커 + 요약 */}
      <div className="flex items-center gap-4 text-xs px-2 py-2 bg-surface dark:bg-slate-800 rounded-lg border border-border flex-wrap">
        <span className="font-medium text-text mr-1">{t("simulation.legend.process", "공정")}:</span>
        {Object.entries(PROCESS_COLORS).map(([code, color]) => (
          <span key={code} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
            <span className="text-text">{PROCESS_NAMES[code] ?? code}</span>
          </span>
        ))}
        <span className="border-l border-border pl-3 flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-red-500" />
          <span className="text-text">{t("simulation.legend.dueMarker")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <span className="text-text">{t("simulation.legend.onTime")}</span>
        </span>
        {summary && (
          <span className="border-l border-border pl-3 flex items-center gap-3 text-text-muted">
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
        {/* 좌측 고정: 계획정보 + 설비 + 결과 */}
        <div className="flex flex-shrink-0 border-r border-border">
          {/* 계획정보 컬럼 */}
          <div className="w-64 border-r border-border/50">
            <div className="h-12 border-b border-border bg-surface dark:bg-slate-800 px-3 flex items-center text-xs font-medium text-text">
              {t("simulation.planInfo")}
            </div>
            {plans.map((plan) => (
              <div key={plan.planNo}
                className={`h-10 border-b border-border px-3 flex flex-col justify-center text-xs gap-0.5 transition ${selectedPlanNo === plan.planNo ? "bg-primary/10 dark:bg-primary/20" : ""}`}>
                <div className="flex items-center gap-1 min-w-0">
                  <span className={`px-1 text-[8px] rounded-sm flex-shrink-0 ${plan.itemType === 'FINISHED' || plan.itemType === 'FG' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                    {plan.itemType === 'FINISHED' || plan.itemType === 'FG' ? 'FG' : 'WIP'}
                  </span>
                  <span className="font-medium text-text truncate">{plan.itemName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                  <span className="font-mono">{plan.planNo}</span>
                  <span className="font-medium text-text">{plan.planQty.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          {/* 설비/공정 컬럼 */}
          <div className="w-32">
            <div className="h-12 border-b border-border bg-surface dark:bg-slate-800 px-2 flex items-center text-xs font-medium text-text">
              공정/CAPA
            </div>
            {plans.map((plan) => (
              <div key={plan.planNo}
                className={`h-10 border-b border-border px-2 flex flex-col justify-center text-xs gap-0.5 transition ${selectedPlanNo === plan.planNo ? "bg-primary/10 dark:bg-primary/20" : ""}`}>
                <span className="text-[10px] font-medium text-text">{plan.bottleneckProcess}</span>
                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                  <span>{plan.dailyCapa.toLocaleString()}/일</span>
                  <span>{plan.requiredDays}일소요</span>
                </div>
              </div>
            ))}
          </div>
          {/* 결과 컬럼 */}
          <div className="w-24 border-l border-border/50">
            <div className="h-12 border-b border-border bg-surface dark:bg-slate-800 px-2 flex items-center text-xs font-medium text-text">
              결과
            </div>
            {plans.map((plan) => (
              <div key={plan.planNo}
                className={`h-10 border-b border-border px-2 flex items-center text-xs transition ${selectedPlanNo === plan.planNo ? "bg-primary/10 dark:bg-primary/20" : ""}`}>
                {plan.onTime ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ~{plan.endDate.slice(5)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    +{plan.delayDays}{t("simulation.delayDays")}
                  </span>
                )}
              </div>
            ))}
          </div>
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
          {plans.map((plan) => (
            <div key={plan.planNo} className={`h-10 border-b border-border flex transition ${selectedPlanNo === plan.planNo ? "bg-primary/10 dark:bg-primary/20" : ""}`}>
              {schedule.map((day) => {
                const items = day.items.filter((i) => i.planNo === plan.planNo);
                const mainItem = items.length > 0
                  ? items.reduce((max, cur) => cur.qty > max.qty ? cur : max, items[0])
                  : null;
                const isDueDate = plan.dueDate === day.date;

                return (
                  <div
                    key={day.date}
                    className={`w-8 flex-shrink-0 relative border-r border-border/10
                      ${isWeekend(day.dayOfWeek) ? "bg-red-50/50 dark:bg-red-900/5" : ""}`}
                  >
                    {mainItem && (
                      <div
                        className={`absolute inset-x-0.5 top-0.5 bottom-0.5 rounded-sm
                          ${getProcessColor(mainItem.processCode)}
                          flex items-center justify-center overflow-hidden`}
                        title={`${mainItem.processName}: ${mainItem.qty.toLocaleString()}`}
                      >
                        <span className="text-[8px] text-white/90 font-medium leading-none">
                          {mainItem.qty >= 1000 ? `${Math.round(mainItem.qty / 1000)}k` : mainItem.qty}
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
