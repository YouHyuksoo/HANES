"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/RhythmStrip.tsx
 * @description 오늘의 리듬 — 시간대별(06~22시) 실적 스카이라인 + 최근 7일 불량률 스파크라인.
 *              현재 시각 열은 밑줄 마커로 표시한다. 차트 라이브러리 없이 div/SVG 로 그린다.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardData } from "./types";

const HOUR_START = 6;
const HOUR_END = 22;

export function Skyline({ data, nowHour }: { data: DashboardData; nowHour: number | null }) {
  const { t } = useTranslation();
  const hourly = data.production?.hourly ?? [];

  const cols = useMemo(() => {
    const map = new Map(hourly.map((h) => [Number(h.hour), h]));
    const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START);
    const max = Math.max(1, ...hours.map((h) => (map.get(h)?.goodQty ?? 0) + (map.get(h)?.defectQty ?? 0)));
    return hours.map((h) => {
      const p = map.get(h);
      const good = p?.goodQty ?? 0;
      const defect = p?.defectQty ?? 0;
      return { hour: h, good, defect, goodPct: (good / max) * 100, defectPct: (defect / max) * 100 };
    });
  }, [hourly]);

  const hasAny = cols.some((c) => c.good + c.defect > 0);

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{t("dashboard.rhythm.hourly")}</span>
        <span className="text-[11px] text-text-muted flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-primary" />{t("dashboard.rhythm.good")}</span>
          <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-error" />{t("dashboard.rhythm.defect")}</span>
        </span>
      </div>
      <div className="relative flex-1 min-h-[72px] mt-2 flex items-end gap-[3px] border-b border-border">
        {!hasAny && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">{t("dashboard.rhythm.noHourly")}</span>
        )}
        {cols.map((c, i) => (
          <div key={c.hour} className="flex-1 h-full flex flex-col justify-end ds-grow" style={{ animationDelay: `${300 + i * 25}ms` }} title={`${c.hour}:00  ${c.good.toLocaleString()} / ${c.defect.toLocaleString()}`}>
            <div className="bg-error" style={{ height: `${c.defectPct}%` }} />
            <div className={`${c.hour === nowHour ? "bg-primary" : "bg-primary/60"}`} style={{ height: `${c.goodPct}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {cols.map((c) => (
          <div key={c.hour} className={`flex-1 text-center font-mono text-[10px] leading-none ${c.hour === nowHour ? "text-primary font-bold" : "text-text-muted"}`}>
            {c.hour % 2 === 0 ? String(c.hour).padStart(2, "0") : ""}
            {c.hour === nowHour && <div className="h-[2px] bg-primary mt-1 mx-auto w-full" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendSpark({ data }: { data: DashboardData }) {
  const { t } = useTranslation();
  const trend = data.quality?.dailyTrend ?? [];

  const W = 160;
  const H = 56;
  const geo = useMemo(() => {
    if (trend.length === 0) return null;
    const max = Math.max(1, ...trend.map((p) => p.defectRate));
    const step = trend.length > 1 ? W / (trend.length - 1) : 0;
    const pts = trend.map((p, i) => ({ x: i * step, y: H - (p.defectRate / max) * (H - 6) - 3, rate: p.defectRate, date: p.date }));
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return { pts, d, last: pts[pts.length - 1] };
  }, [trend]);

  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = last && prev ? last.defectRate - prev.defectRate : null;

  return (
    <div className="w-[220px] xl:w-[260px] flex-shrink-0 flex flex-col border-l border-border pl-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{t("dashboard.rhythm.trend7")}</span>
      <div className="flex items-end gap-4 mt-2 flex-1">
        <div className="flex-1 min-w-0">
          {geo ? (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14 overflow-visible" preserveAspectRatio="none">
              <path d={geo.d} fill="none" className="stroke-error" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
              {geo.pts.map((p) => (
                <circle key={p.date} cx={p.x} cy={p.y} r="1.6" className="fill-error" />
              ))}
              <circle cx={geo.last.x} cy={geo.last.y} r="3.5" className="fill-error ds-blink" />
            </svg>
          ) : (
            <div className="h-14 flex items-center text-xs text-text-muted">{t("dashboard.rhythm.noTrend")}</div>
          )}
        </div>
        <div className="text-right">
          <div className={`text-2xl font-extrabold tabular-nums leading-none ${(last?.defectRate ?? 0) >= 3 ? "text-error" : "text-text"}`}>
            {(last?.defectRate ?? 0).toFixed(1)}<span className="text-xs text-text-muted ml-0.5">%</span>
          </div>
          {delta !== null && (
            <div className={`text-[11px] font-mono mt-1 ${delta > 0 ? "text-error" : delta < 0 ? "text-success" : "text-text-muted"}`}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta).toFixed(1)}p
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RhythmStrip({ data, nowHour }: { data: DashboardData; nowHour: number | null }) {
  return (
    <div className="flex-1 min-h-0 flex gap-5">
      <Skyline data={data} nowHour={nowHour} />
      <TrendSpark data={data} />
    </div>
  );
}
