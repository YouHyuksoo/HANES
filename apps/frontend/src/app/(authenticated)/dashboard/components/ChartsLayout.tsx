"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/ChartsLayout.tsx
 * @description 형태 4 "차트" — 익숙한 차트 6개로 하루를 읽는다(recharts).
 *
 *   1행: 시간대별 실적(누적 막대: 양품/불량)      | 최근 7일 불량률(선)
 *   2행: 공정별 불량률(가로 막대)                  | 상위 불량 유형(가로 막대)
 *   3행: 상태 분포(작업지시·설비 도넛 2개)          | 재고 조치 항목(가로 막대)
 *   우측: 조치 필요 큐(드릴다운 그대로)
 *
 * 색은 전부 CSS 변수(var(--primary) …)로 넘겨 스킨 A/B/C 를 그대로 따른다. hex 금지.
 * 데이터가 전부 0인 패널은 축 대신 "데이터 없음" 문구를 보여준다.
 */
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DashboardLayoutProps } from "./layouts";
import AttentionQueue from "./AttentionQueue";

const HOUR_START = 6;
const HOUR_END = 22;

const TOKEN = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--error)",
  info: "var(--info)",
  muted: "var(--text-muted)",
  border: "var(--border)",
} as const;

const TICK = { fontSize: 11, fill: TOKEN.muted };
const TOOLTIP_STYLE = { fontSize: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)" };
const TOOLTIP_LABEL = { color: "var(--text-muted)" };

/** 패널 — 카드 박스 대신 제목 + 괘선. 데이터가 없으면 차트 대신 안내 문구 */
function Panel({ title, legend, empty, children }: { title: string; legend?: ReactNode; empty: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="min-h-0 flex flex-col">
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{title}</span>
        <span className="h-px flex-1 bg-border" />
        {legend && <span className="text-[10px] text-text-muted flex items-center gap-3">{legend}</span>}
      </div>
      <div className="flex-1 min-h-0 mt-2">
        {empty ? (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">{t("dashboard.charts.noData")}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <i className="inline-block w-2 h-2" style={{ background: color }} />
      {label}
    </span>
  );
}

/** 도넛 — 가운데에 합계, 아래에 항목별 수치 목록 */
function Donut({ title, total, slices }: { title: string; total: number; slices: Array<{ name: string; value: number; color: string }> }) {
  const data = slices.filter((s) => s.value > 0);
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="flex-1 min-h-0 flex items-center gap-3">
        <div className="relative h-full aspect-square max-h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.length ? data : [{ name: "-", value: 1, color: TOKEN.border }]} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" stroke="none" isAnimationActive={false}>
                {(data.length ? data : [{ color: TOKEN.border }]).map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              {data.length > 0 && <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={{ color: "var(--text)" }} />}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums text-text pointer-events-none">{total}</div>
        </div>
        <ul className="text-[11px] space-y-0.5 min-w-0">
          {slices.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
              <i className="inline-block w-2 h-2 flex-shrink-0" style={{ background: s.color }} />
              <span className="text-text-muted truncate">{s.name}</span>
              <b className="text-text tabular-nums ml-auto pl-2">{s.value}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ChartsLayout({ data, attention, attentionCount, now }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const { summary, production, quality, inventory } = data;
  const nowHour = now ? now.getHours() : null;

  const hourly = useMemo(() => {
    const map = new Map((production?.hourly ?? []).map((h) => [Number(h.hour), h]));
    return Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
      const hour = i + HOUR_START;
      return { hour: String(hour).padStart(2, "0"), good: map.get(hour)?.goodQty ?? 0, defect: map.get(hour)?.defectQty ?? 0, isNow: hour === nowHour };
    });
  }, [production, nowHour]);

  const trend = useMemo(() => (quality?.dailyTrend ?? []).map((p) => ({ date: p.date.slice(5), rate: p.defectRate, qty: p.defectQty })), [quality]);

  const byProcess = useMemo(
    () => [...(quality?.byProcess ?? [])].sort((a, b) => b.defectRate - a.defectRate).slice(0, 8).map((p) => ({ name: p.processCode, rate: p.defectRate, qty: p.defectQty })),
    [quality],
  );
  const topDefects = useMemo(() => (quality?.topDefects ?? []).slice(0, 6).map((d) => ({ name: d.defectName || d.defectCode, qty: d.qty })), [quality]);

  const job = summary?.job;
  const holdOrders = production?.orders.filter((o) => o.status === "HOLD").length ?? 0;
  const jobSlices = [
    { name: t("comCode.JOB_ORDER_STATUS.RUNNING"), value: job?.running ?? 0, color: TOKEN.primary },
    { name: t("comCode.JOB_ORDER_STATUS.WAITING"), value: job?.wait ?? 0, color: TOKEN.muted },
    { name: t("comCode.JOB_ORDER_STATUS.HOLD"), value: holdOrders, color: TOKEN.warning },
    { name: t("comCode.JOB_ORDER_STATUS.DONE"), value: job?.done ?? 0, color: TOKEN.success },
  ];
  const equip = summary?.equip;
  const equipSlices = [
    { name: t("dashboard.charts.equipNormal"), value: equip?.normal ?? 0, color: TOKEN.success },
    { name: t("dashboard.charts.equipMaint"), value: equip?.maint ?? 0, color: TOKEN.warning },
    { name: t("dashboard.charts.equipStop"), value: equip?.stop ?? 0, color: TOKEN.error },
  ];

  const inv = [
    { name: t("dashboard.stream.shortage"), value: inventory?.kpi.shortageCount ?? summary?.mat.lowStock ?? 0, color: TOKEN.warning },
    { name: t("dashboard.stream.expired"), value: inventory?.kpi.expiredCount ?? summary?.mat.expired ?? 0, color: TOKEN.error },
    { name: t("dashboard.stream.nearExpiry"), value: inventory?.kpi.nearExpiryCount ?? summary?.mat.nearExpiry ?? 0, color: TOKEN.warning },
    { name: t("dashboard.stream.hold"), value: inventory?.kpi.holdCount ?? 0, color: TOKEN.error },
  ];

  const pct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="flex-1 min-h-0 flex gap-6">
      <div className="flex-1 min-w-0 min-h-0 grid grid-cols-2 grid-rows-3 gap-x-8 gap-y-5">
        {/* 1-1 시간대별 실적 */}
        <Panel
          title={t("dashboard.charts.hourly")}
          empty={false}
          legend={<><Swatch color={TOKEN.primary} label={t("dashboard.rhythm.good")} /><Swatch color={TOKEN.error} label={t("dashboard.rhythm.defect")} /></>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke={TOKEN.border} />
              <XAxis dataKey="hour" tick={TICK} axisLine={{ stroke: TOKEN.border }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="good" name={t("dashboard.rhythm.good")} stackId="h" fill={TOKEN.primary} isAnimationActive={false}>
                {hourly.map((h, i) => <Cell key={i} fillOpacity={h.isNow ? 1 : 0.6} />)}
              </Bar>
              <Bar dataKey="defect" name={t("dashboard.rhythm.defect")} stackId="h" fill={TOKEN.error} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 1-2 7일 불량률 */}
        <Panel title={t("dashboard.rhythm.trend7")} empty={trend.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={TOKEN.border} />
              <XAxis dataKey="date" tick={TICK} axisLine={{ stroke: TOKEN.border }} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={pct} width={56} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} formatter={(v) => pct(Number(v))} />
              <Line type="monotone" dataKey="rate" name={t("dashboard.charts.rate")} stroke={TOKEN.error} strokeWidth={2} dot={{ r: 3, fill: TOKEN.error, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* 2-1 공정별 불량률 */}
        <Panel title={t("dashboard.charts.byProcess")} empty={byProcess.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byProcess} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid horizontal={false} stroke={TOKEN.border} />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} tickFormatter={pct} />
              <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={72} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: "var(--muted)" }} formatter={(v) => pct(Number(v))} />
              <Bar dataKey="rate" name={t("dashboard.charts.rate")} isAnimationActive={false}>
                {byProcess.map((p, i) => <Cell key={i} fill={p.rate >= 3 ? TOKEN.error : TOKEN.primary} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 2-2 상위 불량 유형 */}
        <Panel title={t("dashboard.charts.topDefects")} empty={topDefects.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDefects} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid horizontal={false} stroke={TOKEN.border} />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={96} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="qty" name={t("dashboard.charts.qty")} fill={TOKEN.error} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 3-1 상태 분포 도넛 2개 */}
        <Panel title={t("dashboard.charts.status")} empty={false}>
          <div className="h-full flex gap-6">
            <Donut title={t("dashboard.charts.orderStatus")} total={job?.total ?? 0} slices={jobSlices} />
            <Donut title={t("dashboard.charts.equipStatus")} total={equip?.total ?? 0} slices={equipSlices} />
          </div>
        </Panel>

        {/* 3-2 재고 조치 항목 */}
        <Panel title={t("dashboard.charts.inventory")} empty={false}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inv} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid horizontal={false} stroke={TOKEN.border} />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={96} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" name={t("dashboard.charts.qty")} isAnimationActive={false}>
                {inv.map((s, i) => <Cell key={i} fill={s.value > 0 ? s.color : TOKEN.border} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <aside className="w-[300px] xl:w-[340px] flex-shrink-0 min-h-0 border-l border-border pl-5">
        <AttentionQueue items={attention} total={attentionCount} />
      </aside>
    </div>
  );
}
