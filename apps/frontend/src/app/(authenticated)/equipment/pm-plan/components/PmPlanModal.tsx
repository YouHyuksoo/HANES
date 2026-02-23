"use client";

/**
 * @file PmPlanModal.tsx
 * @description PM 계획 등록/수정 모달 - 기본정보 + 보전항목 테이블
 *
 * 초보자 가이드:
 * 1. **기본정보**: 설비선택, 계획코드/명, PM유형, 주기
 * 2. **항목 테이블**: [+항목추가] 버튼으로 동적 행 추가
 * 3. **저장**: POST(신규) / PUT(수정) /equipment/pm-plans
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";
import { useEquipOptions } from "@/hooks/useMasterOptions";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

interface PlanItemRow {
  seq: number;
  itemName: string;
  itemType: string;
  description: string;
  criteria: string;
  sparePartCode: string;
  sparePartQty: number;
  estimatedMinutes: number | null;
}

interface PmPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  editId: string | null;
  onSaved: () => void;
}

const EMPTY_ITEM: PlanItemRow = {
  seq: 1, itemName: "", itemType: "CHECK", description: "",
  criteria: "", sparePartCode: "", sparePartQty: 0, estimatedMinutes: null,
};

export default function PmPlanModal({ isOpen, onClose, editId, onSaved }: PmPlanModalProps) {
  const { t } = useTranslation();
  const { options: equipOptions } = useEquipOptions();
  const pmTypeOpts = useComCodeOptions("PM_TYPE");
  const cycleTypeOpts = useComCodeOptions("PM_CYCLE_TYPE");
  const itemTypeOpts = useComCodeOptions("PM_ITEM_TYPE");

  const [equipId, setEquipId] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [planName, setPlanName] = useState("");
  const [pmType, setPmType] = useState("TIME_BASED");
  const [cycleType, setCycleType] = useState("MONTHLY");
  const [cycleValue, setCycleValue] = useState(1);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<PlanItemRow[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editId) {
      loadDetail(editId);
    } else {
      resetForm();
    }
  }, [isOpen, editId]);

  const resetForm = useCallback(() => {
    setEquipId("");
    setPlanCode("");
    setPlanName("");
    setPmType("TIME_BASED");
    setCycleType("MONTHLY");
    setCycleValue(1);
    setEstimatedTime(null);
    setDescription("");
    setItems([{ ...EMPTY_ITEM }]);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/equipment/pm-plans/${id}`);
      const d = res.data?.data;
      if (d) {
        setEquipId(d.equipId || "");
        setPlanCode(d.planCode || "");
        setPlanName(d.planName || "");
        setPmType(d.pmType || "TIME_BASED");
        setCycleType(d.cycleType || "MONTHLY");
        setCycleValue(d.cycleValue || 1);
        setEstimatedTime(d.estimatedTime);
        setDescription(d.description || "");
        if (d.items?.length) {
          setItems(d.items.map((item: any) => ({
            seq: item.seq,
            itemName: item.itemName || "",
            itemType: item.itemType || "CHECK",
            description: item.description || "",
            criteria: item.criteria || "",
            sparePartCode: item.sparePartCode || "",
            sparePartQty: item.sparePartQty || 0,
            estimatedMinutes: item.estimatedMinutes,
          })));
        } else {
          setItems([{ ...EMPTY_ITEM }]);
        }
      }
    } catch (e) {
      console.error("Load detail failed:", e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { ...EMPTY_ITEM, seq: prev.length + 1 },
    ]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((item, i) => ({ ...item, seq: i + 1 }));
    });
  }, []);

  const updateItem = useCallback((idx: number, field: keyof PlanItemRow, value: string | number | null) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const canSave = useMemo(() => {
    if (!equipId || !planCode.trim() || !planName.trim()) return false;
    return items.every((item) => item.itemName.trim() !== "");
  }, [equipId, planCode, planName, items]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        equipId, planCode: planCode.trim(), planName: planName.trim(),
        pmType, cycleType, cycleValue,
        estimatedTime, description: description.trim() || null,
        items: items.map((item) => ({
          seq: item.seq,
          itemName: item.itemName.trim(),
          itemType: item.itemType,
          description: item.description.trim() || null,
          criteria: item.criteria.trim() || null,
          sparePartCode: item.sparePartCode.trim() || null,
          sparePartQty: item.sparePartQty || 0,
          estimatedMinutes: item.estimatedMinutes,
        })),
      };

      if (editId) {
        await api.put(`/equipment/pm-plans/${editId}`, payload);
      } else {
        await api.post("/equipment/pm-plans", payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [canSave, editId, equipId, planCode, planName, pmType, cycleType, cycleValue, estimatedTime, description, items, onSaved, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editId ? t("equipment.pmPlan.editPlan") : t("equipment.pmPlan.addPlan")}
      size="xl"
    >
      {loadingDetail ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-3">
            <Select
              label={t("equipment.pmPlan.equipSelect")}
              options={[{ value: "", label: t("equipment.pmPlan.equipPlaceholder") }, ...equipOptions]}
              value={equipId}
              onChange={setEquipId}
              fullWidth
            />
            <Input
              label={t("equipment.pmPlan.planCode")}
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
              placeholder="PM-001"
              disabled={!!editId}
              fullWidth
            />
            <Input
              label={t("equipment.pmPlan.planName")}
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder={t("equipment.pmPlan.planNamePlaceholder")}
              fullWidth
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Select
              label={t("equipment.pmPlan.pmType")}
              options={pmTypeOpts}
              value={pmType}
              onChange={setPmType}
              fullWidth
            />
            <Select
              label={t("equipment.pmPlan.cycleType")}
              options={cycleTypeOpts}
              value={cycleType}
              onChange={setCycleType}
              fullWidth
            />
            <Input
              label={t("equipment.pmPlan.cycleValue")}
              type="number"
              value={String(cycleValue)}
              onChange={(e) => setCycleValue(Number(e.target.value) || 1)}
              min={1}
              fullWidth
            />
            <Input
              label={t("equipment.pmPlan.estimatedTime")}
              type="number"
              value={estimatedTime !== null ? String(estimatedTime) : ""}
              onChange={(e) => setEstimatedTime(e.target.value ? Number(e.target.value) : null)}
              placeholder={t("common.hours")}
              fullWidth
            />
          </div>

          <Input
            label={t("common.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("equipment.pmPlan.descPlaceholder")}
            fullWidth
          />

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text">
                {t("equipment.pmPlan.itemsTitle")}
              </h3>
              <Button variant="ghost" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" />
                {t("equipment.pmPlan.addItem")}
              </Button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-2 text-center text-xs font-medium text-text-muted w-10">#</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-text-muted">{t("equipment.pmPlan.itemName")}</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-text-muted w-28">{t("equipment.pmPlan.itemType")}</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-text-muted w-36">{t("equipment.pmPlan.criteria")}</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-text-muted w-24">{t("equipment.pmPlan.sparePartCode")}</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-text-muted w-16">{t("equipment.pmPlan.estimatedMin")}</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-text-muted w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-2 py-1.5 text-center text-text-muted text-xs">{item.seq}</td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => updateItem(idx, "itemName", e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder={t("equipment.pmPlan.itemNamePlaceholder")}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={item.itemType}
                          onChange={(e) => updateItem(idx, "itemType", e.target.value)}
                          className="w-full text-xs px-1 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {itemTypeOpts.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.criteria}
                          onChange={(e) => updateItem(idx, "criteria", e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder={t("equipment.pmPlan.criteriaPlaceholder")}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={item.sparePartCode}
                          onChange={(e) => updateItem(idx, "sparePartCode", e.target.value)}
                          className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={item.estimatedMinutes !== null ? item.estimatedMinutes : ""}
                          onChange={(e) => updateItem(idx, "estimatedMinutes", e.target.value ? Number(e.target.value) : null)}
                          className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text text-center focus:outline-none focus:ring-1 focus:ring-primary"
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
      )}
    </Modal>
  );
}
