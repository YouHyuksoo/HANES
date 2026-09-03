"use client";

/**
 * @file src/app/(authenticated)/monitoring/job-order-board/page.tsx
 * @description 작업지시 보드(읽기전용, 현장 TV) — 오늘 지시일 작업지시를 스킨 3종으로 전환:
 *              A 레저(공정 밴드 + 지시 장부) / B 스코어보드(지시당 계획·실적·불량 거대 숫자) / C 게이지 월(공정별 적층 게이지).
 *              주축은 공정 → 작업지시번호, 지표는 계획/실적/불량과 그 파생(달성률·불량률·잔량)만 쓴다(components/metrics.ts).
 *
 * 초보자 가이드:
 * 1. 데이터는 생산현황 보드 API(GET /monitoring/boards/production)의 orders 를 재사용
 * 2. 스킨/TV모드/플로팅 컨트롤은 공통 BoardSkinFrame + useBoardSkin (5개 보드 동일)
 * 3. 드래그 상태변경 없음 — 조작은 기존 작업지시 화면에서 한다
 */

import { useState, useMemo } from "react";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardSkinFrame, MonitoringSettingsModal, useBoardSkin, useMonitoringConfig, useTvMode,
  type BoardSkinOption,
} from "@/components/monitoring";
import LedgerSkin from "./components/skins/LedgerSkin";
import ScoreboardSkin from "./components/skins/ScoreboardSkin";
import GaugeWallSkin from "./components/skins/GaugeWallSkin";
import { JOB_STATUSES, type JobStatus, type ProductionBoardOrder } from "./components/types";
import type { ProductionBoardData } from "../production-board/components/types";

type SkinId = "ledger" | "scoreboard" | "gauge";

const SKIN_IDS = ["ledger", "scoreboard", "gauge"] as const;
const SKINS: BoardSkinOption<SkinId>[] = [
  { id: "ledger", label: "A", title: "레저" },
  { id: "scoreboard", label: "B", title: "스코어보드" },
  { id: "gauge", label: "C", title: "게이지 월" },
];

export default function JobOrderBoardPage() {
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:job-order-board");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const { skin, setSkin } = useBoardSkin<SkinId>("monitoring:job-order-board:skin", SKIN_IDS, "ledger");
  const { tvMode, toggleTvMode } = useTvMode();

  const { data: response, refetch, dataUpdatedAt } = useApiQuery<ProductionBoardData>(
    ["monitoring", "board", "production"],
    "/monitoring/boards/production",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const orders = useMemo(() => response?.data?.orders ?? [], [response]);

  const byStatus = useMemo(() => {
    const map = { WAITING: [], RUNNING: [], HOLD: [], DONE: [] } as Record<JobStatus, ProductionBoardOrder[]>;
    for (const o of orders) {
      if ((JOB_STATUSES as readonly string[]).includes(o.status)) map[o.status as JobStatus].push(o);
    }
    return map;
  }, [orders]);

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const skinProps = {
    kpi: response?.data?.kpi,
    orders,
    byStatus,
    rollingSec: config.rollingSec,
    paused,
    updatedAt,
  };

  return (
    <>
      <BoardSkinFrame
        skins={SKINS}
        skin={skin}
        onSkinChange={setSkin}
        tvMode={tvMode}
        onToggleTv={toggleTvMode}
        onRefresh={() => refetch()}
        onSettings={() => setSettingsOpen(true)}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
      >
        {skin === "ledger" && <LedgerSkin {...skinProps} />}
        {skin === "scoreboard" && <ScoreboardSkin {...skinProps} />}
        {skin === "gauge" && <GaugeWallSkin {...skinProps} />}
      </BoardSkinFrame>

      <MonitoringSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        targetLabel=""
        options={[]}
        value={config}
        onSave={setConfig}
        showGrid={false}
        showTargets={false}
      />
    </>
  );
}
