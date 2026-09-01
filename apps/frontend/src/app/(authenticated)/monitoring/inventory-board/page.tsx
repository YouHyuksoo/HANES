"use client";

/**
 * @file src/app/(authenticated)/monitoring/inventory-board/page.tsx
 * @description 재고 모니터링 보드 — 유형별 KPI + 안전재고 미달 경고(자동 순환) + 창고별 분포 + 금일 입출고
 *
 * 초보자 가이드:
 * 1. 데이터는 GET /monitoring/boards/inventory 하나로 조회, refetchSec 간격 자동 갱신
 * 2. 안전재고 미달 목록은 useRotation 으로 rollingSec 마다 자동 페이지 전환
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, BoardStat, MonitoringSettingsModal,
  useMonitoringConfig, useRotation, RotationIndicator,
} from "@/components/monitoring";
import type { InventoryBoardData } from "./components/types";

const SHORTAGE_ROWS = 8;

export default function InventoryBoardPage() {
  const { t } = useTranslation();
  const { config, setConfig, loaded } = useMonitoringConfig("monitoring:inventory-board");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: response, refetch, dataUpdatedAt } = useApiQuery<InventoryBoardData>(
    ["monitoring", "board", "inventory"],
    "/monitoring/boards/inventory",
    { refetchInterval: Math.max(5, config.refetchSec) * 1000, enabled: loaded },
  );
  const board = response?.data;
  const shortages = board?.shortages ?? [];
  const { pageItems, page, pageCount } = useRotation(shortages, SHORTAGE_ROWS, config.rollingSec);
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <>
      <BoardChrome
        title={t("monitoring.board.inventory.title")}
        icon={<Boxes className="w-6 h-6 text-primary" />}
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
        statusRight={<RotationIndicator page={page} pageCount={pageCount} />}
      >
        {/* KPI 행 — 재고 유형별 + 금일 입출고 */}
        <div className="flex gap-3 flex-shrink-0">
          <BoardStat
            label={t("monitoring.board.inventory.material")}
            value={(board?.kpi.materialQty ?? 0).toLocaleString()}
            sub={`${board?.kpi.materialItems ?? 0} ${t("monitoring.board.inventory.itemsUnit")}`}
          />
          <BoardStat
            label={t("monitoring.board.inventory.semi")}
            value={(board?.kpi.semiQty ?? 0).toLocaleString()}
            sub={`${board?.kpi.semiItems ?? 0} ${t("monitoring.board.inventory.itemsUnit")}`}
          />
          <BoardStat
            label={t("monitoring.board.inventory.finished")}
            value={(board?.kpi.finishedQty ?? 0).toLocaleString()}
            sub={`${board?.kpi.finishedItems ?? 0} ${t("monitoring.board.inventory.itemsUnit")}`}
          />
          <BoardStat
            label={t("monitoring.board.inventory.todayIn")}
            value={(board?.todayInOut.inQty ?? 0).toLocaleString()}
            sub={`${board?.todayInOut.inCount ?? 0} ${t("monitoring.board.inventory.countUnit")}`}
            valueClassName="text-primary"
          />
          <BoardStat
            label={t("monitoring.board.inventory.todayOut")}
            value={(board?.todayInOut.outQty ?? 0).toLocaleString()}
            sub={`${board?.todayInOut.outCount ?? 0} ${t("monitoring.board.inventory.countUnit")}`}
            valueClassName="text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* 중단: 안전재고 미달 경고 + 창고별 분포 */}
        <div className="flex-1 min-h-0 flex gap-3">
          <div className="flex-[3] min-w-0 rounded-xl border border-border bg-surface px-3 py-2 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t("monitoring.board.inventory.shortageTitle")}
              <span className="text-text-muted font-normal">({shortages.length})</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {shortages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-text-muted">
                  {t("monitoring.board.inventory.noShortage")}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-text-muted">
                      <th className="px-2 py-1.5 text-left font-medium">{t("monitoring.board.col.item")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("monitoring.board.inventory.currentQty")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("monitoring.board.inventory.safetyStock")}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t("monitoring.board.inventory.shortageQty")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageItems.map((s) => (
                      <tr key={s.itemCode}>
                        <td className="px-2 py-1.5">
                          <span className="font-semibold text-text">{s.itemName ?? s.itemCode}</span>
                          <span className="ml-2 font-mono text-[11px] text-text-muted">{s.itemCode}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text">{s.qty.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{s.safetyStock.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-bold text-red-600 dark:text-red-400">
                          -{s.shortage.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex-[2] min-w-0 rounded-xl border border-border bg-surface px-3 py-2 flex flex-col overflow-hidden">
            <div className="text-xs font-semibold text-text-muted mb-1">{t("monitoring.board.inventory.byWarehouseTitle")}</div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-text-muted">
                    <th className="px-2 py-1.5 text-left font-medium">{t("monitoring.board.inventory.warehouse")}</th>
                    <th className="px-2 py-1.5 text-center font-medium">{t("monitoring.board.inventory.kind")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("monitoring.board.inventory.itemCount")}</th>
                    <th className="px-2 py-1.5 text-right font-medium">{t("monitoring.board.inventory.qty")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(board?.byWarehouse ?? []).map((w) => (
                    <tr key={`${w.stockKind}:${w.warehouseCode}`}>
                      <td className="px-2 py-1.5 font-semibold text-text">{w.warehouseCode}</td>
                      <td className="px-2 py-1.5 text-center text-xs text-text-muted">
                        {w.stockKind === "MATERIAL"
                          ? t("monitoring.board.inventory.kindMaterial")
                          : t("monitoring.board.inventory.kindProduct")}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">{w.itemCount.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-text">{w.qty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
