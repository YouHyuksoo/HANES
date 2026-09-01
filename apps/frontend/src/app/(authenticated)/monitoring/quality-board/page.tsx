"use client";

/**
 * @file src/app/(authenticated)/monitoring/quality-board/page.tsx
 * @description 품질 모니터링 보드 — 오늘 불량률 KPI + 공정별 불량 + 불량유형 TOP + 수리 현황 + 7일 추이
 *
 * 초보자 가이드:
 * 1. 데이터는 GET /monitoring/boards/quality 하나로 조회, refetchSec 간격 자동 갱신
 * 2. TV 모드는 BoardChrome 공통(전체화면 토글)
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, BoardStat, MonitoringSettingsModal, useMonitoringConfig,
} from "@/components/monitoring";
import { ProcessDefectChart, DailyTrendChart } from "./components/QualityCharts";
import type { QualityBoardData } from "./components/types";

export default function QualityBoardPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:quality-board");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: response, isLoading, refetch, dataUpdatedAt } = useApiQuery<QualityBoardData>(
    ["monitoring", "board", "quality"],
    "/monitoring/boards/quality",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const board = response?.data;
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <>
      <BoardChrome
        title={t("monitoring.board.quality.title")}
        icon={<ShieldCheck className="w-6 h-6 text-primary" />}
        optionBar={
          <>
            <BoardClock className="mr-2" />
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </>
        }
        statusLeft={<span>{t("monitoring.board.updatedAt")}: {updatedAt}</span>}
      >
        {/* KPI 행 */}
        <div className="flex gap-3 flex-shrink-0">
          <BoardStat label={t("monitoring.board.quality.totalQty")} value={(board?.kpi.totalQty ?? 0).toLocaleString()} />
          <BoardStat
            label={t("monitoring.board.kpi.defectQty")}
            value={(board?.kpi.defectQty ?? 0).toLocaleString()}
            valueClassName={(board?.kpi.defectQty ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-text"}
          />
          <BoardStat
            label={t("monitoring.board.quality.defectRate")}
            value={`${board?.kpi.defectRate ?? 0}%`}
            valueClassName={(board?.kpi.defectRate ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
          />
          <BoardStat label={t("monitoring.board.quality.repairReceived")} value={board?.repair.received ?? 0} />
          <BoardStat label={t("monitoring.board.quality.repairInRepair")} value={board?.repair.inRepair ?? 0} />
          <BoardStat label={t("monitoring.board.quality.repairCompletedToday")} value={board?.repair.completedToday ?? 0} valueClassName="text-primary" />
        </div>

        {/* 중단: 공정별 불량 차트 + 불량유형 TOP */}
        <div className="flex-1 min-h-0 flex gap-3">
          <div className="flex-[3] min-w-0 rounded-xl border border-border bg-surface px-3 py-2 flex flex-col">
            <div className="text-xs font-semibold text-text-muted mb-1">{t("monitoring.board.quality.byProcessTitle")}</div>
            <div className="flex-1 min-h-0">
              {isLoading && !board ? null : <ProcessDefectChart byProcess={board?.byProcess ?? []} />}
            </div>
          </div>
          <div className="flex-[2] min-w-0 rounded-xl border border-border bg-surface px-3 py-2 flex flex-col overflow-hidden">
            <div className="text-xs font-semibold text-text-muted mb-1">{t("monitoring.board.quality.topDefectsTitle")}</div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {(board?.topDefects ?? []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-text-muted">
                  {t("monitoring.board.noData")}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {(board?.topDefects ?? []).map((d, i) => (
                      <tr key={d.defectCode}>
                        <td className="px-2 py-1.5 w-8 text-text-muted tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <span className="font-semibold text-text">{d.defectName}</span>
                          <span className="ml-2 font-mono text-[11px] text-text-muted">{d.defectCode}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                          {d.qty.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* 하단: 최근 7일 불량률 추이 */}
        <div className="h-44 flex-shrink-0 rounded-xl border border-border bg-surface px-3 py-2 flex flex-col">
          <div className="text-xs font-semibold text-text-muted mb-1">{t("monitoring.board.quality.dailyTrendTitle")}</div>
          <div className="flex-1 min-h-0">
            <DailyTrendChart dailyTrend={board?.dailyTrend ?? []} />
          </div>
        </div>
      </BoardChrome>

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
