"use client";

/**
 * @file src/app/(authenticated)/monitoring/inventory-board/page.tsx
 * @description 재고 모니터링 보드 — "조치가 필요한 재고" 전광판:
 *              안전재고 미달(발주) / 유효기한 초과·임박 LOT(우선소진·폐기) / 보류·불량 재고(처리).
 *              무의미한 총수량 합계 없음. KPI는 전부 "문제 건수"(0이면 정상 초록).
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

const SHORTAGE_ROWS = 7;

const thCls = "px-3 pb-2 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted";

/** 문제 건수 KPI 색: 0이면 정상(초록), 있으면 경고색 */
const alertColor = (n: number, color: string) =>
  n > 0 ? color : "text-emerald-600 dark:text-emerald-400";

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
  const kpi = board?.kpi;
  const shortages = board?.shortages ?? [];
  const expiry = board?.expiry ?? [];
  const holds = board?.holds ?? [];
  const { pageItems, page, pageCount } = useRotation(shortages, SHORTAGE_ROWS, config.rollingSec);
  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const reasonLabel = (reason: string) => {
    switch (reason) {
      case "HOLD": return t("monitoring.board.inventory.reasonHold");
      case "IQC_FAIL": return t("monitoring.board.inventory.reasonIqcFail");
      case "IQC_HOLD": return t("monitoring.board.inventory.reasonIqcHold");
      case "DEFECT": return t("monitoring.board.inventory.reasonDefect");
      default: return reason;
    }
  };

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
        {/* KPI 스트립 — 전부 "조치 필요 건수" */}
        <div className="flex divide-x divide-border py-4 border-b border-border flex-shrink-0">
          <BoardStat
            label={t("monitoring.board.inventory.shortageTitle")}
            value={kpi?.shortageCount ?? 0}
            valueClassName={alertColor(kpi?.shortageCount ?? 0, "text-red-600 dark:text-red-400")}
          />
          <BoardStat
            label={t("monitoring.board.inventory.expired")}
            value={kpi?.expiredCount ?? 0}
            valueClassName={alertColor(kpi?.expiredCount ?? 0, "text-red-600 dark:text-red-400")}
          />
          <BoardStat
            label={t("monitoring.board.inventory.nearExpiry")}
            value={kpi?.nearExpiryCount ?? 0}
            valueClassName={alertColor(kpi?.nearExpiryCount ?? 0, "text-amber-600 dark:text-amber-400")}
          />
          <BoardStat
            label={t("monitoring.board.inventory.hold")}
            value={kpi?.holdCount ?? 0}
            valueClassName={alertColor(kpi?.holdCount ?? 0, "text-amber-600 dark:text-amber-400")}
          />
          <BoardStat
            label={t("monitoring.board.inventory.todayInOut")}
            value={
              <span>
                {kpi?.inCount ?? 0}
                <span className="text-text-muted text-3xl"> / </span>
                {kpi?.outCount ?? 0}
              </span>
            }
            sub={t("monitoring.board.inventory.todayInOutSub")}
          />
        </div>

        {/* 본문: 좌측 안전재고 미달(주인공) / 우측 기한 문제 + 보류·불량 */}
        <div className="flex-1 min-h-0 flex divide-x divide-border pt-3">
          {/* 안전재고 미달 */}
          <div className="flex-[3] min-w-0 pr-5 flex flex-col overflow-hidden">
            <BoardSectionTitle className="mb-2">
              <span className="inline-flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                {t("monitoring.board.inventory.shortageTitle")}
              </span>
            </BoardSectionTitle>
            <div className="flex-1 min-h-0 overflow-hidden">
              {shortages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xl text-text-muted">
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
                        <td className="py-3 pl-3 pr-3 border-l-4 border-l-red-500">
                          <span className="text-xl font-medium text-text">{s.itemName ?? s.itemCode}</span>
                          <span className="ml-2.5 font-mono text-sm text-text-muted">{s.itemCode}</span>
                        </td>
                        <td className="py-3 px-3 text-right text-2xl tabular-nums text-text">{s.qty.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-2xl tabular-nums text-text-muted">{s.safetyStock.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-2xl tabular-nums font-bold text-red-600 dark:text-red-400">
                          -{s.shortage.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 우측: 유효기한 + 보류/불량 */}
          <div className="flex-[2] min-w-0 pl-5 flex flex-col overflow-hidden">
            <BoardSectionTitle className="mb-2">{t("monitoring.board.inventory.expiryTitle")}</BoardSectionTitle>
            <div className="flex-1 min-h-0 overflow-hidden">
              {expiry.length === 0 ? (
                <div className="h-full flex items-center justify-center text-lg text-text-muted">
                  {t("monitoring.board.inventory.noExpiry")}
                </div>
              ) : (
                <div>
                  {expiry.slice(0, 6).map((e) => {
                    const expired = e.daysLeft < 0;
                    return (
                      <div
                        key={e.matUid}
                        className={`flex items-baseline gap-3 py-2 border-b border-border/60 border-l-4 pl-3 ${expired ? "border-l-red-500" : "border-l-amber-500"}`}
                      >
                        <span className="flex-1 min-w-0 truncate text-lg font-medium text-text">
                          {e.itemName ?? e.itemCode}
                        </span>
                        <span className="font-mono text-sm text-text-muted">{e.matUid}</span>
                        <span className="text-lg tabular-nums text-text">{e.qty.toLocaleString()}</span>
                        <span className={`w-24 text-right text-lg font-bold tabular-nums ${expired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {expired
                            ? t("monitoring.board.inventory.expiredDays", { days: Math.abs(e.daysLeft) })
                            : t("monitoring.board.inventory.daysLeft", { days: e.daysLeft })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <BoardSectionTitle className="mb-2 mt-3 pt-3 border-t border-border">
              {t("monitoring.board.inventory.holdTitle")}
            </BoardSectionTitle>
            <div className="flex-1 min-h-0 overflow-hidden">
              {holds.length === 0 ? (
                <div className="h-full flex items-center justify-center text-lg text-text-muted">
                  {t("monitoring.board.inventory.noHold")}
                </div>
              ) : (
                <div>
                  {holds.slice(0, 6).map((h) => (
                    <div
                      key={`${h.kind}:${h.ref}:${h.reason}`}
                      className="flex items-baseline gap-3 py-2 border-b border-border/60 border-l-4 border-l-amber-500 pl-3"
                    >
                      <span className="text-sm uppercase tracking-wider text-text-muted w-14 shrink-0">
                        {h.kind === "MATERIAL"
                          ? t("monitoring.board.inventory.kindMaterial")
                          : t("monitoring.board.inventory.kindProduct")}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-lg font-medium text-text">
                        {h.itemName ?? h.itemCode}
                      </span>
                      <span className="text-lg tabular-nums text-text">{h.qty.toLocaleString()}</span>
                      <span className="w-24 text-right text-base font-bold text-amber-600 dark:text-amber-400">
                        {reasonLabel(h.reason)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
