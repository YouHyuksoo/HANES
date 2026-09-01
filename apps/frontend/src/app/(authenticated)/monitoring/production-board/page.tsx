"use client";

/**
 * @file src/app/(authenticated)/monitoring/production-board/page.tsx
 * @description 생산현황 보드(현장 TV) — 전광판 스킨 3종 전환:
 *              A 관제탑(다크 네온) / B 출발 전광판(앰버 모노) / C 데이터 월(라이트 편집).
 *
 * 초보자 가이드:
 * 1. 데이터는 GET /monitoring/boards/production 하나로 조회, refetchSec 간격 자동 갱신
 * 2. 스킨은 우상단 플로팅 컨트롤(A/B/C)로 전환, TV별 localStorage 저장
 * 3. 스킨이 화면 전체(헤더/시계 포함)를 그린다 — 컨트롤은 반투명 오버레이(호버 시 선명)
 * 4. TV 모드: fixed 오버레이 + requestFullscreen
 */

import { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2, Pause, Play, RefreshCw, Settings } from "lucide-react";
import { useApiQuery } from "@/hooks/useApi";
import { MonitoringSettingsModal, useMonitoringConfig, useRotation } from "@/components/monitoring";
import ControlTowerSkin from "./components/skins/ControlTowerSkin";
import DepartureBoardSkin from "./components/skins/DepartureBoardSkin";
import DataWallSkin from "./components/skins/DataWallSkin";
import type { ProductionBoardData } from "./components/types";

type SkinId = "control" | "departure" | "datawall";

const SKIN_KEY = "monitoring:prod-board:skin";
/** 목록형 스킨의 페이지당 행 수 (control 은 목록 순환 없음 → 전체 1페이지) */
const SKIN_ROWS: Record<SkinId, number | null> = { control: null, departure: 6, datawall: 5 };
const SKINS: { id: SkinId; label: string; title: string }[] = [
  { id: "control", label: "A", title: "관제탑" },
  { id: "departure", label: "B", title: "출발 전광판" },
  { id: "datawall", label: "C", title: "데이터 월" },
];

export default function ProductionBoardPage() {
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:prod-board");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [skin, setSkinState] = useState<SkinId>("control");

  useEffect(() => {
    try {
      const s = localStorage.getItem(SKIN_KEY);
      if (s === "control" || s === "departure" || s === "datawall") setSkinState(s);
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
  const board = response?.data;
  const orders = board?.orders ?? [];

  const pageSize = SKIN_ROWS[skin] ?? Math.max(1, orders.length);
  const { pageItems, page, pageCount } = useRotation(orders, pageSize, config.rollingSec, paused);
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const skinProps = {
    kpi: board?.kpi,
    orders,
    pageItems,
    page,
    pageCount,
    pageSize,
    hourly: board?.hourly ?? [],
    rollingSec: config.rollingSec,
    updatedAt,
  };

  const ctlBtn = "w-8 h-8 flex items-center justify-center rounded hover:bg-white/20 transition-colors";

  return (
    <>
      <div className={tvMode ? "fixed inset-0 z-50" : "h-full"}>
        <div className="relative w-full h-full overflow-hidden">
          {skin === "control" && <ControlTowerSkin {...skinProps} />}
          {skin === "departure" && <DepartureBoardSkin {...skinProps} />}
          {skin === "datawall" && <DataWallSkin {...skinProps} />}

          {/* 플로팅 컨트롤 — 평소 반투명, 호버 시 선명 */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-lg bg-black/50 backdrop-blur px-1.5 py-1 text-white/90 opacity-30 hover:opacity-100 transition-opacity">
            {SKINS.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.title}
                onClick={() => setSkin(s.id)}
                className={`w-8 h-8 rounded text-sm font-bold transition-colors ${
                  skin === s.id ? "bg-white text-black" : "hover:bg-white/20"
                }`}
              >
                {s.label}
              </button>
            ))}
            <span className="w-px h-5 bg-white/25 mx-1" />
            <button type="button" className={ctlBtn} onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
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
