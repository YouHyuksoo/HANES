"use client";

/**
 * @file InspectExecuteModal.tsx
 * @description 점검 실행 모달 - 설비별 점검항목에 PASS/FAIL 결과를 입력하고 저장
 *
 * 초보자 가이드:
 * 1. **항목별 결과**: PASS/FAIL 라디오 선택
 * 2. **FAIL 시 비고**: 불합격 사유 필수 입력
 * 3. **종합결과**: FAIL 1건이라도 있으면 자동 FAIL
 * 4. **저장**: POST /equipment/daily-inspect (details JSON에 항목별 결과)
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select } from "@/components/ui";
import { CheckCircle, XCircle } from "lucide-react";
import type { DayScheduleEquip, DayScheduleItem } from "./DaySchedulePanel";
import { useWorkerOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface ItemResult {
  itemId: string;
  seq: number;
  itemName: string;
  result: "PASS" | "FAIL" | "";
  remark: string;
}

interface InspectExecuteModalProps {
  isOpen: boolean;
  onClose: () => void;
  equip: DayScheduleEquip | null;
  date: string;
  onSaved: () => void;
  inspectType?: string;
  apiBasePath?: string;
  inspectTitleKey?: string;
}

export default function InspectExecuteModal({
  isOpen, onClose, equip, date, onSaved,
  inspectType = "DAILY",
  apiBasePath = "/equipment/daily-inspect",
  inspectTitleKey = "equipment.inspectCalendar.inspectTitle",
}: InspectExecuteModalProps) {
  const { t } = useTranslation();
  const { options: workerOptions, isLoading: workersLoading } = useWorkerOptions();
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [items, setItems] = useState<ItemResult[]>([]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  /** 수정 모드 여부 */
  const isEditMode = !!(equip?.inspected && equip?.logId);

  // 모달 열릴 때 항목 초기화 (신규 / 수정 공통)
  useMemo(() => {
    if (equip && isOpen) {
      setItems(
        equip.items.map((item) => ({
          itemId: item.itemId,
          seq: item.seq,
          itemName: item.itemName,
          result: (item.result as "PASS" | "FAIL" | "") || "",
          remark: item.remark || "",
        }))
      );
      // 수정 모드: 기존 점검자를 workerOptions에서 이름으로 매칭
      if (equip.inspected && equip.inspectorName) {
        const matchedWorker = workerOptions.find((o) => o.label === equip.inspectorName);
        setSelectedWorkerId(matchedWorker?.value ?? "");
      } else {
        setSelectedWorkerId("");
      }
      setRemark("");
    }
  }, [equip, isOpen, workerOptions]);

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

  /** 선택된 작업자 ID → 이름 변환 */
  const inspectorName = useMemo(() => {
    if (!selectedWorkerId) return "";
    return workerOptions.find((o) => o.value === selectedWorkerId)?.label ?? "";
  }, [selectedWorkerId, workerOptions]);

  const canSave = useMemo(() => {
    if (!selectedWorkerId) return false;
    if (items.some((i) => i.result === "")) return false;
    if (items.some((i) => i.result === "FAIL" && !i.remark.trim())) return false;
    return true;
  }, [selectedWorkerId, items]);

  const handleSave = useCallback(async () => {
    if (!equip || !canSave) return;
    setSaving(true);
    try {
      const details = {
        items: items.map((i) => ({
          itemId: i.itemId,
          seq: i.seq,
          itemName: i.itemName,
          result: i.result,
          remark: i.remark,
        })),
      };
      const payload = {
        equipId: equip.equipId,
        inspectType,
        inspectDate: date,
        inspectorName: inspectorName.trim(),
        overallResult,
        details,
        remark: remark.trim() || null,
      };
      if (isEditMode && equip.logId) {
        await api.put(`${apiBasePath}/${equip.logId}`, payload);
      } else {
        await api.post(apiBasePath, payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [equip, canSave, items, date, inspectorName, overallResult, remark, onSaved, onClose, selectedWorkerId]);

  if (!equip) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${equip.equipCode} ${equip.equipName} ${t(inspectTitleKey)} ${isEditMode ? `(${t("common.edit")})` : ""}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Header info */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("equipment.inspectCalendar.inspectDate")}
            value={date}
            disabled
            fullWidth
          />
          <Select
            label={t("equipment.inspectCalendar.inspectorName")}
            options={[
              { value: "", label: t("equipment.inspectCalendar.inspectorPlaceholder") },
              ...workerOptions,
            ]}
            value={selectedWorkerId}
            onChange={setSelectedWorkerId}
            disabled={workersLoading}
            fullWidth
          />
        </div>

        {/* Items table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-12">
                  {t("equipment.inspectCalendar.seq")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">
                  {t("equipment.inspectCalendar.itemName")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-40">
                  {t("equipment.inspectCalendar.criteria")}
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-text-muted w-32">
                  {t("equipment.inspectCalendar.itemResult")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-muted w-48">
                  {t("equipment.inspectCalendar.failCause")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item, idx) => (
                <tr key={item.itemId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 text-text-muted">{item.seq}</td>
                  <td className="px-3 py-2 text-text font-medium">{item.itemName}</td>
                  <td className="px-3 py-2 text-text-muted text-xs">
                    {equip.items[idx]?.criteria || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => updateItem(idx, "result", "PASS")}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          item.result === "PASS"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ring-1 ring-green-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t("equipment.inspectCalendar.pass")}
                      </button>
                      <button
                        onClick={() => updateItem(idx, "result", "FAIL")}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          item.result === "FAIL"
                            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 ring-1 ring-red-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t("equipment.inspectCalendar.fail")}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Overall result */}
        <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm font-medium text-text">
            {t("equipment.inspectCalendar.overallResult")}:
          </span>
          {overallResult ? (
            <span className={`px-3 py-1 rounded text-sm font-bold ${
              overallResult === "PASS"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}>
              {overallResult === "PASS" ? t("equipment.inspectCalendar.pass") : t("equipment.inspectCalendar.fail")}
            </span>
          ) : (
            <span className="text-sm text-text-muted">-</span>
          )}
          <span className="text-xs text-text-muted">({t("equipment.inspectCalendar.autoCalc")})</span>
        </div>

        {/* Remark */}
        <Input
          label={t("equipment.inspectCalendar.remark")}
          placeholder={t("equipment.inspectCalendar.remarkPlaceholder")}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          fullWidth
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
