"use client";

/**
 * @file src/app/(authenticated)/quality/spc/components/HvSpcCharts.tsx
 * @description X̄ 관리도 + R 관리도 + 히스토그램 (recharts).
 *
 * 초보자 가이드:
 * 1. X̄ 차트: ±1σ/±2σ 구역을 옅은 띠로, UCL/LCL 은 적색 점선, CL 은 강조색 실선, 규격은 앰버 점선.
 * 2. 점 색: 규칙 위반 플래그(OOC=적, WARN=황, 정상=잉크). 색은 .hvspc-root 의 CSS 변수에서 읽는다.
 * 3. 공정능력 분포: 개별 측정값 히스토그램 위에 정규곡선(평균 X̿, σ전체)과 LSL/T/USL·평균선을 겹쳐
 *    규격 대비 치우침과 산포를 본다. 헤더에 Cp/Cpk/Pp/Ppk.
 * 4. Cpk 추이: 최근 25 서브그룹 이동 창으로 Cpk 를 점마다 다시 계산해 능력이 어느 시점부터 나빠졌는지 본다.
 *    σ군내는 창 안의 R̄ 비율로 전체 σ군내를 보정한 값. 기준선 1.33(양호)/1.00(최소).
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from "recharts";
import type { SpcCapability, SpcPointFlag, SpcSpec, SpcStats, SpcSubgroupRow } from "../types";

interface Props {
  subgroups: SpcSubgroupRow[];
  stats: SpcStats;
  spec: SpcSpec;
  unit: string;
  decimals: number;
  flags: Map<number, SpcPointFlag>;
  capability: SpcCapability | null;
}

/** Cpk 추이 이동 창(서브그룹 수) — health 판정 창과 같은 25 */
const CPK_WINDOW = 25;
/** Cpk 판정 기준선 */
const CPK_GOOD = 1.33;
const CPK_MIN = 1.0;

/** 규격·평균·σ로 Cpk(양쪽) 또는 Cpu/Cpl(한쪽) — 규격이 없으면 null */
function cpkOf(mean: number, sigma: number, spec: SpcSpec): number | null {
  if (sigma <= 0) return null;
  const upper = spec.usl !== null ? (spec.usl - mean) / (3 * sigma) : null;
  const lower = spec.lsl !== null ? (mean - spec.lsl) / (3 * sigma) : null;
  if (upper !== null && lower !== null) return Math.min(upper, lower);
  return upper ?? lower;
}

function normalPdf(x: number, mean: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const z = (x - mean) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
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

export default function HvSpcCharts({ subgroups, stats, spec, unit, decimals, flags, capability }: Props) {
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

  /** 능력 분포: 히스토그램 구간 중심마다 정규곡선 기대 건수(n × 구간폭 × pdf)를 겹친다 */
  const capData = useMemo(() => {
    const n = subgroups.reduce((sum, sg) => sum + sg.samples.length, 0);
    const sigmaAll = capability?.sigmaOverall ?? 0;
    return hist.bins.map((b) => ({
      x: b.x,
      lo: b.lo,
      hi: b.hi,
      count: b.count,
      curve: sigmaAll > 0 ? n * (b.hi - b.lo) * normalPdf((b.lo + b.hi) / 2, stats.xbarBar, sigmaAll) : null,
    }));
  }, [hist, capability, stats.xbarBar, subgroups]);

  /** Cpk 추이: 서브그룹 i까지의 최근 CPK_WINDOW 개로 평균·R̄ → σ군내(전체 σ군내 × R̄창/R̄전체) → Cpk */
  const cpkTrend = useMemo(() => {
    if (!capability || capability.sigmaWithin <= 0 || (spec.usl === null && spec.lsl === null)) return [];
    return subgroups.map((sg, i) => {
      const win = subgroups.slice(Math.max(0, i - CPK_WINDOW + 1), i + 1);
      const mean = win.reduce((a, w) => a + w.xbar, 0) / win.length;
      const rBarWin = win.reduce((a, w) => a + w.range, 0) / win.length;
      const sigmaWin = stats.rBar > 0 ? capability.sigmaWithin * (rBarWin / stats.rBar) : capability.sigmaWithin;
      return { id: sg.id, label: sg.dateLabel, cpk: cpkOf(mean, sigmaWin, spec), k: win.length };
    });
  }, [subgroups, capability, spec, stats.rBar]);

  const cpkDomain = useMemo<[number, number]>(() => {
    const vals = cpkTrend.map((d) => d.cpk).filter((v): v is number => v !== null);
    const max = Math.max(CPK_GOOD + 0.2, ...vals);
    const min = Math.min(0, ...vals);
    return [Math.floor(min * 10) / 10, Math.ceil(max * 10) / 10];
  }, [cpkTrend]);

  const capText = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v.toFixed(2));

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

      {/* 공정능력 분포: 히스토그램 + 정규곡선 + 규격/평균선 */}
      {capData.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="hv-label">
              {t("quality.spc.hv.capabilityChart", "공정능력 분포")}{" "}
              <span className="hv-num" style={{ color: "var(--hv-ink-mute)" }}>
                Cp {capText(capability?.cp)} · Cpk {capText(capability?.cpk)} · Pp {capText(capability?.pp)} · Ppk {capText(capability?.ppk)}
              </span>
            </span>
            <span className="hv-num text-[10px]" style={{ color: "var(--hv-ink-mute)" }}>
              n={subgroups.reduce((sum, x) => sum + x.samples.length, 0)}
              {spec.lsl !== null && ` · LSL ${fmt(spec.lsl)}`}
              {spec.target !== null && ` · T ${fmt(spec.target)}`}
              {spec.usl !== null && ` · USL ${fmt(spec.usl)}`}
              {` · X̿ ${fmt(stats.xbarBar)}`}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={capData} margin={{ top: 8, right: 52, left: 0, bottom: 4 }} barCategoryGap={1}>
              <CartesianGrid stroke={colors.line} vertical={false} />
              <XAxis dataKey="x" tick={tick} interval="preserveStartEnd" minTickGap={20} />
              <YAxis allowDecimals={false} tick={tick} width={58} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [
                  typeof v === "number" ? (name === "curve" ? v.toFixed(1) : String(v)) : "-",
                  name === "curve" ? t("quality.spc.hv.normalCurve", "정규곡선 기대") : t("quality.spc.hv.count", "건수"),
                ]}
                labelFormatter={(l) => `≈ ${l}`}
              />
              {/* 규격·평균 위치는 해당 구간 중심 라벨에 표시 */}
              {spec.lsl !== null && capData.some((d) => d.lo <= spec.lsl! && spec.lsl! < d.hi) && (
                <ReferenceLine x={capData.find((d) => d.lo <= spec.lsl! && spec.lsl! < d.hi)!.x} stroke={colors.accent} strokeDasharray="4 3"
                  label={{ value: "LSL", position: "top", fill: colors.accent, fontSize: 10, fontFamily: "var(--hv-mono)" }} />
              )}
              {spec.usl !== null && capData.some((d) => d.lo <= spec.usl! && spec.usl! < d.hi) && (
                <ReferenceLine x={capData.find((d) => d.lo <= spec.usl! && spec.usl! < d.hi)!.x} stroke={colors.accent} strokeDasharray="4 3"
                  label={{ value: "USL", position: "top", fill: colors.accent, fontSize: 10, fontFamily: "var(--hv-mono)" }} />
              )}
              {capData.some((d) => d.lo <= stats.xbarBar && stats.xbarBar < d.hi) && (
                <ReferenceLine x={capData.find((d) => d.lo <= stats.xbarBar && stats.xbarBar < d.hi)!.x} stroke={colors.ink2}
                  label={{ value: "X̿", position: "top", fill: colors.ink2, fontSize: 10, fontFamily: "var(--hv-mono)" }} />
              )}
              <Bar dataKey="count" isAnimationActive={false}>
                {capData.map((b) => {
                  const out = (spec.usl !== null && b.lo >= spec.usl) || (spec.lsl !== null && b.hi <= spec.lsl);
                  return <Cell key={b.x} fill={out ? colors.stop : colors.ink2} fillOpacity={out ? 0.9 : 0.45} />;
                })}
              </Bar>
              <Line type="monotone" dataKey="curve" stroke={colors.ink} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cpk 추이 */}
      {cpkTrend.length > 1 && (
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="hv-label">{t("quality.spc.hv.cpkTrend", "Cpk 추이")}</span>
            <span className="hv-num text-[10px]" style={{ color: "var(--hv-ink-mute)" }}>
              {t("quality.spc.hv.cpkTrendHint", "최근 {{n}} 서브그룹 이동 창", { n: CPK_WINDOW })} · {t("quality.spc.hv.cpkGood", "양호")} ≥ {CPK_GOOD} · {t("quality.spc.hv.cpkMin", "최소")} {CPK_MIN}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={cpkTrend} margin={{ top: 8, right: 52, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={colors.line} vertical={false} />
              <XAxis dataKey="label" tick={tick} interval="preserveStartEnd" minTickGap={28} />
              <YAxis domain={cpkDomain} tick={tick} width={58} tickFormatter={(v: number) => v.toFixed(2)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [typeof v === "number" ? v.toFixed(2) : "-", "Cpk"]} />
              <ReferenceArea y1={cpkDomain[0]} y2={CPK_MIN} fill={colors.stop} fillOpacity={0.08} />
              <ReferenceLine y={CPK_GOOD} stroke={colors.ink2} strokeDasharray="6 3"
                label={{ value: `${CPK_GOOD}`, position: "right", fill: colors.ink2, fontSize: 10, fontFamily: "var(--hv-mono)" }} />
              <ReferenceLine y={CPK_MIN} stroke={colors.stop} strokeDasharray="6 3"
                label={{ value: `${CPK_MIN}`, position: "right", fill: colors.stop, fontSize: 10, fontFamily: "var(--hv-mono)" }} />
              <Line
                type="monotone"
                dataKey="cpk"
                stroke={colors.ink}
                strokeWidth={1.5}
                isAnimationActive={false}
                connectNulls
                dot={(props: { cx?: number; cy?: number; payload?: { id: number; cpk: number | null } }) => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined || !payload || payload.cpk === null) return <g key={`cpk-none-${payload?.id ?? "x"}`} />;
                  const fill = payload.cpk < CPK_MIN ? colors.stop : payload.cpk < CPK_GOOD ? colors.warn : colors.ink;
                  return <circle key={`cpk-${payload.id}`} cx={cx} cy={cy} r={payload.cpk < CPK_GOOD ? 3.5 : 2} fill={fill} />;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
