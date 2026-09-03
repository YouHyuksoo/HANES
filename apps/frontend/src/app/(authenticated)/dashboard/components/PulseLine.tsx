"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/PulseLine.tsx
 * @description "오늘의 한 줄" — 공장 상태를 문장처럼 읽는 대형 숫자 4개.
 *              카드/박스 없이 baseline 정렬 + 괘선 구분만 쓴다.
 */
import { useTranslation } from "react-i18next";
import type { DashboardData } from "./types";

interface Props {
  data: DashboardData;
  attentionCount: number;
}

interface Segment {
  label: string;
  value: string;
  unit?: string;
  tone: string;
}

export default function PulseLine({ data, attentionCount }: Props) {
  const { t } = useTranslation();
  const { summary, production, quality } = data;

  const achieve = production?.kpi.achieveRate ?? 0;
  const running = summary?.job.running ?? production?.kpi.runningCount ?? 0;
  const total = summary?.job.total ?? production?.kpi.totalCount ?? 0;
  const defectRate = quality?.kpi.defectRate ?? 0;

  const segments: Segment[] = [
    { label: t("dashboard.pulse.achieve"), value: achieve.toFixed(1), unit: "%", tone: "text-primary" },
    { label: t("dashboard.pulse.running"), value: String(running), unit: t("dashboard.pulse.ofTotal", { total }), tone: "text-text" },
    { label: t("dashboard.pulse.defectRate"), value: defectRate.toFixed(1), unit: "%", tone: defectRate >= 3 ? "text-error" : "text-text" },
    {
      label: t("dashboard.pulse.attention"),
      value: String(attentionCount),
      unit: t("dashboard.pulse.countUnit"),
      tone: attentionCount === 0 ? "text-success" : "text-warning",
    },
  ];

  return (
    <div className="flex items-end divide-x divide-border border-y border-border py-3">
      {segments.map((s, i) => (
        <div key={s.label} className="flex-1 min-w-0 px-5 first:pl-1 last:pr-1 ds-rise" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted truncate">{s.label}</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-4xl xl:text-5xl font-extrabold tabular-nums leading-none tracking-tight ${s.tone}`}>{s.value}</span>
            {s.unit && <span className="text-sm font-medium text-text-muted tabular-nums">{s.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
