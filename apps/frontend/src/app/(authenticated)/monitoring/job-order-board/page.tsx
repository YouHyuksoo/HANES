"use client";

/**
 * @file src/app/(authenticated)/monitoring/job-order-board/page.tsx
 * @description 작업지시 진행 칸반 보드(읽기전용) — 오늘 지시일 작업지시를 상태별 4컬럼으로 표시
 *
 * 초보자 가이드:
 * 1. 데이터는 생산현황 보드 API(GET /monitoring/boards/production)의 orders 를 재사용
 * 2. 컬럼(WAITING/RUNNING/HOLD/DONE)별로 카드가 넘치면 useRotation 으로 자동 순환
 * 3. 드래그 상태변경 없음 — 조작은 기존 작업지시 화면에서 한다
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KanbanSquare, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, MonitoringSettingsModal, useMonitoringConfig,
} from "@/components/monitoring";
import KanbanColumn from "./components/KanbanColumn";
import type { ProductionBoardData } from "../production-board/components/types";

const STATUS_COLUMNS = ["WAITING", "RUNNING", "HOLD", "DONE"] as const;

export default function JobOrderBoardPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:job-order-board");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: response, refetch, dataUpdatedAt } = useApiQuery<ProductionBoardData>(
    ["monitoring", "board", "production"],
    "/monitoring/boards/production",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const orders = response?.data?.orders ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, typeof orders>();
    STATUS_COLUMNS.forEach((s) => map.set(s, []));
    for (const o of orders) {
      const bucket = map.get(o.status);
      if (bucket) bucket.push(o);
    }
    return map;
  }, [orders]);

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <>
      <BoardChrome
        title={t("monitoring.board.jobOrder.title")}
        icon={<KanbanSquare className="w-6 h-6 text-primary" />}
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
        statusRight={<span>{t("monitoring.board.kpi.total")} {orders.length}</span>}
      >
        <div className="flex-1 min-h-0 flex divide-x divide-border pt-3">
          {STATUS_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              orders={grouped.get(status) ?? []}
              rollingSec={config.rollingSec}
            />
          ))}
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
