"use client";

/**
 * @file components/BoxReceiveList.tsx
 * @description 입고 대상 박스 체크선택 → 일괄 입고 (Method A)
 *
 * 초보자 가이드:
 * 1. 미입고 CLOSED 박스를 목록으로 표시 (박스 상태 배지 포함)
 * 2. 체크박스로 선택(전체선택 지원) + 입고창고 지정
 * 3. 일괄입고 클릭 시 선택 박스를 순차 입고 처리
 * 4. 부분 실패 시 실패한 박스를 명확히 표시
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, PackageCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Select } from "@/components/ui";
import { BoxStatusBadge, type BoxStatus } from "@/components/shipping";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import { useReceiveCandidates, receiveBoxes } from "./useBoxReceive";

interface BoxReceiveListProps {
  itemType: "SEMI_PRODUCT" | "FINISHED";
  onSuccess: () => void;
}

export default function BoxReceiveList({ itemType, onSuccess }: BoxReceiveListProps) {
  const { t } = useTranslation();
  const { candidates, loading, refetch } = useReceiveCandidates(itemType);

  const warehouseType = itemType === "SEMI_PRODUCT" ? "WIP" : "FG";
  const { options: whOptions } = useWarehouseOptions(warehouseType);

  const [warehouseId, setWarehouseId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<{ boxNo: string; reason: string }[]>([]);

  const allChecked = candidates.length > 0 && selected.size === candidates.length;
  const selectedCount = selected.size;
  const totalQty = useMemo(
    () => candidates.filter((c) => selected.has(c.boxNo)).reduce((s, c) => s + c.qty, 0),
    [candidates, selected],
  );

  const toggleOne = useCallback((boxNo: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(boxNo)) next.delete(boxNo);
      else next.add(boxNo);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.boxNo)),
    );
  }, [candidates]);

  const handleReceive = useCallback(async () => {
    if (!warehouseId || selected.size === 0) return;
    setSaving(true);
    setFailed([]);
    try {
      const targets = candidates.filter((c) => selected.has(c.boxNo));
      const result = await receiveBoxes(targets, warehouseId);
      setFailed(result.failed);
      // 성공분만 선택 해제, 실패분은 선택 유지
      setSelected(new Set(result.failed.map((f) => f.boxNo)));
      await refetch();
      onSuccess();
    } finally {
      setSaving(false);
    }
  }, [warehouseId, selected, candidates, refetch, onSuccess]);

  return (
    <Card className="h-full flex flex-col" padding="none">
      <CardContent className="h-full flex flex-col p-4 min-h-0">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            {t("productMgmt.receive.boxList.title")}
            <span className="text-sm font-normal text-text-muted">
              ({t("productMgmt.receive.boxList.count", { count: candidates.length })})
            </span>
          </h3>
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* 입고창고 + 일괄입고 */}
        <div className="flex items-end gap-2 mb-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <Select
              label={t("productMgmt.receive.modal.warehouseId")}
              options={whOptions}
              value={warehouseId}
              onChange={setWarehouseId}
              fullWidth
            />
          </div>
          <Button onClick={handleReceive} disabled={saving || selectedCount === 0 || !warehouseId}>
            <PackageCheck className="w-4 h-4 mr-1" />
            {saving
              ? t("common.saving")
              : t("productMgmt.receive.boxList.receiveSelected", { count: selectedCount })}
          </Button>
        </div>

        {/* 실패 보고 */}
        {failed.length > 0 && (
          <div className="mb-3 p-3 rounded-md border border-red-300 dark:border-red-800 text-sm text-red-600 dark:text-red-400 flex-shrink-0">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              {t("productMgmt.receive.boxList.partialFail", { count: failed.length })}
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {failed.map((f) => (
                <li key={f.boxNo}>
                  <span className="font-mono">{f.boxNo}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 목록 */}
        <div className="flex-1 min-h-0 border border-border rounded-md overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted dark:bg-slate-800 sticky top-0 z-10">
              <tr className="text-left text-text-muted">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={candidates.length === 0}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2">{t("productMgmt.receive.boxScan.title")}</th>
                <th className="px-3 py-2">{t("common.partCode")}</th>
                <th className="px-3 py-2">{t("common.partName")}</th>
                <th className="px-3 py-2">{t("common.status")}</th>
                <th className="px-3 py-2 text-right">{t("common.quantity")}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
                    {loading ? t("common.loading") : t("productMgmt.receive.boxList.empty")}
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr
                    key={c.boxNo}
                    className="border-t border-border hover:bg-muted/50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => toggleOne(c.boxNo)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.boxNo)}
                        onChange={() => toggleOne(c.boxNo)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{c.boxNo}</td>
                    <td className="px-3 py-2 font-mono">{c.itemCode}</td>
                    <td className="px-3 py-2">{c.itemName ?? "-"}</td>
                    <td className="px-3 py-2">
                      <BoxStatusBadge status={c.status as BoxStatus} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{c.qty.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
            {selectedCount > 0 && (
              <tfoot className="sticky bottom-0">
                <tr className="border-t border-border bg-muted/60 dark:bg-slate-800/60 font-medium">
                  <td colSpan={5} className="px-3 py-2 text-right text-text-muted">
                    {t("productMgmt.receive.boxList.selectedTotal", { count: selectedCount })}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">{totalQty.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
