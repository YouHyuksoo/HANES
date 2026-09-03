"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/RadialLayout.tsx
 * @description 형태 4 "시계판" — 24시간 원형 시계판 위에 하루를 올려놓는다.
 *
 *   바깥 링 : 시간대별 실적을 방사형 막대로(양품 primary, 그 바깥에 불량 error). 0시가 12시 방향.
 *   바늘    : 지금 시각. 분까지 반영해서 천천히 돈다.
 *   안쪽 링 : 물류 5단계 압력 호(arc). 초록/노랑/빨강. 누르면 우측 조치 큐가 그 단계로 좁혀진다.
 *   중심    : 달성률(대형) + 실적/계획 + 불량률.
 *   우측    : 7일 불량률 스파크 → 오늘 점검 레일 → 조치 필요 큐.
 *
 * 각도 계산은 polar() 한 곳에서만 한다(12시 방향이 0°, 시계 방향).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardLayoutProps } from "./layouts";
import { FLOW_STAGES, pressureByStation, pressureTone, stationOf, type FlowStage } from "./attentionStage";
import { TrendSpark } from "./RhythmStrip";
import InspectRails from "./InspectRails";
import AttentionQueue from "./AttentionQueue";

const C = 210;             // 중심
const R_BAR = 150;         // 시간 막대 시작 반지름
const BAR_MAX = 44;        // 막대 최대 길이
const R_STAGE = 118;       // 단계 링 반지름
const STAGE_W = 16;
const STAGE_GAP_DEG = 5;
const R_LABEL = 206;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function arcPath(r: number, from: number, to: number) {
  const a = polar(r, from);
  const b = polar(r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

type Tone = "success" | "warning" | "error";
const STROKE: Record<Tone, string> = { success: "stroke-success", warning: "stroke-warning", error: "stroke-error" };
const TEXT: Record<Tone, string> = { success: "text-success", warning: "text-warning", error: "text-error" };

export default function RadialLayout({ data, attention, attentionCount, now }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<FlowStage | null>(null);
  const { production, quality } = data;

  const pressure = useMemo(() => pressureByStation(attention), [attention]);

  const bars = useMemo(() => {
    const map = new Map((production?.hourly ?? []).map((h) => [Number(h.hour), h]));
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const max = Math.max(1, ...hours.map((h) => (map.get(h)?.goodQty ?? 0) + (map.get(h)?.defectQty ?? 0)));
    return hours.map((h) => {
      const good = map.get(h)?.goodQty ?? 0;
      const defect = map.get(h)?.defectQty ?? 0;
      return { h, good, defect, goodLen: (good / max) * BAR_MAX, defectLen: (defect / max) * BAR_MAX };
    });
  }, [production]);

  const nowDeg = now ? (now.getHours() + now.getMinutes() / 60) * 15 : null;
  const achieve = production?.kpi.achieveRate ?? 0;
  const defectRate = quality?.kpi.defectRate ?? 0;

  const visible = useMemo(() => (selected ? attention.filter((a) => stationOf(a) === selected) : attention), [attention, selected]);
  const visibleCount = selected ? visible.reduce((n, a) => n + a.count, 0) : attentionCount;
  const span = 360 / FLOW_STAGES.length;
  const toggle = (id: FlowStage) => setSelected((prev) => (prev === id ? null : id));

  const hand = nowDeg === null ? null : { a: polar(R_STAGE + STAGE_W, nowDeg), b: polar(R_BAR + BAR_MAX + 6, nowDeg) };

  return (
    <div className="flex-1 min-h-0 flex gap-6">
      {/* 시계판 */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{t("dashboard.radial.hourRing")}</span>
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] text-text-muted flex items-center gap-3">
            <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-primary" />{t("dashboard.rhythm.good")}</span>
            <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 bg-error" />{t("dashboard.rhythm.defect")}</span>
          </span>
        </div>

        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          <svg viewBox="0 0 420 420" className="h-full max-h-[560px] w-auto max-w-full overflow-visible select-none" role="group" aria-label={t("dashboard.radial.hourRing")}>
            {/* 시간 눈금 원 */}
            <circle cx={C} cy={C} r={R_BAR - 4} fill="none" className="stroke-border" strokeWidth="1" />
            {bars.map((b, i) => {
              const deg = b.h * 15;
              const p0 = polar(R_BAR, deg);
              const p1 = polar(R_BAR + b.goodLen, deg);
              const p2 = polar(R_BAR + b.goodLen + b.defectLen, deg);
              const isNow = now ? b.h === now.getHours() : false;
              return (
                <g key={b.h} className="ds-rise" style={{ animationDelay: `${200 + i * 20}ms` }}>
                  <title>{`${String(b.h).padStart(2, "0")}:00  ${b.good.toLocaleString()} / ${b.defect.toLocaleString()}`}</title>
                  {/* 빈 시간도 흐린 점으로 자리 표시 */}
                  <circle cx={p0.x} cy={p0.y} r={1.5} className="fill-border" />
                  {b.goodLen > 0 && <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} className={isNow ? "stroke-primary" : "stroke-primary/60"} strokeWidth="9" />}
                  {b.defectLen > 0 && <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="stroke-error" strokeWidth="9" />}
                </g>
              );
            })}
            {[0, 6, 12, 18].map((h) => {
              const p = polar(R_LABEL, h * 15);
              return (
                <text key={h} x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {String(h).padStart(2, "0")}
                </text>
              );
            })}

            {/* 단계 압력 링 */}
            {FLOW_STAGES.map((id, i) => {
              const from = i * span + STAGE_GAP_DEG / 2;
              const to = (i + 1) * span - STAGE_GAP_DEG / 2;
              const p = pressure[id] ?? 0;
              const tone = pressureTone(p);
              const isSel = id === selected;
              const mid = polar(R_STAGE, (from + to) / 2);
              return (
                <g
                  key={id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSel}
                  aria-label={t(`dashboard.stream.${id}`)}
                  className="cursor-pointer focus:outline-none"
                  onClick={() => toggle(id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(id); } }}
                >
                  <path d={arcPath(R_STAGE, from, to)} fill="none" className={isSel ? "stroke-primary" : STROKE[tone]} strokeWidth={isSel ? STAGE_W + 6 : STAGE_W} strokeOpacity={isSel || p > 0 ? 1 : 0.35} />
                  <text x={mid.x} y={mid.y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" className="fill-background" letterSpacing="0.5">
                    {t(`dashboard.stream.${id}`)}{p > 0 ? ` ${p}` : ""}
                  </text>
                </g>
              );
            })}

            {/* 지금 바늘 */}
            {hand && (
              <g aria-hidden>
                <line x1={hand.a.x} y1={hand.a.y} x2={hand.b.x} y2={hand.b.y} className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                <circle cx={hand.b.x} cy={hand.b.y} r={4} className="fill-primary ds-blink" />
              </g>
            )}
          </svg>

          {/* 중심 숫자 — SVG 위에 HTML 로 얹어 서체 토큰을 그대로 쓴다 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">{t("dashboard.radial.center")}</div>
            <div className="text-5xl font-extrabold tabular-nums leading-none tracking-tight text-primary mt-1">
              {achieve.toFixed(1)}<span className="text-lg text-text-muted">%</span>
            </div>
            <div className="font-mono text-xs tabular-nums text-text-muted mt-2">
              <b className="text-text">{(production?.kpi.goodQty ?? 0).toLocaleString()}</b> / {(production?.kpi.planQty ?? 0).toLocaleString()}
            </div>
            <div className={`font-mono text-xs tabular-nums mt-1 ${defectRate >= 3 ? "text-error" : "text-text-muted"}`}>
              {t("dashboard.pulse.defectRate")} {defectRate.toFixed(1)}%
            </div>
            {now && (
              <div className="text-[10px] text-text-muted mt-2 tabular-nums">
                {t("dashboard.radial.now")} {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </div>
            )}
          </div>
        </div>

        {/* 단계 범례 — 호와 같은 클릭 대상 */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 pt-2 border-t border-border">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mr-2">{t("dashboard.radial.stageRing")}</span>
          {FLOW_STAGES.map((id) => {
            const p = pressure[id] ?? 0;
            const isSel = id === selected;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSel}
                onClick={() => toggle(id)}
                className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${isSel ? "border-primary text-primary" : "border-border text-text-muted hover:text-text"}`}
              >
                {t(`dashboard.stream.${id}`)} <span className={`font-mono tabular-nums ${TEXT[pressureTone(p)]}`}>{p}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 우측 */}
      <aside className="w-[360px] xl:w-[420px] flex-shrink-0 min-h-0 border-l border-border pl-5 flex flex-col gap-4">
        <div className="flex-shrink-0 flex h-[96px]">
          <TrendSpark data={data} />
        </div>
        <div className="flex-shrink-0 border-t border-border pt-3">
          <InspectRails summary={data.summary} />
        </div>
        <div className="flex-1 min-h-0 border-t border-border pt-3">
          <AttentionQueue items={visible} total={visibleCount} />
        </div>
      </aside>
    </div>
  );
}
