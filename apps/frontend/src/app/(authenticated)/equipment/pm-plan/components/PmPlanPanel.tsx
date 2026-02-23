"use client";

/**
 * @file PmPlanPanel.tsx
 * @description PM 계획 등록/수정 우측 슬라이드 패널 - 기본정보 + 보전항목 테이블
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 우측에서 슬라이드-인 되는 폼 패널
 * 2. **기본정보**: 설비선택, 계획코드/명, PM유형, 주기
 * 3. **항목 테이블**: [+항목추가] 버튼으로 동적 행 추가
 * 4. **저장**: POST(신규) / PUT(수정) /equipment/pm-plans
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "@/components/ui";
import { X, Plus, Trash2 } from "lucide-react";
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

interface PmPlanData {
  id: string;
  planCode: string;
  planName: string;
  pmType: string;
  cycleType: string;
  cycleValue: number;
  equipId: string;
  estimatedTime: number | null;
  description: string;
}

interface Props {
  editingPlan: PmPlanData | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const EMPTY_ITEM: PlanItemRow = {
  seq: 1, itemName: "", itemType: "CHECK", description: "",
  criteria: "", sparePartCode: "", sparePartQty: 0, estimatedMinutes: null,
};

export default function PmPlanPanel({ editingPlan, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingPlan;
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
    if (editingPlan) {
      loadDetail(editingPlan.id);
    } else {
      resetForm();
    }
  }, [editingPlan]);

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
    setItems((prev) => [...prev, { ...EMPTY_ITEM, seq: prev.length + 1 }]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, seq: i + 1 })));
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
      if (editingPlan) {
        await api.put(`/equipment/pm-plans/${editingPlan.id}`, payload);
      } else {
        await api.post("/equipment/pm-plans", payload);
      }
      onSave();
      onClose();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [canSave, editingPlan, equipId, planCode, planName, pmType, cycleType, cycleValue, estimatedTime, description, items, onSave, onClose]);

  return (
    <div className={`w-[580px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("equipment.pmPlan.editPlan") : t("equipment.pmPlan.addPlan")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* 기본정보 */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("equipment.pmPlan.sectionBasic", "기본정보")}</h3>
              <div className="grid grid-cols-2 gap-3">
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
                  disabled={isEdit}
                  fullWidth
                />
                <Input
                  label={t("equipment.pmPlan.planName")}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder={t("equipment.pmPlan.planNamePlaceholder")}
                  fullWidth
                />
                <Input
                  label={t("common.description")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("equipment.pmPlan.descPlaceholder")}
                  fullWidth
                />
              </div>
            </div>

            {/* 주기 설정 */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("equipment.pmPlan.sectionCycle", "주기 설정")}</h3>
              <div className="grid grid-cols-2 gap-3">
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
            </div>

            {/* 보전항목 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-text-muted flex items-center gap-1">
                  {t("equipment.pmPlan.itemsTitle")}
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-medium">
                    {items.length}
                  </span>
                </h3>
                <button
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />{t("equipment.pmPlan.addItem")}
                </button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-2 py-1.5 text-center text-text-muted font-medium w-8">#</th>
                      <th className="px-2 py-1.5 text-left text-text-muted font-medium">{t("equipment.pmPlan.itemName")}</th>
                      <th className="px-2 py-1.5 text-left text-text-muted font-medium w-24">{t("equipment.pmPlan.itemType")}</th>
                      <th className="px-2 py-1.5 text-left text-text-muted font-medium w-28">{t("equipment.pmPlan.criteria")}</th>
                      <th className="px-2 py-1.5 text-left text-text-muted font-medium w-20">{t("equipment.pmPlan.sparePartCode")}</th>
                      <th className="px-2 py-1.5 text-center text-text-muted font-medium w-12">{t("equipment.pmPlan.estimatedMin")}</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t border-border hover:bg-surface/50">
                        <td className="px-2 py-1 text-center text-text-muted">{item.seq}</td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => updateItem(idx, "itemName", e.target.value)}
                            className="w-full text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder={t("equipment.pmPlan.itemNamePlaceholder")}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={item.itemType}
                            onChange={(e) => updateItem(idx, "itemType", e.target.value)}
                            className="w-full text-xs px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {itemTypeOpts.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.criteria}
                            onChange={(e) => updateItem(idx, "criteria", e.target.value)}
                            className="w-full text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder={t("equipment.pmPlan.criteriaPlaceholder")}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item.sparePartCode}
                            onChange={(e) => updateItem(idx, "sparePartCode", e.target.value)}
                            className="w-full text-xs px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={item.estimatedMinutes !== null ? item.estimatedMinutes : ""}
                            onChange={(e) => updateItem(idx, "estimatedMinutes", e.target.value ? Number(e.target.value) : null)}
                            className="w-full text-xs px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            min={0}
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          {items.length > 1 && (
                            <button
                              onClick={() => removeItem(idx)}
                              className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </div>
  );
}
