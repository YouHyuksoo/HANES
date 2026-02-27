/**
 * @file production/monthly-plan/components/PlanFormPanel.tsx
 * @description 월간생산계획 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST /production/prod-plans (생성), PUT /production/prod-plans/:id (수정)
 * 3. **폼 필드**: 계획월, 품목코드, 품목유형, 계획수량, 고객사, 라인, 우선순위, 비고
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { PartSearchModal } from "@/components/shared";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import { ProdPlanItem } from "./types";

interface ProdLine { lineCode: string; lineName: string; }

interface Props {
  editingPlan: ProdPlanItem | null;
  defaultMonth: string;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function PlanFormPanel({ editingPlan, defaultMonth, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingPlan;

  const { options: customerRawOptions, isLoading: customersLoading } = usePartnerOptions("CUSTOMER");
  const customerOptions = useMemo(() => [
    { value: "", label: t("common.select") },
    ...customerRawOptions,
  ], [t, customerRawOptions]);

  const itemTypeOptions = useMemo(() => [
    { value: "FG", label: t("inventory.stock.fg", "완제품") },
    { value: "WIP", label: t("inventory.stock.wip", "반제품") },
  ], [t]);

  const [lineOptions, setLineOptions] = useState<{ value: string; label: string }[]>([]);
  const fetchLines = useCallback(async () => {
    try {
      const res = await api.get("/master/prod-lines", { params: { limit: 5000 } });
      const lines: ProdLine[] = res.data?.data ?? [];
      setLineOptions([
        { value: "", label: t("common.select") },
        ...lines.map(l => ({ value: l.lineCode, label: `${l.lineCode} - ${l.lineName}` })),
      ]);
    } catch { setLineOptions([{ value: "", label: t("common.select") }]); }
  }, [t]);
  useEffect(() => { fetchLines(); }, [fetchLines]);

  const [form, setForm] = useState(() => ({
    planMonth: editingPlan?.planMonth || defaultMonth,
    itemCode: editingPlan?.itemCode || "",
    itemType: editingPlan?.itemType || "FG",
    planQty: editingPlan?.planQty ?? 0,
    customer: editingPlan?.customer || "",
    lineCode: editingPlan?.lineCode || "",
    priority: editingPlan?.priority ?? 5,
    remark: editingPlan?.remark || "",
  }));
  const [saving, setSaving] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  useEffect(() => {
    setForm({
      planMonth: editingPlan?.planMonth || defaultMonth,
      itemCode: editingPlan?.itemCode || "",
      itemType: editingPlan?.itemType || "FG",
      planQty: editingPlan?.planQty ?? 0,
      customer: editingPlan?.customer || "",
      lineCode: editingPlan?.lineCode || "",
      priority: editingPlan?.priority ?? 5,
      remark: editingPlan?.remark || "",
    });
  }, [editingPlan, defaultMonth]);

  const setField = (key: string, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.itemCode.trim() || form.planQty <= 0) return;
    setSaving(true);
    try {
      const payload = {
        planMonth: form.planMonth,
        itemCode: form.itemCode,
        itemType: form.itemType,
        planQty: form.planQty,
        customer: form.customer || undefined,
        lineCode: form.lineCode || undefined,
        priority: form.priority,
        remark: form.remark || undefined,
      };

      if (isEdit && editingPlan?.id) {
        await api.put(`/production/prod-plans/${editingPlan.id}`, payload);
      } else {
        await api.post("/production/prod-plans", payload);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}
    >
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("monthlyPlan.editPlan") : t("monthlyPlan.addPlan")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("monthlyPlan.sectionBasic")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("monthlyPlan.planMonth")}
              type="month"
              value={form.planMonth}
              onChange={e => setField("planMonth", e.target.value)}
              disabled={isEdit}
              fullWidth
            />
            <Select
              label={t("monthlyPlan.itemType")}
              options={itemTypeOptions}
              value={form.itemType}
              onChange={v => setField("itemType", v)}
              fullWidth
            />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-text mb-1.5">
                {t("common.partCode")}
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={form.itemCode}
                  readOnly
                  placeholder="HNS-001"
                  disabled={isEdit}
                  fullWidth
                />
                <button
                  type="button"
                  onClick={() => setPartSearchOpen(true)}
                  disabled={isEdit}
                  className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-surface hover:bg-primary/10 text-text-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t("common.partSearch")}
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
            <Input
              label={t("monthlyPlan.planQty")}
              type="number"
              placeholder="1000"
              value={String(form.planQty)}
              onChange={e => setField("planQty", Number(e.target.value))}
              fullWidth
            />
            <Input
              label={t("monthlyPlan.priority")}
              type="number"
              placeholder="5"
              value={String(form.priority)}
              onChange={e => setField("priority", Number(e.target.value))}
              fullWidth
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("monthlyPlan.sectionDetail")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("monthlyPlan.customer")}
              options={customerOptions}
              value={form.customer}
              onChange={v => setField("customer", v)}
              disabled={customersLoading}
              fullWidth
            />
            <Select
              label={t("monthlyPlan.lineCode")}
              options={lineOptions}
              value={form.lineCode}
              onChange={v => setField("lineCode", v)}
              fullWidth
            />
            <div className="col-span-2">
              <Input
                label={t("common.remark")}
                placeholder={t("common.remarkPlaceholder")}
                value={form.remark}
                onChange={e => setField("remark", e.target.value)}
                fullWidth
              />
            </div>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          onClick={handleSubmit}
          disabled={saving || !form.itemCode.trim() || form.planQty <= 0}
        >
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={(part) => {
          setField("itemCode", part.itemCode);
          if (part.itemType) setField("itemType", part.itemType);
        }}
        itemType={form.itemType || undefined}
      />
    </div>
  );
}
