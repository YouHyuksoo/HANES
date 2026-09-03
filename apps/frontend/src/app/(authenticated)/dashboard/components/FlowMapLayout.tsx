"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/FlowMapLayout.tsx
 * @description 형태 3 "노선도" — 지하철 노선도처럼 공장을 읽는다.
 *
 *   물류 라인(위)  : 입고 ─ 자재 ─ 생산 ─ 품질 ─ 제품. 역마다 대표 숫자, 압력(조치 건수)만큼 링이 켜진다.
 *   설비 라인(아래): 일상 ─ 정기 ─ 예방보전. 생산역에서 환승(세로 연결)한다.
 *   역을 누르면 아래 왼쪽에 그 역의 지표, 오른쪽에 그 역의 조치 항목만(드릴다운 포함) 보인다.
 *   아무 역도 안 고르면 전체 조치 큐가 보인다. 다시 누르면 해제.
 *
 * 좌표는 viewBox(1000×270) 기준이라 화면 폭에 맞춰 통째로 늘어난다(글자도 함께).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardLayoutProps } from "./layouts";
import type { InspectSummary } from "./types";
import { emptyInspect } from "./types";
import { EQUIP_STAGES, FLOW_STAGES, pressureByStation, pressureTone, stationOf, type Station } from "./attentionStage";
import { Skyline } from "./RhythmStrip";
import AttentionQueue from "./AttentionQueue";

const FLOW_Y = 78;
const EQUIP_Y = 200;
const FLOW_X: Record<string, number> = { receive: 100, material: 300, production: 500, quality: 700, product: 900 };
const EQUIP_X: Record<string, number> = { daily: 300, periodic: 500, pm: 700 };

type Tone = "success" | "warning" | "error";
const STROKE: Record<Tone, string> = { success: "stroke-success", warning: "stroke-warning", error: "stroke-error" };
const FILL: Record<Tone, string> = { success: "fill-success", warning: "fill-warning", error: "fill-error" };
const TEXT: Record<Tone, string> = { success: "text-success", warning: "text-warning", error: "text-error" };

interface StationView {
  id: Station;
  x: number;
  y: number;
  hero: string;
  sub?: string;
  pressure: number;
  /** 라벨을 역 위에 둘지(물류) 아래 둘지(설비) */
  labelAbove: boolean;
}

function inspectHero(s: InspectSummary) {
  return { hero: `${s.completed}/${s.total}`, sub: s.fail > 0 ? `✕${s.fail}` : undefined };
}

const isFlow = (id: Station) => (FLOW_STAGES as readonly string[]).includes(id);

export default function FlowMapLayout({ data, attention, attentionCount, now }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Station | null>(null);
  const { summary, production, quality, inventory } = data;
  const running = (production?.kpi.runningCount ?? 0) > 0;

  const pressure = useMemo(() => pressureByStation(attention), [attention]);

  const stations: StationView[] = useMemo(() => {
    const flowHero: Record<string, { hero: string; sub?: string }> = {
      receive: { hero: (inventory?.kpi.inCount ?? 0).toLocaleString(), sub: t("dashboard.stream.receiveHero") },
      material: { hero: (inventory?.kpi.outCount ?? 0).toLocaleString(), sub: t("dashboard.stream.materialHero") },
      production: { hero: `${(production?.kpi.goodQty ?? 0).toLocaleString()} / ${(production?.kpi.planQty ?? 0).toLocaleString()}`, sub: t("dashboard.stream.productionHero") },
      quality: { hero: `${(quality?.kpi.defectRate ?? 0).toFixed(1)}%`, sub: t("dashboard.stream.qualityHero") },
      product: { hero: `${summary?.job.done ?? 0} / ${summary?.job.total ?? 0}`, sub: t("dashboard.stream.productHero") },
    };
    const flow = FLOW_STAGES.map((id): StationView => ({ id, x: FLOW_X[id], y: FLOW_Y, ...flowHero[id], pressure: pressure[id] ?? 0, labelAbove: true }));
    const equip = EQUIP_STAGES.map((id): StationView => ({ id, x: EQUIP_X[id], y: EQUIP_Y, ...inspectHero(summary?.[id] ?? emptyInspect), pressure: pressure[id] ?? 0, labelAbove: false }));
    return [...flow, ...equip];
  }, [inventory, production, quality, summary, pressure, t]);

  const visible = useMemo(() => (selected ? attention.filter((a) => stationOf(a) === selected) : attention), [attention, selected]);
  const visibleCount = selected ? visible.reduce((n, a) => n + a.count, 0) : attentionCount;
  const current = stations.find((s) => s.id === selected) ?? null;
  const stationName = (id: Station) => (isFlow(id) ? t(`dashboard.stream.${id}`) : t(`dashboard.inspect.${id}`));
  const toggle = (id: Station) => setSelected((prev) => (prev === id ? null : id));

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* 노선도 */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{t("dashboard.layout.map")}</span>
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] text-text-muted">{t("dashboard.map.hint")}</span>
        </div>
        <svg viewBox="0 0 1000 270" className="w-full h-[240px] xl:h-[280px] overflow-visible select-none" role="group" aria-label={t("dashboard.layout.map")}>
          {/* 라인 */}
          <line x1={FLOW_X.receive} y1={FLOW_Y} x2={FLOW_X.product} y2={FLOW_Y} className="stroke-border" strokeWidth="10" strokeLinecap="round" />
          {running && <line x1={FLOW_X.receive} y1={FLOW_Y} x2={FLOW_X.product} y2={FLOW_Y} className="stroke-primary ds-flow" strokeWidth="3" strokeDasharray="10 18" strokeLinecap="round" />}
          <line x1={EQUIP_X.daily} y1={EQUIP_Y} x2={EQUIP_X.pm} y2={EQUIP_Y} className="stroke-border" strokeWidth="10" strokeLinecap="round" />
          <line x1={FLOW_X.production} y1={FLOW_Y} x2={EQUIP_X.periodic} y2={EQUIP_Y} className="stroke-border" strokeWidth="6" strokeDasharray="2 8" strokeLinecap="round" />
          <text x={FLOW_X.receive - 60} y={FLOW_Y + 4} className="fill-text-muted" fontSize="11" fontWeight="600" textAnchor="end" letterSpacing="2">{t("dashboard.map.flowLine")}</text>
          <text x={EQUIP_X.daily - 60} y={EQUIP_Y + 4} className="fill-text-muted" fontSize="11" fontWeight="600" textAnchor="end" letterSpacing="2">{t("dashboard.map.equipLine")}</text>

          {/* 역 */}
          {stations.map((s, i) => {
            const tone = pressureTone(s.pressure);
            const isSel = s.id === selected;
            const dir = s.labelAbove ? -1 : 1;
            const shift = s.labelAbove ? 0 : 2;
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={stationName(s.id)}
                className="cursor-pointer ds-rise focus:outline-none"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => toggle(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(s.id); } }}
              >
                {/* 압력 링 — 조치가 있을 때만 켜지고, 선택되면 primary 로 */}
                {(s.pressure > 0 || isSel) && (
                  <circle
                    cx={s.x} cy={s.y} r={28} fill="none"
                    className={isSel ? "stroke-primary" : `${STROKE[tone]} ${tone === "error" ? "ds-blink" : ""}`}
                    strokeWidth={isSel ? 3 : 2}
                    strokeDasharray={isSel ? undefined : "4 4"}
                  />
                )}
                <circle cx={s.x} cy={s.y} r={16} className={`fill-background ${isSel ? "stroke-primary" : STROKE[tone]}`} strokeWidth="5" />
                {s.pressure > 0 && (
                  <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize="12" fontWeight="800" className={isSel ? "fill-primary" : FILL[tone]}>{s.pressure}</text>
                )}
                {/* 역명 */}
                <text x={s.x} y={s.y + dir * 40} textAnchor="middle" fontSize="15" fontWeight="800" letterSpacing="1" className={isSel ? "fill-primary" : "fill-text"}>{stationName(s.id)}</text>
                {/* 대표 숫자 */}
                <text x={s.x} y={s.y + dir * 60 + shift} textAnchor="middle" fontSize="13" fontWeight="700" className="fill-text" style={{ fontVariantNumeric: "tabular-nums" }}>{s.hero}</text>
                {s.sub && (
                  <text x={s.x} y={s.y + dir * 76 + shift} textAnchor="middle" fontSize="10" className={s.sub.startsWith("✕") ? "fill-error" : "fill-text-muted"}>{s.sub}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 아래: 역 정보 + 그 역의 조치 */}
      <div className="flex-1 min-h-0 flex gap-6">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4">
          <div className="flex items-baseline gap-3 border-b border-border pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{t("dashboard.map.station")}</span>
            <span className={`text-2xl font-extrabold tracking-tight ${current ? "text-primary" : "text-text"}`}>{current ? stationName(current.id) : t("dashboard.map.all")}</span>
            {current && (
              <span className="ml-auto font-mono text-sm tabular-nums text-text-muted">
                {current.hero}
                {current.sub && <span className={`ml-2 ${current.sub.startsWith("✕") ? "text-error" : ""}`}>{current.sub}</span>}
              </span>
            )}
            {current && (
              <span className={`font-mono text-sm font-bold tabular-nums ${TEXT[pressureTone(current.pressure)]}`}>
                {t("dashboard.map.pressure")} {current.pressure}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-[120px] flex">
            <Skyline data={data} nowHour={now ? now.getHours() : null} />
          </div>
        </div>
        <aside className="w-[340px] xl:w-[400px] flex-shrink-0 min-h-0 border-l border-border pl-5">
          <AttentionQueue items={visible} total={visibleCount} />
        </aside>
      </div>
    </div>
  );
}
