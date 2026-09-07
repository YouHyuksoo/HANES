"use client";

/**
 * @file src/app/(authenticated)/monitoring/spc-board/page.tsx
 * @description SPC 관리도 모니터링 보드(현장 TV) — 조건(관리항목·설비)에 맞는 관리도를 하나씩 큰 화면으로 순환.
 *
 * 초보자 가이드:
 * 1. 조건 2가지: 관리항목(특성) 선택 + 설비 선택 — 둘 다 미선택 시 전체. 설정은 SpcMonitorSettingsModal.
 * 2. 설비를 고르면 해당 관리항목 중 그 설비가 실제로 측정된 것만, 관리도 상세를 설비 필터로 재조회한다
 *    (GET /quality/spc/hv/targets/:id?...&equipCode=). 설비 미선택이면 설비 통합 데이터.
 * 3. 표시는 기존 /quality/spc 상세 화면의 관리도 4종(X̄·R·공정능력 히스토그램·Cpk 추이)만 재사용 — 헤드라인
 *    KPI스트립·규칙위반목록·서브그룹표 같은 상세 데이터는 보여주지 않는다(TV 보드는 큰 그림만).
 * 4. 롤링/스킨/새로고침/설정/TV모드는 5개 보드와 동일한 공통 BoardSkinFrame + useRotation 을 그대로 쓴다.
 */
import { useState, useMemo } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { BoardSkinFrame, RotationIndicator, useRotation, useTvMode } from "@/components/monitoring";
import HvSpcCharts from "@/app/(authenticated)/quality/spc/components/HvSpcCharts";
import { flagBySubgroup } from "@/app/(authenticated)/quality/spc/components/spc-rules";
import type { SpcTargetData, SpcTargetsResponse } from "@/app/(authenticated)/quality/spc/types";
import SpcMonitorSettingsModal, { useSpcMonitorSettings, type SpcMonitorOption } from "./components/SpcMonitorSettingsModal";
import "@/app/(authenticated)/quality/spc/components/hv-spc-theme.css";
import styles from "./spc-monitor.module.css";

const DAYS = 30;

interface RotationItem {
  key: string;
  targetId: string;
  equipCode?: string;
  characteristic: string;
  processName: string;
}

export default function SpcMonitorBoardPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const { tvMode, toggleTvMode } = useTvMode();
  const { settings, setSettings, loaded } = useSpcMonitorSettings("monitoring:spc-board");

  const listQuery = useApiQuery<SpcTargetsResponse>(
    ["monitoring", "spc-board", "targets"],
    `/quality/spc/hv/targets?days=${DAYS}&k=0`,
    { refetchInterval: Math.max(5, settings.refetchSec) * 1000, enabled: loaded },
  );
  const allTargets = useMemo(() => listQuery.data?.data?.targets ?? [], [listQuery.data]);

  const targetOptions: SpcMonitorOption[] = useMemo(
    () => allTargets.map((tg) => ({ code: tg.id, label: tg.characteristic, sub: tg.processName })),
    [allTargets],
  );
  const equipOptions: SpcMonitorOption[] = useMemo(() => {
    const seen = new Set<string>();
    for (const tg of allTargets) for (const eq of tg.equipCodes) seen.add(eq);
    return Array.from(seen).sort().map((code) => ({ code, label: code }));
  }, [allTargets]);

  const selectedTargets = useMemo(
    () => (settings.targetCodes.length > 0 ? allTargets.filter((tg) => settings.targetCodes.includes(tg.id)) : allTargets),
    [allTargets, settings.targetCodes],
  );

  /** (관리항목 × 설비) 조합 목록 — 설비 미선택이면 관리항목당 1장(통합), 선택했으면 실측 설비마다 1장 */
  const items = useMemo<RotationItem[]>(() => {
    const out: RotationItem[] = [];
    for (const tg of selectedTargets) {
      const matchedEquip = settings.equipCodes.length > 0 ? tg.equipCodes.filter((e) => settings.equipCodes.includes(e)) : [];
      if (matchedEquip.length > 0) {
        for (const eq of matchedEquip) {
          out.push({ key: `${tg.id}::${eq}`, targetId: tg.id, equipCode: eq, characteristic: tg.characteristic, processName: tg.processName });
        }
      } else if (settings.equipCodes.length === 0) {
        out.push({ key: tg.id, targetId: tg.id, characteristic: tg.characteristic, processName: tg.processName });
      }
    }
    return out;
  }, [selectedTargets, settings.equipCodes]);

  const { pageItems, page, pageCount } = useRotation(items, 1, settings.rollingSec, paused);
  const current = pageItems[0] ?? null;

  const detailQuery = useApiQuery<SpcTargetData>(
    ["monitoring", "spc-board", "detail", current?.targetId ?? "", current?.equipCode ?? ""],
    current
      ? `/quality/spc/hv/targets/${encodeURIComponent(current.targetId)}?days=${DAYS}&k=0${current.equipCode ? `&equipCode=${encodeURIComponent(current.equipCode)}` : ""}`
      : null,
    { enabled: !!current, refetchInterval: Math.max(5, settings.refetchSec) * 1000, placeholderData: (prev) => prev },
  );
  const detail = detailQuery.data?.data ?? null;
  const flags = useMemo(() => flagBySubgroup(detail?.violations ?? []), [detail]);

  return (
    <>
      <BoardSkinFrame
        skins={[]}
        skin=""
        onSkinChange={() => {}}
        tvMode={tvMode}
        onToggleTv={toggleTvMode}
        onRefresh={() => { listQuery.refetch(); detailQuery.refetch(); }}
        refreshing={listQuery.isFetching}
        onSettings={() => setSettingsOpen(true)}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
      >
        <div className="hvspc-root h-full flex flex-col min-h-0 min-w-0 overflow-hidden p-4 gap-3" style={{ background: "var(--hv-bg)" }}>
          {!current ? (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--hv-ink-mute)" }}>
              설정에서 표시할 관리항목을 선택하세요.
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between flex-shrink-0 min-w-0 gap-3 pr-44">
                <div className="flex items-baseline gap-3">
                  <span className="hv-eyebrow">{current.processName}</span>
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--hv-ink)" }}>{current.characteristic}</h1>
                  {current.equipCode && <span className="hv-badge">{current.equipCode}</span>}
                </div>
                <RotationIndicator page={page} pageCount={pageCount} />
              </div>
              <div className={styles.charts}>
                {detail?.stats ? (
                  <HvSpcCharts
                    fillHeight
                    subgroups={detail.subgroups}
                    stats={detail.stats}
                    spec={detail.target.spec}
                    unit={detail.target.unit}
                    decimals={detail.target.decimals}
                    flags={flags}
                    capability={detail.capability}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--hv-ink-mute)" }}>
                    서브그룹이 2건 미만이라 관리도를 산출하지 않았습니다
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </BoardSkinFrame>

      <SpcMonitorSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        targetOptions={targetOptions}
        equipOptions={equipOptions}
        value={settings}
        onSave={setSettings}
      />
    </>
  );
}
