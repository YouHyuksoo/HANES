"use client";

/**
 * @file src/app/(authenticated)/monitoring/quality-board/page.tsx
 * @description 품질 보드(현장 TV) — 전광판 스킨 3종 전환:
 *              A 관제탑(다크 네온) / B 출발 전광판(앰버 모노) / C 데이터 월(다크 편집).
 *
 * 초보자 가이드:
 * 1. 데이터는 GET /monitoring/boards/quality 하나로 조회, refetchSec 간격 자동 갱신
 * 2. 스킨/TV모드/플로팅 컨트롤은 공통 BoardSkinFrame + useBoardSkin 이 담당 (5개 보드 동일)
 * 3. B(공정 행 목록)만 자동 순환을 쓴다 — 나머지는 고정 슬라이스
 */

import { useState } from "react";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardSkinFrame, MonitoringSettingsModal, useBoardSkin, useMonitoringConfig, useRotation, useTvMode,
  type BoardSkinOption,
} from "@/components/monitoring";
import ControlTowerSkin from "./components/skins/ControlTowerSkin";
import DepartureBoardSkin from "./components/skins/DepartureBoardSkin";
import DataWallSkin from "./components/skins/DataWallSkin";
import type { QualityBoardData } from "./components/types";

type SkinId = "control" | "departure" | "datawall";

const SKIN_IDS = ["control", "departure", "datawall"] as const;
const SKIN_ROWS: Record<SkinId, number | null> = { control: null, departure: 6, datawall: null };
const SKINS: BoardSkinOption<SkinId>[] = [
  { id: "control", label: "A", title: "관제탑" },
  { id: "departure", label: "B", title: "출발 전광판" },
  { id: "datawall", label: "C", title: "데이터 월" },
];

export default function QualityBoardPage() {
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:quality-board");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const { skin, setSkin } = useBoardSkin<SkinId>("monitoring:quality-board:skin", SKIN_IDS, "control");
  const { tvMode, toggleTvMode } = useTvMode();

  const { data: response, refetch, dataUpdatedAt } = useApiQuery<QualityBoardData>(
    ["monitoring", "board", "quality"],
    "/monitoring/boards/quality",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const board = response?.data;
  const byProcess = board?.byProcess ?? [];

  const pageSize = SKIN_ROWS[skin] ?? Math.max(1, byProcess.length);
  const { pageItems, page, pageCount } = useRotation(byProcess, pageSize, config.rollingSec, paused);
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const skinProps = {
    kpi: board?.kpi,
    byProcess,
    byProcessPageItems: pageItems,
    page,
    pageCount,
    topDefects: board?.topDefects ?? [],
    repair: board?.repair,
    dailyTrend: board?.dailyTrend ?? [],
    rollingSec: config.rollingSec,
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
        {skin === "control" && <ControlTowerSkin {...skinProps} />}
        {skin === "departure" && <DepartureBoardSkin {...skinProps} />}
        {skin === "datawall" && <DataWallSkin {...skinProps} />}
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
