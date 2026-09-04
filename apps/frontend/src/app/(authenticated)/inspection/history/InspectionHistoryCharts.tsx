"use client";

/**
 * @file src/app/(authenticated)/inspection/history/InspectionHistoryCharts.tsx
 * @description 검사이력 "차트로 보기" 뷰 — 조회된 행을 클라이언트에서 집계해 recharts로 표시
 *
 * 초보자 가이드:
 * 1. 상단 요약(총 검사/합격/불합격/합격률)은 카드박스 대신 타이포 + 구분선으로 표시
 * 2. 검사 추이(합격/불합격 누적 막대) — 조회 기간이 하루면 시간대별, 여러 날이면 일별
 * 3. 검사유형별 결과(합격/불합격 누적 가로 막대) + 상위 불량코드(가로 막대)
 * 4. 색은 전부 CSS 변수(var(--success) 등)로 넘겨 스킨/다크모드를 그대로 따른다. hex 금지
 * 5. 합격/불합격은 상태색이므로 범례 + 직접 라벨 + 2px 간격(stroke)으로 색 외 보조 인코딩을 둔다
 */
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useComCodeOptions } from "@/hooks/useComCode";
import type { InspectHistoryRow } from "./types";
import {
  buildTopDefects, buildTrendSeries, buildTypeSeries, resolveTrendGranularity, summarizeInspections,
} from "./inspectionHistoryChartData";

const TOKEN = {
  success: "var(--success)",
  error: "var(--error)",
  primary: "var(--primary)",
  muted: "var(--text-muted)",
  border: "var(--border)",
  surface: "var(--card)",
} as const;

const TICK = { fontSize: 11, fill: TOKEN.muted };
const AXIS_LINE = { stroke: TOKEN.border };
const TOOLTIP_STYLE = { fontSize: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)" };
const TOOLTIP_LABEL = { color: "var(--text-muted)" };
const LEGEND_STYLE = { fontSize: 11, color: "var(--text-muted)" };
const TOP_DEFECT_LIMIT = 10;

interface Props {
  data: InspectHistoryRow[];
  fromDate: string;
  toDate: string;
}

/** 패널 — 제목 + 괘선, 데이터 없으면 안내 문구 */
function Panel({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="min-h-0 flex flex-col">
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{title}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex-1 min-h-0 mt-2">
        {empty ? (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">{t("inspection.history.chart.noData", "데이터 없음")}</div>
        ) : children}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "error" }) {
  const toneClass = tone === "success" ? "text-green-600 dark:text-green-400" : tone === "error" ? "text-red-500 dark:text-red-400" : "text-text";
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{label}</span>
      <span className={`text-2xl font-bold tabular-nums leading-tight ${toneClass}`}>{value}</span>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString();
const fmtRate = (rate: number | null) => (rate === null ? "-" : `${rate.toFixed(1)}%`);
/** 0 값은 직접 라벨을 찍지 않는다 (막대 위 숫자 도배 방지) */
const nonZeroLabel = (value: unknown) => (typeof value === "number" && value > 0 ? fmt(value) : "");

export default function InspectionHistoryCharts({ data, fromDate, toDate }: Props) {
  const { t } = useTranslation();

  const granularity = resolveTrendGranularity(fromDate, toDate);
  const summary = useMemo(() => summarizeInspections(data), [data]);
  const trend = useMemo(() => buildTrendSeries(data, granularity), [data, granularity]);
  const byType = useMemo(() => buildTypeSeries(data), [data]);
  const topDefects = useMemo(() => buildTopDefects(data, TOP_DEFECT_LIMIT), [data]);

  /** 검사유형 라벨은 공통코드(INSPECT_TYPE) 단일 출처 — 화면별 사전을 새로 만들지 않는다 */
  const inspectTypeOptions = useComCodeOptions("INSPECT_TYPE");
  const typeLabels = useMemo(
    () => Object.fromEntries(inspectTypeOptions.map((o) => [o.value, o.label])) as Record<string, string>,
    [inspectTypeOptions],
  );
  const passLabel = t("quality.inspect.pass", "합격");
  const failLabel = t("quality.inspect.fail", "불합격");
  const typeRows = byType.map((p) => ({ ...p, name: typeLabels[p.type] ?? p.type }));

  const trendTitle = granularity === "hour"
    ? t("inspection.history.chart.trendHourly", "시간대별 검사 추이")
    : t("inspection.history.chart.trendDaily", "일별 검사 추이");

  return (
    <div className="h-full flex flex-col gap-4 min-h-0 overflow-auto">
      {/* 요약 — 전광판형 타이포 + 세로 구분선 */}
      <div className="flex items-end gap-8 flex-shrink-0 divide-x divide-border [&>*+*]:pl-8">
        <Stat label={t("inspection.history.chart.total", "총 검사")} value={fmt(summary.total)} />
        <Stat label={passLabel} value={fmt(summary.pass)} tone="success" />
        <Stat label={failLabel} value={fmt(summary.fail)} tone="error" />
        <Stat label={t("inspection.history.chart.passRate", "합격률")} value={fmtRate(summary.passRate)} />
      </div>

      <div className="flex-1 min-h-0 grid grid-rows-[minmax(220px,1fr)_minmax(220px,1fr)] gap-6">
        <Panel title={trendTitle} empty={trend.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 16, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%" maxBarSize={48}>
              <CartesianGrid vertical={false} stroke={TOKEN.border} strokeDasharray="2 4" />
              <XAxis dataKey="bucket" tick={TICK} axisLine={AXIS_LINE} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: TOKEN.border, opacity: 0.4 }} />
              <Legend wrapperStyle={LEGEND_STYLE} iconType="square" iconSize={8} />
              <Bar dataKey="pass" name={passLabel} stackId="r" fill={TOKEN.success} stroke={TOKEN.surface} strokeWidth={2} isAnimationActive={false} />
              <Bar dataKey="fail" name={failLabel} stackId="r" fill={TOKEN.error} stroke={TOKEN.surface} strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="fail" position="top" fontSize={10} fill={TOKEN.muted} formatter={nonZeroLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          <Panel title={t("inspection.history.chart.byType", "검사유형별 결과")} empty={typeRows.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeRows} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barCategoryGap="35%" maxBarSize={28}>
                <CartesianGrid horizontal={false} stroke={TOKEN.border} strokeDasharray="2 4" />
                <XAxis type="number" tick={TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: TOKEN.border, opacity: 0.4 }}
                  formatter={(value, name, item) => {
                    const rate = (item?.payload as { passRate?: number | null } | undefined)?.passRate;
                    return [fmt(Number(value)), `${name} (${t("inspection.history.chart.passRate", "합격률")} ${fmtRate(rate ?? null)})`];
                  }} />
                <Legend wrapperStyle={LEGEND_STYLE} iconType="square" iconSize={8} />
                <Bar dataKey="pass" name={passLabel} stackId="t" fill={TOKEN.success} stroke={TOKEN.surface} strokeWidth={2} isAnimationActive={false}>
                  <LabelList dataKey="pass" position="insideLeft" fontSize={10} fill="var(--card)" formatter={nonZeroLabel} />
                </Bar>
                <Bar dataKey="fail" name={failLabel} stackId="t" fill={TOKEN.error} stroke={TOKEN.surface} strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="fail" position="right" fontSize={10} fill={TOKEN.muted} formatter={nonZeroLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title={t("inspection.history.chart.topDefects", "상위 불량코드")} empty={topDefects.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDefects} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barCategoryGap="35%" maxBarSize={28}>
                <CartesianGrid horizontal={false} stroke={TOKEN.border} strokeDasharray="2 4" />
                <XAxis type="number" tick={TICK} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="code" tick={{ ...TICK, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: TOKEN.border, opacity: 0.4 }} formatter={(value) => [fmt(Number(value)), t("inspection.history.chart.failCount", "불합격 건수")]} />
                <Bar dataKey="count" name={t("inspection.history.chart.failCount", "불합격 건수")} fill={TOKEN.error} stroke={TOKEN.surface} strokeWidth={2} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="count" position="right" fontSize={10} fill={TOKEN.muted} formatter={nonZeroLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </div>
    </div>
  );
}
