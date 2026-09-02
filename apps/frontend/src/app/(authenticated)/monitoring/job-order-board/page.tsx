"use client";

/**
 * @file src/app/(authenticated)/monitoring/job-order-board/page.tsx
 * @description 작업지시 진행 보드(읽기전용) — 오늘 지시일 작업지시를 표시 방식 4종으로 전환:
 *              K 칸반(기존 4컬럼) / A 스윔레인(공정별 레인) / B 링 월(달성률 도넛) / C 퍼널(단계 깔때기).
 *
 * 초보자 가이드:
 * 1. 데이터는 생산현황 보드 API(GET /monitoring/boards/production)의 orders 를 재사용
 * 2. 스킨은 우상단 K/A/B/C 버튼으로 전환, TV별 localStorage 저장
 * 3. 드래그 상태변경 없음 — 조작은 기존 작업지시 화면에서 한다
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { KanbanSquare, RefreshCw, Settings, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, MonitoringSettingsModal, useMonitoringConfig,
} from "@/components/monitoring";
import KanbanColumn from "./components/KanbanColumn";
import SwimlaneSkin from "./components/skins/SwimlaneSkin";
import RingWallSkin from "./components/skins/RingWallSkin";
import FunnelSkin from "./components/skins/FunnelSkin";
import { JOB_STATUSES, type JobStatus, type ProductionBoardOrder } from "./components/types";
import type { ProductionBoardData } from "../production-board/components/types";

type SkinId = "kanban" | "swimlane" | "ringwall" | "funnel";

const SKIN_KEY = "monitoring:job-order-board:skin";
const SKINS: { id: SkinId; label: string; title: string }[] = [
  { id: "kanban", label: "K", title: "칸반" },
  { id: "swimlane", label: "A", title: "스윔레인" },
  { id: "ringwall", label: "B", title: "링 월" },
  { id: "funnel", label: "C", title: "퍼널" },
];

export default function JobOrderBoardPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:job-order-board");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [skin, setSkinState] = useState<SkinId>("kanban");

  useEffect(() => {
    try {
      const s = localStorage.getItem(SKIN_KEY);
      if (s === "kanban" || s === "swimlane" || s === "ringwall" || s === "funnel") setSkinState(s);
    } catch {
      // localStorage 접근 불가 환경은 기본 스킨 유지
    }
  }, []);

  const setSkin = (s: SkinId) => {
    setSkinState(s);
    try {
      localStorage.setItem(SKIN_KEY, s);
    } catch {
      // 저장 실패 무시
    }
  };

  const toggleTvMode = useCallback(() => {
    setTvMode((prev) => {
      const next = !prev;
      try {
        if (next) void document.documentElement.requestFullscreen?.();
        else if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        // 전체화면 미지원 환경에서는 오버레이만 적용
      }
      return next;
    });
  }, []);

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
    updatedAt,
  };

  const skinButtons = (active: string, inactive: string) =>
    SKINS.map((s) => (
      <button
        key={s.id}
        type="button"
        title={s.title}
        onClick={() => setSkin(s.id)}
        className={`w-8 h-8 rounded text-sm font-bold transition-colors ${skin === s.id ? active : inactive}`}
      >
        {s.label}
      </button>
    ));

  const ctlBtn = "w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 transition-colors";

  return (
    <>
      {skin === "kanban" ? (
        <BoardChrome
          title={t("monitoring.board.jobOrder.title")}
          icon={<KanbanSquare className="w-6 h-6 text-primary" />}
          optionBar={
            <>
              <BoardClock className="mr-2" />
              <span className="flex items-center gap-0.5 rounded-md border border-border px-1 py-0.5 mr-2">
                {skinButtons("bg-primary text-white", "text-text-muted hover:bg-surface-hover")}
              </span>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </>
          }
          statusLeft={<span>{t("monitoring.board.updatedAt")}: {updatedAt}</span>}
          statusRight={<span>{t("monitoring.board.kpi.total")} {orders.length}</span>}
        >
          <div className="flex-1 min-h-0 flex divide-x divide-border pt-3">
            {JOB_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                orders={byStatus[status]}
                rollingSec={config.rollingSec}
              />
            ))}
          </div>
        </BoardChrome>
      ) : (
        <div className={tvMode ? "fixed inset-0 z-50" : "h-full"}>
          <div className="relative w-full h-full overflow-hidden">
            {skin === "swimlane" && <SwimlaneSkin {...skinProps} />}
            {skin === "ringwall" && <RingWallSkin {...skinProps} />}
            {skin === "funnel" && <FunnelSkin {...skinProps} />}

            {/* 플로팅 컨트롤 — 평소 반투명, 호버 시 선명 */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-lg bg-black/50 backdrop-blur px-1.5 py-1 text-white/90 opacity-30 hover:opacity-100 transition-opacity">
              {skinButtons("bg-white text-black", "hover:bg-white/20")}
              <span className="w-px h-5 bg-white/25 mx-1" />
              <button type="button" className={ctlBtn} onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </button>
              <button type="button" className={ctlBtn} onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4" />
              </button>
              <button type="button" className={ctlBtn} onClick={toggleTvMode}>
                {tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

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
