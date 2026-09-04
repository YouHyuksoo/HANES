"use client";

/**
 * @file src/app/(authenticated)/quality/spc/components/HvSpcCharts.tsx
 * @description X̄ 관리도 + R 관리도 + 히스토그램 (recharts).
 *
 * 초보자 가이드:
 * 1. X̄ 차트: ±1σ/±2σ 구역을 옅은 띠로, UCL/LCL 은 적색 점선, CL 은 강조색 실선, 규격은 앰버 점선.
 * 2. 점 색: 규칙 위반 플래그(OOC=적, WARN=황, 정상=잉크). 색은 .hvspc-root 의 CSS 변수에서 읽는다.
 * 3. 히스토그램: 개별 측정값 전체를 15개 구간으로. 규격선과 함께 치우침을 본다.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer, ComposedChart, LineChart, BarChart, Line, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from "recharts";
import type { SpcPointFlag, SpcSpec, SpcStats, SpcSubgroupRow } from "../types";

interface Props {
  subgroups: SpcSubgroupRow[];
  stats: SpcStats;
  spec: SpcSpec;
  unit: string;
  decimals: number;
  flags: Map<number, SpcPointFlag>;
}

/** CSS 변수 값을 읽는다 — recharts 는 SVG 속성에 var() 를 못 쓴다 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const el = document.querySelector(".hvspc-root");
  const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : "";
  return v || fallback;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { id: number };
}

const HIST_BINS = 15;

export default function HvSpcCharts({ subgroups, stats, spec, unit, decimals, flags }: Props) {
  const { t } = useTranslation();

  const colors = useMemo(() => ({
    ink: cssVar("--hv-series", "#e8edf2"),
    ink2: cssVar("--hv-series-2", "#5eead4"),
    dim: cssVar("--hv-ink-mute", "#5b6775"),
    line: cssVar("--hv-line", "rgba(255,255,255,0.09)"),
    panel: cssVar("--hv-panel", "#10161d"),
    accent: cssVar("--hv-accent", "#f59e0b"),
    stop: cssVar("--hv-stop", "#f87171"),
    warn: cssVar("--hv-warn", "#fbbf24"),
    zone1: cssVar("--hv-zone-1", "rgba(255,255,255,0.035)"),
    zone2: cssVar("--hv-zone-2", "rgba(255,255,255,0.07)"),
  }), []);

  const fmt = useMemo(() => (v: number) => v.toFixed(decimals), [decimals]);
  const sigma = (stats.xbarUCL - stats.xbarCL) / 3;

  const data = useMemo(
    () => subgroups.map((sg) => ({ id: sg.id, label: sg.dateLabel, xbar: sg.xbar, range: sg.range, flag: flags.get(sg.id) ?? null })),
    [subgroups, flags],
  );

  const xbarDomain = useMemo<[number, number]>(() => {
    const vals = [...data.map((d) => d.xbar), stats.xbarUCL, stats.xbarLCL];
    if (spec.usl !== null) vals.push(spec.usl);
    if (spec.lsl !== null) vals.push(spec.lsl);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.12 || 1;
    return [min - pad, max + pad];
  }, [data, stats, spec]);

  const hist = useMemo(() => {
    const all = subgroups.flatMap((s) => s.samples);
    if (all.length === 0) return { bins: [] as { x: string; lo: number; hi: number; count: number }[], min: 0, max: 0 };
    const vals = [...all];
    if (spec.usl !== null) vals.push(spec.usl);
    if (spec.lsl !== null) vals.push(spec.lsl);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const w = (max - min) / HIST_BINS || 1;
    const bins = Array.from({ length: HIST_BINS }, (_, i) => ({ lo: min + i * w, hi: min + (i + 1) * w, count: 0, x: "" }));
    for (const v of all) {
      const i = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((v - min) / w)));
      bins[i].count++;
    }
    for (const b of bins) b.x = fmt((b.lo + b.hi) / 2);
    return { bins, min, max };
  }, [subgroups, spec, fmt]);

  const tooltipStyle = { fontSize: 11, background: colors.panel, border: `1px solid ${colors.line}`, color: colors.ink, fontFamily: "var(--hv-mono)" };
  const tick = { fontSize: 10, fill: colors.dim, fontFamily: "var(--hv-mono)" };

  const renderDot = (props: DotProps) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return <g key={`dot-none-${payload?.id ?? "x"}`} />;
    const flag = flags.get(payload.id) ?? null;
    const fill = flag === "OOC" ? colors.stop : flag === "WARN" ? colors.warn : colors.ink;
    const r = flag ? 4.5 : 2.5;
    return <circle key={`dot-${payload.id}`} cx={cx} cy={cy} r={r} fill={fill} stroke={flag ? fill : "none"} strokeWidth={flag ? 2 : 0} />;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* X̄ 관리도 */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="hv-label">{t("quality.spc.hv.xbarChart", "X̄ 관리도")} <span className="hv-num" style={{ color: "var(--hv-ink-mute)" }}>({unit})</span></span>
          <span className="hv-num text-[10px]" style={{ color: "var(--hv-ink-mute)" }}>
            UCL {fmt(stats.xbarUCL)} · CL {fmt(stats.xbarCL)} · LCL {fmt(stats.xbarLCL)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 52, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={colors.line} vertical={false} />
            <XAxis dataKey="label" tick={tick} interval="preserveStartEnd" minTickGap={24} />
            <YAxis domain={xbarDomain} tick={tick} tickFormatter={fmt} width={58} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [fmt(Number(v)), "X̄"]}
              labelFormatter={(l) => String(l)}
            />
            {sigma > 0 && (
              <>
                <ReferenceArea y1={stats.xbarCL - 2 * sigma} y2={stats.xbarCL + 2 * sigma} fill={colors.zone1} stroke="none" />
                <ReferenceArea y1={stats.xbarCL - sigma} y2={stats.xbarCL + sigma} fill={colors.zone2} stroke="none" />
              </>
            )}
            {spec.usl !== null && <ReferenceLine y={spec.usl} stroke={colors.accent} strokeDasharray="2 4" label={{ value: "USL", position: "right", fontSize: 9, fill: colors.accent }} />}
            {spec.lsl !== null && <ReferenceLine y={spec.lsl} stroke={colors.accent} strokeDasharray="2 4" label={{ value: "LSL", position: "right", fontSize: 9, fill: colors.accent }} />}
            <ReferenceLine y={stats.xbarUCL} stroke={colors.stop} strokeDasharray="6 3" label={{ value: "UCL", position: "right", fontSize: 9, fill: colors.stop }} />
            <ReferenceLine y={stats.xbarCL} stroke={colors.ink2} strokeWidth={1.2} label={{ value: "CL", position: "right", fontSize: 9, fill: colors.ink2 }} />
            <ReferenceLine y={stats.xbarLCL} stroke={colors.stop} strokeDasharray="6 3" label={{ value: "LCL", position: "right", fontSize: 9, fill: colors.stop }} />
            <Line type="linear" dataKey="xbar" stroke={colors.ink} strokeWidth={1.2} dot={renderDot} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* R 관리도 */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="hv-label">{t("quality.spc.hv.rChart", "R 관리도")}</span>
          <span className="hv-num text-[10px]" style={{ color: "var(--hv-ink-mute)" }}>
            UCL {fmt(stats.rUCL)} · R̄ {fmt(stats.rCL)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 8, right: 52, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={colors.line} vertical={false} />
            <XAxis dataKey="label" tick={tick} interval="preserveStartEnd" minTickGap={24} />
            <YAxis domain={[0, "auto"]} tick={tick} tickFormatter={fmt} width={58} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)), "R"]} labelFormatter={(l) => String(l)} />
            <ReferenceLine y={stats.rUCL} stroke={colors.stop} strokeDasharray="6 3" label={{ value: "UCL", position: "right", fontSize: 9, fill: colors.stop }} />
            <ReferenceLine y={stats.rCL} stroke={colors.ink2} strokeWidth={1.2} label={{ value: "R̄", position: "right", fontSize: 9, fill: colors.ink2 }} />
            <Line type="linear" dataKey="range" stroke={colors.ink2} strokeWidth={1.2} dot={{ r: 2.5, fill: colors.ink2, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 히스토그램 */}
      {hist.bins.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="hv-label">{t("quality.spc.hv.histogram", "히스토그램")}</span>
            <span className="hv-num text-[10px]" style={{ color: "var(--hv-ink-mute)" }}>
              n={subgroups.reduce((s, x) => s + x.samples.length, 0)}
              {spec.lsl !== null && ` · LSL ${fmt(spec.lsl)}`}
              {spec.target !== null && ` · T ${fmt(spec.target)}`}
              {spec.usl !== null && ` · USL ${fmt(spec.usl)}`}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={hist.bins} margin={{ top: 8, right: 52, left: 0, bottom: 4 }} barCategoryGap={1}>
              <CartesianGrid stroke={colors.line} vertical={false} />
              <XAxis dataKey="x" tick={tick} interval="preserveStartEnd" minTickGap={20} />
              <YAxis allowDecimals={false} tick={tick} width={58} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v), t("quality.spc.hv.count", "건수")]} labelFormatter={(l) => `≈ ${l}`} />
              <Bar dataKey="count" isAnimationActive={false}>
                {hist.bins.map((b) => {
                  const out = (spec.usl !== null && b.lo >= spec.usl) || (spec.lsl !== null && b.hi <= spec.lsl);
                  return <Cell key={b.x} fill={out ? colors.stop : colors.ink2} fillOpacity={out ? 0.9 : 0.55} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
