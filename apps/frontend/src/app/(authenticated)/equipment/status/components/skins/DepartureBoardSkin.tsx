"use client";

/**
 * @file .../equipment/status/components/skins/DepartureBoardSkin.tsx
 * @description 설비 스킨 C "출발 전광판" — 앰버 모노. 공항 출발 안내판처럼 설비를 행으로 나열하고
 *              상태 램프(정지 빨강 빠른 깜빡 / 인터록 회색 깜빡 / 점검 앰버 / 작업중 초록 / 대기 흐림).
 *              정렬: 문제 설비(정지→인터록→점검) 상단, 그다음 작업중(달성률↓), 마지막 대기.
 *              10행씩 rollingSec 간격 순환. 하단에 상태별 합계.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { useRotation } from "@/components/monitoring";
import { achieveRate, visualState, type EquipCard, type EquipSkinProps, type EquipVisualState, type RunningJob } from "../types";

const ROWS_PER_PAGE = 10;
const RANK: Record<EquipVisualState, number> = { STOP: 0, INTERLOCK: 1, MAINT: 2, RUN: 3, IDLE: 4 };

interface Row { equip: EquipCard; job?: RunningJob; st: EquipVisualState; rate: number }

function lampFor(st: EquipVisualState) {
  switch (st) {
    case "STOP": return { color: "#ef4444", blink: true, speed: 0.7 };
    case "INTERLOCK": return { color: "#9ca3af", blink: true, speed: 1.2 };
    case "MAINT": return { color: "#fbbf24", blink: true, speed: 1.6 };
    case "RUN": return { color: "#34d399", blink: false, speed: 0 };
    default: return { color: "#5b4a12", blink: false, speed: 0 };
  }
}

export default function DepartureBoardSkin({ equips, jobMap, counts, workingCount, rollingSec, paused, updatedAt }: EquipSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const rows = useMemo<Row[]>(() =>
    equips
      .map((e) => {
        const job = jobMap.get(e.equipCode);
        const st = visualState(e, job);
        return { equip: e, job, st, rate: achieveRate(job) };
      })
      .sort((a, b) => RANK[a.st] - RANK[b.st] || b.rate - a.rate || a.equip.equipCode.localeCompare(b.equip.equipCode)),
  [equips, jobMap]);

  const { pageItems, page, pageCount } = useRotation(rows, ROWS_PER_PAGE, rollingSec, paused);
  const stateLabel = (code: string, fallback: string) => t(`comCode.EQUIP_STATUS.${code}`, { defaultValue: fallback });
  const troubleCount = counts.STOP + counts.MAINT + counts.INTERLOCK;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0a07] text-[#fbbf24]"
      style={{ fontFamily: "'IBM Plex Mono', var(--font-sans), monospace" }}>
      <style>{`@keyframes edb-lamp { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-4 bg-[#131108] border-b-4 border-[#fbbf24] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="font-sans text-4xl font-black tracking-[0.35em]">{t("equipment.status.title")}</span>
          <span className="text-lg tracking-[0.3em] text-[#8a6d1c]">EQUIPMENT DEPARTURES</span>
        </div>
        <div className="flex items-baseline gap-5 mr-72">
          <span className="text-lg text-[#8a6d1c]">{clock?.date ?? ""}</span>
          <span className="text-5xl font-bold text-[#fde68a]" style={{ textShadow: "0 0 18px rgba(251,191,36,0.4)" }}>{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 컬럼 헤더 */}
      <div className="flex px-12 pt-4 pb-3 text-base tracking-[0.25em] text-[#8a6d1c] border-b border-[#2b2410] flex-shrink-0">
        <span className="font-sans w-[22%]">{t("equipment.status.equipCode")}</span>
        <span className="font-sans w-[14%]">{t("equipment.status.line")} · {t("master.equip.process", "공정")}</span>
        <span className="font-sans flex-1">{t("equipment.status.working", "작업중")}</span>
        <span className="font-sans w-[16%] text-right">{t("equipment.status.actual", "실적")} / {t("equipment.status.plan", "계획")}</span>
        <span className="font-sans w-[10%] text-right">{t("monitoring.board.kpi.achieveRate", "달성률")}</span>
        <span className="font-sans w-[12%] text-center">{t("monitoring.board.col.status", "상태")}</span>
      </div>

      {/* 설비 행 */}
      <div className="flex-1 flex flex-col px-12 min-h-0 justify-start">
        {pageItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center font-sans text-2xl text-[#8a6d1c]">{t("equipment.status.noEquip", "표시할 설비가 없습니다.")}</div>
        ) : (
          pageItems.map((r) => {
            const lamp = lampFor(r.st);
            const trouble = r.st === "STOP" || r.st === "INTERLOCK" || r.st === "MAINT";
            const dim = r.st === "IDLE";
            return (
              <div key={r.equip.equipCode}
                className={`flex items-center border-b border-[#1c1809] text-2xl min-h-0 ${r.st === "STOP" ? "bg-[#1a0b08]" : ""}`}
                style={{ flex: `0 0 calc(100% / ${ROWS_PER_PAGE})`, opacity: dim ? 0.55 : 1 }}>
                <span className="w-[22%] min-w-0 flex items-baseline gap-3 pr-3">
                  <span className="font-sans font-bold truncate text-[#fbbf24]">{r.equip.equipCode}</span>
                  <span className="text-sm text-[#8a6d1c] truncate shrink">{r.equip.equipName}</span>
                </span>
                <span className="w-[14%] min-w-0 text-lg text-[#b9922a] truncate pr-3">
                  {r.equip.lineCode ?? "—"} · {r.equip.processName || r.equip.processCode || "—"}
                </span>
                <span className="flex-1 min-w-0 truncate pr-3">
                  {r.job ? (
                    <>
                      <span className="font-sans font-bold text-[#fde68a]">{r.job.itemName || r.job.orderNo}</span>
                      {r.job.itemName && <span className="text-base text-[#8a6d1c] ml-3">{r.job.orderNo}</span>}
                    </>
                  ) : (
                    <span className="font-sans text-xl" style={{ color: trouble ? lamp.color : "#5b4a12" }}>
                      {trouble ? stateLabel(r.equip.status, r.equip.status) : t("equipment.status.noJob", "작업 대기")}
                    </span>
                  )}
                </span>
                <span className="w-[16%] text-right tabular-nums">
                  {r.job ? (
                    <>
                      <span className="font-bold text-[#fde68a]">{r.job.goodQty.toLocaleString()}</span>
                      <span className="text-[#8a6d1c]"> / {r.job.planQty.toLocaleString()}</span>
                      {r.job.defectQty > 0 && <span className="text-[#ef4444] text-base"> ·{r.job.defectQty}</span>}
                    </>
                  ) : <span className="text-[#5b4a12]">—</span>}
                </span>
                <span className={`w-[10%] text-right tabular-nums font-bold ${r.job ? (r.rate >= 100 ? "text-[#34d399]" : "text-[#fbbf24]") : "text-[#5b4a12]"}`}>
                  {r.job ? `${r.rate}%` : "—"}
                </span>
                <span className="w-[12%] flex items-center justify-center gap-3">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{
                    background: lamp.color,
                    boxShadow: lamp.blink || r.st === "RUN" ? `0 0 12px ${lamp.color}` : "none",
                    animation: lamp.blink ? `edb-lamp ${lamp.speed}s infinite` : "none",
                  }} />
                  <span className="font-sans text-base" style={{ color: lamp.color }}>
                    {r.st === "RUN" ? t("equipment.status.working", "작업중") : r.st === "IDLE" ? stateLabel("NORMAL", "정상") : stateLabel(r.equip.status, r.equip.status)}
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 합계 */}
      <div className="flex items-center bg-[#131108] border-t-4 border-[#fbbf24] px-12 py-4 gap-10 flex-shrink-0">
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="font-sans text-base tracking-[0.2em] text-[#8a6d1c] whitespace-nowrap">{t("equipment.status.monitoring", "모니터링")}</span>
          <span className="text-5xl font-bold tabular-nums text-[#fde68a]">{equips.length}</span>
        </div>
        {[
          { label: t("equipment.status.working", "작업중"), n: workingCount, c: "#34d399", zero: "#34d399" },
          { label: stateLabel("STOP", "정지"), n: counts.STOP, c: "#ef4444", zero: "#5b4a12" },
          { label: stateLabel("MAINT", "점검"), n: counts.MAINT, c: "#fbbf24", zero: "#5b4a12" },
          { label: stateLabel("INTERLOCK", "인터록"), n: counts.INTERLOCK, c: "#9ca3af", zero: "#5b4a12" },
        ].map((k) => (
          <div key={k.label} className="flex items-baseline gap-3 shrink-0">
            <span className="font-sans text-base tracking-[0.2em] text-[#8a6d1c] whitespace-nowrap">{k.label}</span>
            <span className="text-5xl font-bold tabular-nums" style={{ color: k.n > 0 ? k.c : k.zero, textShadow: k.n > 0 && k.c === "#ef4444" ? "0 0 16px rgba(239,68,68,0.4)" : "none" }}>{k.n}</span>
          </div>
        ))}
        <div className="ml-auto flex flex-col items-end gap-1 min-w-0">
          <span className="font-sans text-lg whitespace-nowrap" style={{ color: troubleCount > 0 ? "#ef4444" : "#34d399" }}>
            {troubleCount > 0 ? `▲ ${troubleCount}` : "● ALL CLEAR"}
          </span>
          <span className="text-xs text-[#6e5a18]">
            {t("equipment.status.updatedAt", "갱신")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
