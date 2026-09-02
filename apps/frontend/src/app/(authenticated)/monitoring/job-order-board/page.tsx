"use client";

/**
 * @file src/app/(authenticated)/monitoring/job-order-board/page.tsx
 * @description 작업지시 보드(읽기전용, 현장 TV) — 오늘 지시일 작업지시를 스킨 3종으로 전환:
 *              A 스윔레인(다크 네온, 공정 레인) / B 링 월(앰버 모노, 달성률 도넛) / C 퍼널(다크 편집, 상태 4단계).
 *
 * 초보자 가이드:
 * 1. 데이터는 생산현황 보드 API(GET /monitoring/boards/production)의 orders 를 재사용
 * 2. 스킨/TV모드/플로팅 컨트롤은 공통 BoardSkinFrame + useBoardSkin 이 담당 (5개 보드 동일)
 * 3. 드래그 상태변경 없음 — 조작은 기존 작업지시 화면에서 한다
 */

import { useState, useMemo } from "react";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardSkinFrame, MonitoringSettingsModal, useBoardSkin, useMonitoringConfig, useTvMode,
  type BoardSkinOption,
} from "@/components/monitoring";
import SwimlaneSkin from "./components/skins/SwimlaneSkin";
import RingWallSkin from "./components/skins/RingWallSkin";
import FunnelSkin from "./components/skins/FunnelSkin";
import { JOB_STATUSES, type JobStatus, type ProductionBoardOrder } from "./components/types";
import type { ProductionBoardData } from "../production-board/components/types";

type SkinId = "swimlane" | "ringwall" | "funnel";

const SKIN_IDS = ["swimlane", "ringwall", "funnel"] as const;
const SKINS: BoardSkinOption<SkinId>[] = [
  { id: "swimlane", label: "A", title: "스윔레인" },
  { id: "ringwall", label: "B", title: "링 월" },
  { id: "funnel", label: "C", title: "퍼널" },
];

export default function JobOrderBoardPage() {
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:job-order-board");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const { skin, setSkin } = useBoardSkin<SkinId>("monitoring:job-order-board:skin", SKIN_IDS, "swimlane");
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
        {skin === "swimlane" && <SwimlaneSkin {...skinProps} />}
        {skin === "ringwall" && <RingWallSkin {...skinProps} />}
        {skin === "funnel" && <FunnelSkin {...skinProps} />}
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
