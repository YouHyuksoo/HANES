"use client";

/**
 * @file src/app/(authenticated)/monitoring/inventory-board/page.tsx
 * @description 재고 모니터링 보드 — 전광판 스타일: 유형별 KPI 스트립 + 안전재고 미달(주인공 테이블,
 *              자동 순환) + 창고별 분포. 카드박스 대신 괘선 구획.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import {
  BoardChrome, BoardClock, BoardStat, BoardSectionTitle, MonitoringSettingsModal,
  useMonitoringConfig, useRotation, RotationIndicator,
} from "@/components/monitoring";
import type { InventoryBoardData } from "./components/types";

const SHORTAGE_ROWS = 9;

const thCls = "px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted";

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
        icon={<Boxes className="w-5 h-5 text-primary" />}
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
        statusRight={<RotationIndicator page={page} pageCount={pageCount} />}
      >
        {/* KPI 스트립 — 재고 유형 + 금일 입출고 */}
        <div className="flex divide-x divide-border py-4 border-b border-border flex-shrink-0">
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

        {/* 중단: 안전재고 미달(주인공) + 창고별 분포 — 세로 괘선 2분할 */}
        <div className="flex-1 min-h-0 flex divide-x divide-border pt-3">
          <div className="flex-[3] min-w-0 pr-5 flex flex-col overflow-hidden">
            <BoardSectionTitle className="mb-2">
              <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t("monitoring.board.inventory.shortageTitle")}
              </span>
              <span className="ml-2 normal-case tracking-normal">({shortages.length})</span>
            </BoardSectionTitle>
            <div className="flex-1 min-h-0 overflow-hidden">
              {shortages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-text-muted">
                  {t("monitoring.board.inventory.noShortage")}
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className={thCls}>{t("monitoring.board.col.item")}</th>
                      <th className={`${thCls} text-right`}>{t("monitoring.board.inventory.currentQty")}</th>
                      <th className={`${thCls} text-right`}>{t("monitoring.board.inventory.safetyStock")}</th>
                      <th className={`${thCls} text-right`}>{t("monitoring.board.inventory.shortageQty")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((s) => (
                      <tr key={s.itemCode} className="border-b border-border/60">
                        <td className="py-2 pl-3 pr-3 border-l-4 border-l-red-500">
                          <span className="text-base font-medium text-text">{s.itemName ?? s.itemCode}</span>
                          <span className="ml-2 font-mono text-[11px] text-text-muted">{s.itemCode}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-lg tabular-nums text-text">{s.qty.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-lg tabular-nums text-text-muted">{s.safetyStock.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-lg tabular-nums font-bold text-red-600 dark:text-red-400">
                          -{s.shortage.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex-[2] min-w-0 pl-5 flex flex-col overflow-hidden">
            <BoardSectionTitle className="mb-2">{t("monitoring.board.inventory.byWarehouseTitle")}</BoardSectionTitle>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className={thCls}>{t("monitoring.board.inventory.warehouse")}</th>
                    <th className={thCls}>{t("monitoring.board.inventory.kind")}</th>
                    <th className={`${thCls} text-right`}>{t("monitoring.board.inventory.itemCount")}</th>
                    <th className={`${thCls} text-right`}>{t("monitoring.board.inventory.qty")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(board?.byWarehouse ?? []).map((w) => (
                    <tr key={`${w.stockKind}:${w.warehouseCode}`} className="border-b border-border/60">
                      <td className="py-2 px-3 text-base font-medium text-text">{w.warehouseCode}</td>
                      <td className="py-2 px-3 text-xs uppercase tracking-wider text-text-muted">
                        {w.stockKind === "MATERIAL"
                          ? t("monitoring.board.inventory.kindMaterial")
                          : t("monitoring.board.inventory.kindProduct")}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-muted">{w.itemCount.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-lg tabular-nums font-bold text-text">{w.qty.toLocaleString()}</td>
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
