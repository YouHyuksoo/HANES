"use client";

/**
 * @file src/app/(authenticated)/monitoring/quality-board/page.tsx
 * @description 품질 모니터링 보드 — 전광판 스타일: KPI 스트립 + 공정별 불량 차트 +
 *              불량유형 TOP 랭킹(막대) + 7일 추이. 카드박스 대신 괘선 구획.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, BoardStat, BoardSectionTitle, MonitoringSettingsModal, useMonitoringConfig,
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
  const topDefects = board?.topDefects ?? [];
  const maxDefectQty = topDefects.length > 0 ? Math.max(...topDefects.map((d) => d.qty)) : 0;

  return (
    <>
      <BoardChrome
        title={t("monitoring.board.quality.title")}
        icon={<ShieldCheck className="w-5 h-5 text-primary" />}
        optionBar={
          <>
            <BoardClock className="mr-3" />
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </>
        }
        statusLeft={<span>{t("monitoring.board.updatedAt")} {updatedAt}</span>}
      >
        {/* KPI 스트립 */}
        <div className="flex divide-x divide-border py-4 border-b border-border flex-shrink-0">
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
          <BoardStat label={t("monitoring.board.quality.repairInRepair")} value={board?.repair.inRepair ?? 0} valueClassName="text-amber-600 dark:text-amber-400" />
          <BoardStat label={t("monitoring.board.quality.repairCompletedToday")} value={board?.repair.completedToday ?? 0} valueClassName="text-primary" />
        </div>

        {/* 중단: 공정별 불량 + 불량유형 TOP — 세로 괘선으로 2분할 */}
        <div className="flex-1 min-h-0 flex divide-x divide-border pt-3">
          <div className="flex-[3] min-w-0 pr-5 flex flex-col">
            <BoardSectionTitle className="mb-1">{t("monitoring.board.quality.byProcessTitle")}</BoardSectionTitle>
            <div className="flex-1 min-h-0">
              {isLoading && !board ? null : <ProcessDefectChart byProcess={board?.byProcess ?? []} />}
            </div>
          </div>

          <div className="flex-[2] min-w-0 pl-5 flex flex-col overflow-hidden">
            <BoardSectionTitle className="mb-2">{t("monitoring.board.quality.topDefectsTitle")}</BoardSectionTitle>
            <div className="flex-1 min-h-0 overflow-hidden">
              {topDefects.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-text-muted">
                  {t("monitoring.board.noData")}
                </div>
              ) : (
                <ol>
                  {topDefects.map((d, i) => (
                    <li key={d.defectCode} className="py-1.5 border-b border-border/60">
                      <div className="flex items-baseline gap-3">
                        <span className="w-7 text-right text-lg font-extrabold tabular-nums text-text-muted/70">{i + 1}</span>
                        <span className="flex-1 min-w-0 truncate text-base font-medium text-text">{d.defectName}</span>
                        <span className="font-mono text-[11px] text-text-muted">{d.defectCode}</span>
                        <span className="w-16 text-right text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                          {d.qty.toLocaleString()}
                        </span>
                      </div>
                      <div className="ml-10 mt-1 h-1 bg-border overflow-hidden">
                        <div
                          className="h-full bg-red-500/80"
                          style={{ width: `${maxDefectQty > 0 ? Math.max(2, (d.qty / maxDefectQty) * 100) : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* 하단: 최근 7일 불량률 추이 */}
        <div className="h-40 flex-shrink-0 flex flex-col pt-2 pb-1 border-t border-border mt-3">
          <BoardSectionTitle className="mb-1">{t("monitoring.board.quality.dailyTrendTitle")}</BoardSectionTitle>
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
