"use client";

/**
 * @file src/app/(authenticated)/monitoring/production-board/page.tsx
 * @description 생산현황 보드(현장 TV) — 전광판 스타일: KPI 스트립(괘선 구획) + 자동 순환 테이블 + 시간대별 실적
 *
 * 초보자 가이드:
 * 1. 데이터는 GET /monitoring/boards/production 하나로 조회, refetchSec 간격 자동 갱신
 * 2. 테이블은 useRotation 으로 rollingSec 마다 자동 페이지 전환 (TV는 마우스 조작 없음)
 * 3. 카드박스 그리드 금지 — divide-x 괘선 스트립 + 대형 tabular 타이포로 표현
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, RefreshCw, Settings, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, BoardStat, BoardSectionTitle, MonitoringSettingsModal,
  useMonitoringConfig, useRotation, RotationIndicator,
} from "@/components/monitoring";
import OrderTable from "./components/OrderTable";
import HourlyTrendChart from "./components/HourlyTrendChart";
import type { ProductionBoardData } from "./components/types";

const ROWS_PER_PAGE = 10;

export default function ProductionBoardPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:prod-board");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  const { data: response, isLoading, refetch, dataUpdatedAt } = useApiQuery<ProductionBoardData>(
    ["monitoring", "board", "production"],
    "/monitoring/boards/production",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const board = response?.data;
  const orders = board?.orders ?? [];

  const { pageItems, page, pageCount } = useRotation(orders, ROWS_PER_PAGE, config.rollingSec, paused);

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";
  const kpi = board?.kpi;

  return (
    <>
      <BoardChrome
        title={t("monitoring.board.production.title")}
        icon={<Activity className="w-5 h-5 text-primary" />}
        optionBar={
          <>
            <BoardClock className="mr-3" />
            <Button variant="secondary" size="sm" onClick={() => setPaused((p) => !p)}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </>
        }
        statusLeft={
          <span>
            {t("monitoring.board.updatedAt")} {updatedAt}
          </span>
        }
        statusRight={<RotationIndicator page={page} pageCount={pageCount} />}
      >
        {/* KPI 스트립 — 괘선(divide-x)으로만 구획 */}
        <div className="flex divide-x divide-border py-4 border-b border-border flex-shrink-0">
          <BoardStat label={t("monitoring.board.kpi.planQty")} value={(kpi?.planQty ?? 0).toLocaleString()} />
          <BoardStat label={t("monitoring.board.kpi.goodQty")} value={(kpi?.goodQty ?? 0).toLocaleString()} valueClassName="text-primary" />
          <BoardStat
            label={t("monitoring.board.kpi.achieveRate")}
            value={`${kpi?.achieveRate ?? 0}%`}
            valueClassName={(kpi?.achieveRate ?? 0) >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-text"}
          />
          <BoardStat
            label={t("monitoring.board.kpi.defectQty")}
            value={(kpi?.defectQty ?? 0).toLocaleString()}
            valueClassName={(kpi?.defectQty ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-text"}
          />
          <BoardStat
            label={t("monitoring.board.kpi.running")}
            value={kpi?.runningCount ?? 0}
            sub={`${t("monitoring.board.kpi.total")} ${kpi?.totalCount ?? 0}`}
            valueClassName="text-primary"
          />
        </div>

        {/* 작업지시 테이블 (자동 순환) — full-bleed, 보드의 주인공 */}
        <div className="flex-1 min-h-0 overflow-hidden pt-2">
          <OrderTable orders={pageItems} loading={isLoading && orders.length === 0} />
        </div>

        {/* 시간대별 실적 */}
        <div className="h-44 flex-shrink-0 flex flex-col pt-2 pb-1">
          <BoardSectionTitle className="mb-1">{t("monitoring.board.hourlyTitle")}</BoardSectionTitle>
          <div className="flex-1 min-h-0">
            <HourlyTrendChart hourly={board?.hourly ?? []} />
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
