"use client";

/**
 * @file src/app/(authenticated)/equipment/status/page.tsx
 * @description 설비 가동현황 모니터링 — 표시 방식 4종 전환:
 *              G 카드 그리드(기존 MonitoringFrame) / A 노선도 / B 트리맵 / C 출발 전광판.
 *
 * 초보자 가이드:
 * 1. 설정 모달에서 모니터링 설비·재조회 주기·롤링 주기(·그리드 열/행은 G 전용)를 지정(localStorage 저장)
 * 2. 선택 설비만 refetchInterval 로 자동 조회(미선택 시 전체), RUNNING 작업지시를 설비코드로 조인
 * 3. 스킨은 우상단 G/A/B/C 버튼으로 전환, TV별 localStorage 저장. A/C는 rollingSec 간격 페이지 순환
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, RefreshCw, Settings, Pause, Play, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { MonitoringFrame, MonitoringSettingsModal, useMonitoringConfig } from "@/components/monitoring";
import EquipStatusCard, { type EquipCard, type RunningJob } from "./components/EquipStatusCard";
import LineMapSkin from "./components/skins/LineMapSkin";
import TreemapSkin from "./components/skins/TreemapSkin";
import DepartureBoardSkin from "./components/skins/DepartureBoardSkin";
import type { EquipStatusCounts } from "./components/types";

/** /production/progress?status=RUNNING 응답(JobOrder + part 조인) */
interface ProgressJob {
  orderNo: string;
  equipCode: string | null;
  planQty: number | null;
  goodQty: number | null;
  defectQty: number | null;
  part?: { itemName?: string | null } | null;
}

type SkinId = "grid" | "linemap" | "treemap" | "departure";

const SKIN_KEY = "monitoring:equip-status:skin";
const SKINS: { id: SkinId; label: string; title: string }[] = [
  { id: "grid", label: "G", title: "카드 그리드" },
  { id: "linemap", label: "A", title: "노선도" },
  { id: "treemap", label: "B", title: "트리맵" },
  { id: "departure", label: "C", title: "출발 전광판" },
];

export default function EquipStatusPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:equip-status");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [skin, setSkinState] = useState<SkinId>("grid");

  useEffect(() => {
    try {
      const s = localStorage.getItem(SKIN_KEY);
      if (s === "grid" || s === "linemap" || s === "treemap" || s === "departure") setSkinState(s);
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

  const { data: response, isLoading, refetch, dataUpdatedAt } = useApiQuery<EquipCard[]>(
    ["equipment", "list"],
    "/equipment/equips?limit=500",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const equipments: EquipCard[] = response?.data ?? [];

  // 현재 작업(RUNNING) 작업지시 — 설비별 모델/계획/실적 매핑용
  const { data: progressRes } = useApiQuery<ProgressJob[]>(
    ["production", "running"],
    "/production/progress?status=RUNNING&limit=500",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const jobMap = useMemo(() => {
    const m = new Map<string, RunningJob>();
    for (const j of progressRes?.data ?? []) {
      if (!j.equipCode) continue;
      m.set(j.equipCode, {
        orderNo: j.orderNo,
        itemName: j.part?.itemName ?? null,
        planQty: Number(j.planQty ?? 0),
        goodQty: Number(j.goodQty ?? 0),
        defectQty: Number(j.defectQty ?? 0),
      });
    }
    return m;
  }, [progressRes]);

  const filtered = useMemo(() => {
    if (config.selectedCodes.length === 0) return equipments;
    const set = new Set(config.selectedCodes);
    return equipments.filter((e) => set.has(e.equipCode));
  }, [equipments, config.selectedCodes]);

  const workingCount = useMemo(
    () => filtered.filter((e) => jobMap.has(e.equipCode)).length,
    [filtered, jobMap],
  );

  const counts = useMemo<EquipStatusCounts>(() => {
    const c: EquipStatusCounts = { NORMAL: 0, MAINT: 0, STOP: 0, INTERLOCK: 0 };
    filtered.forEach((e) => {
      if (e.status in c) c[e.status as keyof EquipStatusCounts] += 1;
    });
    return c;
  }, [filtered]);

  const options = useMemo(
    () => equipments.map((e) => ({ code: e.equipCode, label: e.equipName, sub: e.lineCode ?? undefined })),
    [equipments],
  );

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const skinProps = {
    equips: filtered,
    jobMap,
    counts,
    workingCount,
    rollingSec: config.rollingSec,
    paused,
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
      {skin === "grid" ? (
        <MonitoringFrame<EquipCard>
          title={t("equipment.status.title")}
          icon={<Monitor className="w-6 h-6 text-primary" />}
          columns={config.columns}
          rows={config.rows}
          rollingIntervalMs={config.rollingSec * 1000}
          paused={paused}
          loading={isLoading && equipments.length === 0}
          items={filtered}
          itemKey={(e) => e.equipCode}
          renderItem={(e) => <EquipStatusCard equip={e} job={jobMap.get(e.equipCode) ?? null} />}
          emptyMessage={t("equipment.status.noEquip", "표시할 설비가 없습니다.")}
          optionBar={
            <>
              <span className="flex items-center gap-0.5 rounded-md border border-border px-1 py-0.5 mr-2">
                {skinButtons("bg-primary text-white", "text-text-muted hover:bg-surface-hover")}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setPaused((p) => !p)}
                title={paused ? t("common.play", "재생") : t("common.pause", "일시정지")}>
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => refetch()} title={t("common.refresh")}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-1" />
                {t("common.settings", "설정")}
              </Button>
            </>
          }
          statusLeft={
            <>
              <span>{t("equipment.status.monitoring", "모니터링")} <strong className="text-text tabular-nums">{filtered.length}</strong>{t("equipment.status.unit", "대")}</span>
              <span className="text-blue-600 dark:text-blue-400">{t("equipment.status.working", "작업중")} {workingCount}</span>
              <span className="text-sky-600 dark:text-sky-400">{t("comCode.EQUIP_STATUS.NORMAL", { defaultValue: "정상" })} {counts.NORMAL}</span>
              <span className="text-amber-600 dark:text-amber-400">{t("comCode.EQUIP_STATUS.MAINT", { defaultValue: "점검" })} {counts.MAINT}</span>
              <span className="text-rose-600 dark:text-rose-400">{t("comCode.EQUIP_STATUS.STOP", { defaultValue: "정지" })} {counts.STOP}</span>
              {counts.INTERLOCK > 0 && (
                <span className="text-gray-500 dark:text-gray-400">{t("comCode.EQUIP_STATUS.INTERLOCK", { defaultValue: "인터록" })} {counts.INTERLOCK}</span>
              )}
            </>
          }
          statusRight={
            <span className="flex items-center gap-2">
              {paused && <span className="text-amber-500 font-medium">{t("common.pause", "일시정지")}</span>}
              <span>{t("equipment.status.updatedAt", "갱신")} {updatedAt}</span>
            </span>
          }
        />
      ) : (
        <div className={tvMode ? "fixed inset-0 z-50" : "h-full"}>
          <div className="relative w-full h-full overflow-hidden">
            {skin === "linemap" && <LineMapSkin {...skinProps} />}
            {skin === "treemap" && <TreemapSkin {...skinProps} />}
            {skin === "departure" && <DepartureBoardSkin {...skinProps} />}

            {/* 플로팅 컨트롤 — 평소 반투명, 호버 시 선명 */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-lg bg-black/50 backdrop-blur px-1.5 py-1 text-white/90 opacity-30 hover:opacity-100 transition-opacity">
              {skinButtons("bg-white text-black", "hover:bg-white/20")}
              <span className="w-px h-5 bg-white/25 mx-1" />
              <button type="button" className={ctlBtn} onClick={() => setPaused((p) => !p)} title={paused ? t("common.play", "재생") : t("common.pause", "일시정지")}>
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button type="button" className={ctlBtn} onClick={() => refetch()}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
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
        targetLabel={t("master.equip.title", "설비")}
        options={options}
        value={config}
        onSave={setConfig}
        showGrid={skin === "grid"}
      />
    </>
  );
}
