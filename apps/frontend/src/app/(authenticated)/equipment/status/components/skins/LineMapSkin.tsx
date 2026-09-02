"use client";

/**
 * @file .../equipment/status/components/skins/LineMapSkin.tsx
 * @description 설비 스킨 A "노선도" — 지하철 노선도처럼 라인(lineCode)마다 레일을 긋고
 *              설비를 역(노드)으로 배치. 노드 색=상태, 작업중이면 진행률 링이 채워진다.
 *              레일이 많으면 rollingSec 간격으로 페이지 순환(한 페이지 최대 4레일).
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { useRotation } from "@/components/monitoring";
import { achieveRate, STATE_COLOR, visualState, type EquipCard, type EquipSkinProps } from "../types";

const RAILS_PER_PAGE = 4;
const MAX_NODES = 18;
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

interface Rail { line: string; equips: EquipCard[] }

export default function LineMapSkin({ equips, jobMap, counts, workingCount, rollingSec, paused, updatedAt }: EquipSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const rails = useMemo<Rail[]>(() => {
    const m = new Map<string, EquipCard[]>();
    for (const e of equips) {
      const key = e.lineCode ?? "—";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([line, list]) => ({ line, equips: list }));
  }, [equips]);

  const { pageItems, page, pageCount } = useRotation(rails, RAILS_PER_PAGE, rollingSec, paused);
  const stateLabel = (code: string, fallback: string) => t(`comCode.EQUIP_STATUS.${code}`, { defaultValue: fallback });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-[#e6edf7]"
      style={{ background: "radial-gradient(1200px 700px at 20% -10%, #0e1a2b 0%, #070b12 55%)" }}>
      <style>{`
        @keyframes elm-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes elm-flow { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -40; } }
        .elm-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-10 pt-5 pb-4 border-b border-[#16233a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: STATE_COLOR.RUN, boxShadow: `0 0 14px ${STATE_COLOR.RUN}`, animation: "elm-pulse 1.6s ease-in-out infinite" }} />
          <span className="text-3xl font-black tracking-[0.22em] text-[#f1f6ff]">{t("equipment.status.title")}</span>
          <span className="elm-num text-xl font-semibold tracking-[0.3em] text-[#22d3ee]">LINE MAP</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg tracking-[0.2em] text-[#6b7d99]">{clock?.date ?? ""}</span>
          <span className="elm-num text-5xl font-bold text-[#f1f6ff]" style={{ textShadow: "0 0 24px rgba(34,211,238,0.35)" }}>
            {clock?.hm ?? "--:--"}<span className="text-[#3d5170]">:{clock?.sec ?? "--"}</span>
          </span>
        </div>
      </div>

      {/* 레일 */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly px-10 py-4">
        {pageItems.length === 0 ? (
          <div className="text-2xl text-[#3d5170] text-center">{t("equipment.status.noEquip", "표시할 설비가 없습니다.")}</div>
        ) : (
          pageItems.map((rail) => {
            const running = rail.equips.filter((e) => jobMap.has(e.equipCode)).length;
            const stopped = rail.equips.filter((e) => e.status === "STOP").length;
            return (
              <div key={rail.line} className="flex items-center min-h-0">
                {/* 라인 라벨 */}
                <div className="w-52 shrink-0 pr-5 border-r-2 border-[#16233a]">
                  <div className="text-sm tracking-[0.25em] text-[#6b7d99]">{t("equipment.status.line")}</div>
                  <div className="elm-num text-3xl font-bold text-[#f1f6ff] truncate" title={rail.line}>{rail.line}</div>
                  <div className="text-sm text-[#6b7d99] mt-1">
                    <span style={{ color: STATE_COLOR.RUN }}>{running}</span> / {rail.equips.length}
                    {stopped > 0 && <span className="ml-2" style={{ color: STATE_COLOR.STOP }}>■ {stopped}</span>}
                  </div>
                </div>

                {/* 레일 + 역 */}
                <div className="flex-1 min-w-0 relative flex items-start pl-8 overflow-hidden">
                  <svg className="absolute left-8 right-0 top-[42px] h-2" preserveAspectRatio="none" viewBox="0 0 100 8" style={{ width: "calc(100% - 2rem)" }}>
                    <line x1="0" y1="4" x2="100" y2="4" stroke="#16233a" strokeWidth="8" vectorEffect="non-scaling-stroke" />
                    <line x1="0" y1="4" x2="100" y2="4" stroke="#1f3352" strokeWidth="3" strokeDasharray="12 28" vectorEffect="non-scaling-stroke"
                      style={{ animation: "elm-flow 2.4s linear infinite" }} />
                  </svg>
                  <div className="relative flex gap-1 w-full">
                    {rail.equips.slice(0, MAX_NODES).map((e) => {
                      const job = jobMap.get(e.equipCode);
                      const st = visualState(e, job);
                      const color = STATE_COLOR[st];
                      const rate = achieveRate(job);
                      const blink = st === "STOP" || st === "INTERLOCK";
                      const dense = rail.equips.length > 8;
                      return (
                        <div key={e.equipCode} className="flex flex-col items-center min-w-0" style={{ flex: "1 1 0", maxWidth: 170 }}>
                          <div className="relative" style={{ width: dense ? 64 : 84, height: dense ? 64 : 84, marginTop: dense ? 10 : 0 }}>
                            <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
                              <circle cx="42" cy="42" r={RING_R} fill="#070b12" stroke="#16233a" strokeWidth="6" />
                              {st === "RUN" && (
                                <circle cx="42" cy="42" r={RING_R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                                  strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - Math.min(100, rate) / 100)}
                                  style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 0.6s" }} />
                              )}
                              <circle cx="42" cy="42" r="17" fill={color}
                                style={{ filter: `drop-shadow(0 0 ${st === "IDLE" ? 2 : 10}px ${color})`, opacity: st === "IDLE" ? 0.45 : 1, animation: blink ? "elm-pulse 1s infinite" : "none" }} />
                            </svg>
                            {st === "RUN" && (
                              <span className="absolute inset-0 flex items-center justify-center elm-num text-lg font-bold text-[#070b12]">{rate}</span>
                            )}
                          </div>
                          <div className={`elm-num font-bold text-[#f1f6ff] leading-tight truncate max-w-full ${dense ? "text-lg" : "text-2xl"}`}>{e.equipCode}</div>
                          <div className="text-xs text-[#6b7d99] truncate max-w-full">{e.equipName}</div>
                          <div className="text-sm font-semibold truncate max-w-full mt-0.5" style={{ color }}>
                            {st === "RUN" && job ? (job.itemName || job.orderNo)
                              : st === "IDLE" ? t("equipment.status.noJob", "작업 대기")
                              : stateLabel(e.status, e.status)}
                          </div>
                          {st === "RUN" && job && (
                            <div className="elm-num text-sm text-[#6b7d99] tabular-nums">
                              <span className="text-[#e6edf7]">{job.goodQty.toLocaleString()}</span> / {job.planQty.toLocaleString()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {rail.equips.length > MAX_NODES && (
                      <div className="flex items-center elm-num text-2xl text-[#6b7d99] px-2 shrink-0">+{rail.equips.length - MAX_NODES}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 요약 */}
      <div className="h-[72px] border-t border-[#16233a] bg-[#060910] flex items-center px-10 gap-10 flex-shrink-0">
        <span className="text-base tracking-[0.25em] text-[#6b7d99]">
          {t("equipment.status.monitoring", "모니터링")} <b className="elm-num text-3xl text-[#f1f6ff]">{equips.length}</b>{t("equipment.status.unit", "대")}
        </span>
        {[
          { label: t("equipment.status.working", "작업중"), n: workingCount, c: STATE_COLOR.RUN },
          { label: stateLabel("NORMAL", "정상"), n: counts.NORMAL, c: STATE_COLOR.IDLE },
          { label: stateLabel("MAINT", "점검"), n: counts.MAINT, c: STATE_COLOR.MAINT },
          { label: stateLabel("STOP", "정지"), n: counts.STOP, c: STATE_COLOR.STOP },
          { label: stateLabel("INTERLOCK", "인터록"), n: counts.INTERLOCK, c: STATE_COLOR.INTERLOCK },
        ].map((k) => (
          <span key={k.label} className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full self-center" style={{ background: k.c, boxShadow: k.n > 0 ? `0 0 8px ${k.c}` : "none", opacity: k.n > 0 ? 1 : 0.35 }} />
            <span className="text-base text-[#6b7d99]">{k.label}</span>
            <span className="elm-num text-3xl font-bold" style={{ color: k.n > 0 ? k.c : "#3d5170" }}>{k.n}</span>
          </span>
        ))}
        <span className="ml-auto font-mono text-xs text-[#3d5170]">
          {t("equipment.status.updatedAt", "갱신")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
        </span>
      </div>
    </div>
  );
}
