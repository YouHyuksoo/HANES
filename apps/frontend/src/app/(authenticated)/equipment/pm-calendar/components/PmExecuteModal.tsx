"use client";

/**
 * @file PmExecuteModal.tsx
 * @description PM Work Order 실행 모달 - 항목별 PASS/FAIL 결과 입력
 *
 * 초보자 가이드:
 * 1. **WO 기본정보**: WO번호, 설비, 예정일, 작업자 선택
 * 2. **항목별 결과**: Plan Items 기반 PASS/FAIL 라디오
 * 3. **종합결과**: FAIL 1건이면 전체 FAIL (자동)
 * 4. **저장**: POST /equipment/pm-work-orders/:id/execute
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select, ComCodeBadge } from "@/components/ui";
import { CheckCircle, XCircle } from "lucide-react";
import { useWorkerOptions } from "@/hooks/useMasterOptions";
import type { WoScheduleItem } from "./PmWorkOrderPanel";
import api from "@/services/api";

interface ItemResult {
  itemId: string;
  seq: number;
  itemName: string;
  itemType: string;
  result: "PASS" | "FAIL" | "";
  remark: string;
}

interface PmExecuteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WoScheduleItem | null;
  onSaved: () => void;
  mode?: "execute" | "view";
}

export default function PmExecuteModal({ isOpen, onClose, workOrder, onSaved, mode = "execute" }: PmExecuteModalProps) {
  const { t } = useTranslation();
  const isViewMode = mode === "view";
  const { options: workerOptions, isLoading: workersLoading } = useWorkerOptions();
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [items, setItems] = useState<ItemResult[]>([]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (workOrder && isOpen) {
      if (isViewMode && workOrder.results?.length > 0) {
        const savedItems: ItemResult[] = workOrder.results.map((r) => ({
          itemId: r.id,
          seq: r.seq,
          itemName: r.itemName,
          itemType: r.itemType,
          result: (r.result as "PASS" | "FAIL") || "",
          remark: r.remark || "",
        }));
        setItems(savedItems);
        setSelectedWorkerId(workOrder.assignedWorkerId || "");
        setRemark(workOrder.remark || "");
      } else {
        setItems(
          workOrder.planItems.map((item) => ({
            itemId: item.id, seq: item.seq, itemName: item.itemName,
            itemType: item.itemType, result: "", remark: "",
          }))
        );
        setSelectedWorkerId("");
        setRemark("");
      }
    }
  }, [workOrder, isOpen, isViewMode]);

  const overallResult = useMemo(() => {
    if (items.length === 0) return "";
    const allFilled = items.every((i) => i.result !== "");
    if (!allFilled) return "";
    return items.some((i) => i.result === "FAIL") ? "FAIL" : "PASS";
  }, [items]);

  const updateItem = useCallback((idx: number, field: keyof ItemResult, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const canSave = useMemo(() => {
    if (!selectedWorkerId) return false;
    if (items.length > 0 && items.some((i) => i.result === "")) return false;
    if (items.some((i) => i.result === "FAIL" && !i.remark.trim())) return false;
    return true;
  }, [selectedWorkerId, items]);

  const handleSave = useCallback(async () => {
    if (!workOrder || !canSave) return;
    setSaving(true);
    try {
      await api.post(`/equipment/pm-work-orders/${workOrder.id}/execute`, {
        assignedWorkerId: selectedWorkerId,
        overallResult: overallResult || "PASS",
        items: items.map((i) => ({
          itemId: i.itemId,
          seq: i.seq,
          itemName: i.itemName,
          itemType: i.itemType,
          criteria: workOrder.planItems.find((p) => p.id === i.itemId)?.criteria || null,
          result: i.result,
          remark: i.remark || null,
        })),
        remark: remark.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error("Execute failed:", e);
    } finally {
      setSaving(false);
    }
  }, [workOrder, canSave, items, selectedWorkerId, overallResult, remark, onSaved, onClose]);

  if (!workOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isViewMode ? t("common.viewDetail") : t("equipment.pmWorkOrder.executeWo")} - ${workOrder.workOrderNo}`}
      size="full"
    >
      <div className="space-y-4">
        {/* WO Info */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={t("equipment.pmWorkOrder.woNo")}
            value={workOrder.workOrderNo}
            disabled
            fullWidth
          />
          <Input
            label={t("equipment.pmPlan.equipCode")}
            value={`${workOrder.equip.equipCode} - ${workOrder.equip.equipName}`}
            disabled
            fullWidth
          />
          {isViewMode ? (
            <Input
              label={t("equipment.pmWorkOrder.worker")}
              value={workerOptions.find((w) => w.value === selectedWorkerId)?.label || selectedWorkerId || "-"}
              disabled
              fullWidth
            />
          ) : (
            <Select
              label={t("equipment.pmWorkOrder.worker")}
              options={[
                { value: "", label: t("equipment.pmWorkOrder.workerPlaceholder") },
                ...workerOptions,
              ]}
              value={selectedWorkerId}
              onChange={setSelectedWorkerId}
              disabled={workersLoading}
              fullWidth
            />
          )}
        </div>

        {/* Plan Items Table */}
        {items.length > 0 ? (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-12" />
                <col className="w-[22%]" />
                <col className="w-20" />
                <col className="w-[25%]" />
                <col className="w-36" />
                <col />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    {t("equipment.pmPlan.itemName")}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    {t("equipment.pmPlan.itemType")}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    {t("equipment.pmPlan.criteria")}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">
                    {t("equipment.pmWorkOrder.result")}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                    {t("common.remark")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={item.itemId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 text-text-muted">{item.seq}</td>
                    <td className="px-3 py-2 text-text font-medium truncate" title={item.itemName}>{item.itemName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <ComCodeBadge groupCode="PM_ITEM_TYPE" code={item.itemType} />
                    </td>
                    <td className="px-3 py-2 text-text-muted text-xs truncate" title={
                      (isViewMode ? workOrder.results?.[idx]?.criteria : workOrder.planItems[idx]?.criteria) || ""
                    }>
                      {(isViewMode ? workOrder.results?.[idx]?.criteria : workOrder.planItems[idx]?.criteria) || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {isViewMode ? (
                        <div className="flex items-center justify-center">
                          {item.result === "PASS" ? (
                            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 whitespace-nowrap">
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                              {t("equipment.inspectCalendar.pass")}
                            </span>
                          ) : item.result === "FAIL" ? (
                            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 whitespace-nowrap">
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              {t("equipment.inspectCalendar.fail")}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">-</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <button
                            onClick={() => updateItem(idx, "result", "PASS")}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                              item.result === "PASS"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ring-1 ring-green-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            {t("equipment.inspectCalendar.pass")}
                          </button>
                          <button
                            onClick={() => updateItem(idx, "result", "FAIL")}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                              item.result === "FAIL"
                                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 ring-1 ring-red-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            {t("equipment.inspectCalendar.fail")}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isViewMode ? (
                        <span className="text-xs text-text">{item.remark || "-"}</span>
                      ) : (
                        <input
                          type="text"
                          placeholder={item.result === "FAIL" ? t("equipment.inspectCalendar.failCausePlaceholder") : ""}
                          value={item.remark}
                          onChange={(e) => updateItem(idx, "remark", e.target.value)}
                          className={`w-full text-xs px-2 py-1 rounded border transition-colors
                            bg-white dark:bg-gray-900 text-text
                            ${item.result === "FAIL" && !item.remark.trim()
                              ? "border-red-300 dark:border-red-600"
                              : "border-gray-200 dark:border-gray-700"
                            }
                            focus:outline-none focus:ring-1 focus:ring-primary`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted text-sm">
            {t("equipment.pmWorkOrder.noItems")}
          </div>
        )}

        {/* Overall Result */}
        <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm font-medium text-text">
            {t("equipment.pmWorkOrder.overallResult")}:
          </span>
          {(isViewMode && workOrder.overallResult) ? (
            <span className={`px-3 py-1 rounded text-sm font-bold ${
              workOrder.overallResult === "PASS"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}>
              {workOrder.overallResult === "PASS" ? t("equipment.inspectCalendar.pass") : t("equipment.inspectCalendar.fail")}
            </span>
          ) : overallResult ? (
            <span className={`px-3 py-1 rounded text-sm font-bold ${
              overallResult === "PASS"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}>
              {overallResult === "PASS" ? t("equipment.inspectCalendar.pass") : t("equipment.inspectCalendar.fail")}
            </span>
          ) : (
            <span className="text-sm text-text-muted">
              {items.length > 0 ? t("equipment.pmWorkOrder.fillAllItems") : "-"}
            </span>
          )}
          {isViewMode && workOrder.completedAt && (
            <span className="text-xs text-text-muted ml-auto">
              {t("equipment.pmWorkOrder.completedAt")}: {new Date(workOrder.completedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Remark */}
        <Input
          label={t("common.remark")}
          placeholder={isViewMode ? "" : t("equipment.pmWorkOrder.remarkPlaceholder")}
          value={remark}
          onChange={(e) => !isViewMode && setRemark(e.target.value)}
          disabled={isViewMode}
          fullWidth
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          {isViewMode ? (
            <Button variant="secondary" onClick={onClose}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={!canSave || saving}>
                {saving ? t("common.saving") : t("equipment.pmWorkOrder.completeWo")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
