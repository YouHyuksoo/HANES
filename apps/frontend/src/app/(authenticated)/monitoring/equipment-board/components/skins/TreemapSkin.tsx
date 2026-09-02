"use client";

/**
 * @file .../equipment-board/components/skins/TreemapSkin.tsx
 * @description 설비 스킨 C "트리맵" — 다크 편집(차콜+본색+레드 포인트). 화면 전체를 설비 타일로
 *              빈틈없이 분할(squarified treemap). 작업중 설비는 계획수량이 클수록 타일이 크고,
 *              대기/정지/점검은 작은 타일로 밀려난다. 작업중 타일은 바닥에서 달성률만큼 차오르고,
 *              정지는 레드 반전, 인터록·점검은 빗금. 순환 없음(전체 한눈에).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { achieveRate, visualState, type EquipCard, type EquipSkinProps, type EquipVisualState } from "../types";

const INK = "#14120e";
const BONE = "#ece7da";
const RULE = "#3a352c";
const MUTED = "#8d887c";
const RED = "#f0402c";

interface Rect { x: number; y: number; w: number; h: number }
interface Weighted { equip: EquipCard; weight: number }
interface Tile { equip: EquipCard; rect: Rect }

/** squarified treemap — 무게 내림차순으로 정렬해 종횡비가 가장 정사각형에 가깝게 행을 쌓는다 */
function squarify(items: Weighted[], bounds: Rect): Tile[] {
  const sorted = [...items].filter((i) => i.weight > 0).sort((a, b) => b.weight - a.weight);
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  if (sorted.length === 0 || total <= 0 || bounds.w <= 0 || bounds.h <= 0) return [];
  const scale = (bounds.w * bounds.h) / total;
  const areas = sorted.map((i) => ({ equip: i.equip, area: i.weight * scale }));

  const out: Tile[] = [];
  let rect = { ...bounds };
  let row: { equip: EquipCard; area: number }[] = [];

  const worst = (r: { area: number }[], side: number) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (s === 0) return Infinity;
    const s2 = s * s;
    const l2 = side * side;
    let max = 0;
    for (const it of r) max = Math.max(max, (l2 * it.area) / s2, s2 / (l2 * it.area));
    return max;
  };

  const layoutRow = (r: { equip: EquipCard; area: number }[]) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (rect.w >= rect.h) {
      const rowW = s / rect.h;
      let y = rect.y;
      for (const it of r) {
        const h = it.area / rowW;
        out.push({ equip: it.equip, rect: { x: rect.x, y, w: rowW, h } });
        y += h;
      }
      rect = { x: rect.x + rowW, y: rect.y, w: rect.w - rowW, h: rect.h };
    } else {
      const rowH = s / rect.w;
      let x = rect.x;
      for (const it of r) {
        const w = it.area / rowH;
        out.push({ equip: it.equip, rect: { x, y: rect.y, w, h: rowH } });
        x += w;
      }
      rect = { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
    }
  };

  for (const it of areas) {
    const side = Math.min(rect.w, rect.h);
    if (row.length === 0 || worst([...row, it], side) <= worst(row, side)) {
      row.push(it);
    } else {
      layoutRow(row);
      row = [it];
    }
  }
  if (row.length > 0) layoutRow(row);
  return out;
}

/** 편집형 팔레트 — 색이 아니라 명도·패턴으로 상태를 구분하고, 레드는 정지에만 */
const TILE: Record<EquipVisualState, { bg: string; border: string; fg: string; sub: string; dash?: boolean }> = {
  RUN: { bg: "rgba(236,231,218,0.06)", border: BONE, fg: BONE, sub: MUTED },
  IDLE: { bg: "transparent", border: RULE, fg: MUTED, sub: "#5c574b" },
  MAINT: { bg: "repeating-linear-gradient(45deg, rgba(236,231,218,0.10) 0 6px, transparent 6px 14px)", border: "#a39d8e", fg: BONE, sub: MUTED, dash: true },
  STOP: { bg: RED, border: RED, fg: INK, sub: "rgba(20,18,14,0.7)" },
  INTERLOCK: { bg: "repeating-linear-gradient(135deg, rgba(240,64,44,0.18) 0 6px, transparent 6px 14px)", border: RED, fg: BONE, sub: MUTED, dash: true },
};

export default function TreemapSkin({ equips, jobMap, counts, workingCount, updatedAt }: EquipSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1600, h: 800 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles = useMemo(() => {
    const plans = equips.map((e) => jobMap.get(e.equipCode)?.planQty ?? 0).filter((p) => p > 0).sort((a, b) => a - b);
    const median = plans.length > 0 ? plans[Math.floor(plans.length / 2)] : 0;
    const base = Math.max(1, median * 0.3);
    const weighted: Weighted[] = equips.map((e) => {
      const job = jobMap.get(e.equipCode);
      return { equip: e, weight: job && job.planQty > 0 ? Math.max(base, job.planQty) : base };
    });
    return squarify(weighted, { x: 0, y: 0, w: size.w, h: size.h });
  }, [equips, jobMap, size]);

  const stateLabel = (code: string, fallback: string) => t(`comCode.EQUIP_STATUS.${code}`, { defaultValue: fallback });
  const troubleCount = counts.STOP + counts.MAINT + counts.INTERLOCK;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: INK, color: BONE }}>
      <style>{`
        @keyframes etm-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .etm-disp { font-family: 'Anton', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 마스트헤드 — 얇게, 타일에 면적을 양보 */}
      <div className="flex items-end justify-between px-8 pt-4 pb-2.5 border-b-[5px] flex-shrink-0" style={{ borderColor: BONE }}>
        <div className="flex items-baseline gap-5 min-w-0">
          <span className="text-3xl font-black whitespace-nowrap">{t("menu.equipment.status")}</span>
          <span className="inline-flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ background: RED, animation: "etm-blink 1.6s infinite" }} />
            <span className="font-mono text-sm tracking-[0.3em]" style={{ color: RED }}>TREEMAP</span>
          </span>
          <span className="font-mono text-xs whitespace-nowrap hidden 2xl:inline" style={{ color: MUTED }}>
            {t("equipment.status.monitoring", "모니터링")} {equips.length}{t("equipment.status.unit", "대")} · {t("equipment.status.updatedAt", "갱신")} {updatedAt}
          </span>
        </div>
        <div className="flex items-end gap-7 mr-72 shrink-0">
          {[
            { label: t("equipment.status.working", "작업중"), n: workingCount, warn: false },
            { label: stateLabel("STOP", "정지"), n: counts.STOP, warn: true },
            { label: stateLabel("MAINT", "점검"), n: counts.MAINT, warn: true },
            { label: stateLabel("INTERLOCK", "인터록"), n: counts.INTERLOCK, warn: true },
          ].map((k) => (
            <span key={k.label} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-xs tracking-[0.25em]" style={{ color: MUTED }}>{k.label}</span>
              <span className="etm-disp text-3xl leading-none" style={{ color: k.warn && k.n > 0 ? RED : k.n > 0 ? BONE : RULE }}>{k.n}</span>
            </span>
          ))}
          <span className="etm-disp text-4xl leading-none" style={{ color: troubleCount > 0 ? RED : BONE }}>{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 트리맵 */}
      <div ref={ref} className="flex-1 min-h-0 relative">
        {tiles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: MUTED }}>
            {t("equipment.status.noEquip", "표시할 설비가 없습니다.")}
          </div>
        )}
        {tiles.map(({ equip: e, rect }) => {
          const job = jobMap.get(e.equipCode);
          const st = visualState(e, job);
          const tile = TILE[st];
          const rate = achieveRate(job);
          const small = rect.w < 150 || rect.h < 90;
          const tiny = rect.w < 90 || rect.h < 56;
          const codeSize = Math.max(12, Math.min(44, Math.min(rect.w / 7, rect.h / 4)));
          return (
            <div key={e.equipCode} className="absolute overflow-hidden"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, padding: 3 }}>
              <div className="relative w-full h-full overflow-hidden"
                style={{
                  background: tile.bg,
                  border: `${st === "RUN" || st === "STOP" ? 2 : 1}px ${tile.dash ? "dashed" : "solid"} ${tile.border}`,
                  animation: st === "STOP" ? "etm-blink 1.2s infinite" : "none",
                }}>
                {st === "RUN" && (
                  <div className="absolute left-0 right-0 bottom-0" style={{ height: `${Math.min(100, rate)}%`, background: "rgba(236,231,218,0.16)", transition: "height 0.6s" }} />
                )}
                <div className="relative h-full flex flex-col p-2 pl-3 min-w-0">
                  <div className="etm-disp leading-none truncate" style={{ fontSize: codeSize, color: tile.fg }} title={e.equipCode}>{e.equipCode}</div>
                  {!tiny && (
                    <div className="truncate leading-tight" style={{ fontSize: Math.max(10, codeSize * 0.4), color: tile.sub }}>{e.equipName}</div>
                  )}
                  {!small && (
                    <div className="mt-auto min-w-0">
                      {st === "RUN" && job ? (
                        <div className="flex items-end gap-2 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate leading-tight" style={{ fontSize: Math.max(11, codeSize * 0.5), color: tile.fg }}>{job.itemName || job.orderNo}</div>
                            <div className="font-mono tabular-nums truncate" style={{ fontSize: Math.max(11, codeSize * 0.42), color: tile.sub }}>
                              <span style={{ color: tile.fg }}>{job.goodQty.toLocaleString()}</span> / {job.planQty.toLocaleString()}
                              {job.defectQty > 0 && <span style={{ color: RED }}> · {t("monitoring.board.defect", "불량")} {job.defectQty}</span>}
                            </div>
                          </div>
                          <span className="etm-disp leading-none shrink-0" style={{ fontSize: Math.min(56, codeSize * 1.4), color: rate >= 100 ? RED : tile.fg }}>{rate}%</span>
                        </div>
                      ) : (
                        <div className="font-bold tracking-[0.15em]" style={{ fontSize: Math.max(11, codeSize * 0.45), color: tile.fg }}>
                          {st === "IDLE" ? t("equipment.status.noJob", "작업 대기") : stateLabel(e.status, e.status)}
                        </div>
                      )}
                    </div>
                  )}
                  {small && !tiny && st !== "RUN" && (
                    <div className="mt-auto font-bold tracking-[0.1em] truncate" style={{ fontSize: 10, color: tile.fg }}>
                      {st === "IDLE" ? t("equipment.status.noJob", "작업 대기") : stateLabel(e.status, e.status)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
