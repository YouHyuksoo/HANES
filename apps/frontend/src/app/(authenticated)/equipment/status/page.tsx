"use client";

/**
 * @file src/app/(authenticated)/equipment/status/page.tsx
 * @description 설비 가동현황 모니터링 — 스크롤 없이 한 화면, 설정한 설비를 인터벌로 자동 조회·롤링
 *
 * 초보자 가이드:
 * 1. 설정 모달에서 모니터링 설비·재조회 주기·롤링 주기·그리드(열·행)를 지정(localStorage 저장)
 * 2. 선택 설비만 refetchInterval 로 자동 조회(미선택 시 전체)
 * 3. MonitoringFrame 이 스크롤 없이 한 화면에 표시하고 페이지를 자동 롤링
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, RefreshCw, Settings, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { MonitoringFrame, MonitoringSettingsModal, useMonitoringConfig } from "@/components/monitoring";
import EquipStatusCard, { type EquipCard, type RunningJob } from "./components/EquipStatusCard";

/** /production/progress?status=RUNNING 응답(JobOrder + part 조인) */
interface ProgressJob {
  orderNo: string;
  equipCode: string | null;
  planQty: number | null;
  goodQty: number | null;
  defectQty: number | null;
  part?: { itemName?: string | null } | null;
}

export default function EquipStatusPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:equip-status");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);

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

  const counts = useMemo(() => {
    const c: Record<string, number> = { NORMAL: 0, MAINT: 0, STOP: 0, INTERLOCK: 0 };
    filtered.forEach((e) => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [filtered]);

  const options = useMemo(
    () => equipments.map((e) => ({ code: e.equipCode, label: e.equipName, sub: e.lineCode ?? undefined })),
    [equipments],
  );

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <>
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

      <MonitoringSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        targetLabel={t("master.equip.title", "설비")}
        options={options}
        value={config}
        onSave={setConfig}
      />
    </>
  );
}
