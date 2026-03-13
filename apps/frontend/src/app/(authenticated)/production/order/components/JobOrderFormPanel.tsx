"use client";

/**
 * @file production/order/components/JobOrderFormPanel.tsx
 * @description 작업지시 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. editingOrder=null → 신규 생성, editingOrder 있으면 수정
 * 3. API: POST /production/job-orders (생성), PUT /production/job-orders/:id (수정)
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PartSearchModal, LineSelect, ProcessSelect, EquipSelect } from "@/components/shared";
import api from "@/services/api";

export interface JobOrderFormData {
  id: string;
  orderNo: string;
  itemCode: string;
  lineCode?: string;
  processCode?: string;
  equipCode?: string;
  custPoNo?: string | null;
  planQty: number;
  planDate?: string;
  priority: number;
  remark?: string;
}

interface Props {
  editingOrder: JobOrderFormData | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const INIT_FORM = {
  orderNo: "",
  itemCode: "",
  planQty: "",
  planDate: "",
  lineCode: "",
  processCode: "",
  equipCode: "",
  custPoNo: "",
  priority: "5",
  remark: "",
  autoCreateChildren: false,
};

export default function JobOrderFormPanel({ editingOrder, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingOrder;
  const [saving, setSaving] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  const generateOrderNo = useCallback(() => {
    const d = new Date();
    const prefix = `JO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `${prefix}-${seq}`;
  }, []);

  const [form, setForm] = useState({ ...INIT_FORM });

  useEffect(() => {
    if (editingOrder) {
      setForm({
        orderNo: editingOrder.orderNo || "",
        itemCode: editingOrder.itemCode || "",
        planQty: String(editingOrder.planQty ?? ""),
        planDate: editingOrder.planDate ? String(editingOrder.planDate).slice(0, 10) : "",
        lineCode: editingOrder.lineCode || "",
        processCode: editingOrder.processCode || "",
        equipCode: editingOrder.equipCode || "",
        custPoNo: editingOrder.custPoNo || "",
        priority: String(editingOrder.priority ?? "5"),
        remark: editingOrder.remark || "",
        autoCreateChildren: false,
      });
    } else {
      setForm({ ...INIT_FORM, orderNo: generateOrderNo() });
    }
  }, [editingOrder, generateOrderNo]);

  const setField = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || !form.planQty) return;
    setSaving(true);
    try {
      const payload = {
        orderNo: form.orderNo,
        itemCode: form.itemCode,
        planQty: Number(form.planQty),
        planDate: form.planDate || undefined,
        lineCode: form.lineCode || undefined,
        processCode: form.processCode || undefined,
        equipCode: form.equipCode || undefined,
        custPoNo: form.custPoNo || undefined,
        priority: Number(form.priority),
        remark: form.remark || undefined,
        autoCreateChildren: form.autoCreateChildren,
      };
      if (isEdit && editingOrder?.id) {
        await api.put(`/production/job-orders/${editingOrder.id}`, payload);
      } else {
        await api.post("/production/job-orders", payload);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editingOrder, onSave, onClose]);

  return (
    <>
      <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-text">
            {isEdit ? t("production.order.editTitle") : t("production.order.createTitle")}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
            <X className="w-4 h-4 text-text-muted hover:text-text" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* 기본정보 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("production.order.sectionBasic")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("production.order.orderNo")} value={form.orderNo}
                onChange={e => setField("orderNo", e.target.value)} disabled={isEdit} fullWidth />
              <div>
                <label className="block text-xs font-medium text-text mb-1">{t("common.partName")}</label>
                <div className="flex gap-1">
                  <Input value={form.itemCode} readOnly
                    placeholder={t("common.partSearchPlaceholder")} fullWidth />
                  <button type="button" onClick={() => setPartSearchOpen(true)}
                    className="flex-shrink-0 h-[30px] w-[30px] flex items-center justify-center rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-surface hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                    title={t("common.partSearch")}>
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <Input label={t("production.order.planQty")} type="number" value={form.planQty}
                onChange={e => setField("planQty", e.target.value)} fullWidth />
              <Input label={t("production.order.planDate")} type="date" value={form.planDate}
                onChange={e => setField("planDate", e.target.value)} fullWidth />
              <Input label={t("production.order.priority")} type="number" value={form.priority}
                onChange={e => setField("priority", e.target.value)} fullWidth />
              <Input label={t("production.order.custPoNo")} value={form.custPoNo}
                onChange={e => setField("custPoNo", e.target.value)}
                placeholder="PO-2026-0001" fullWidth />
            </div>
          </div>

          {/* 라인/공정/설비 */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("production.order.sectionProcessLineEquip")}</h3>
            <div className="grid grid-cols-1 gap-3">
              <ProcessSelect label={t("production.order.process")} value={form.processCode}
                onChange={v => setField("processCode", v)} fullWidth />
              <LineSelect label={t("production.order.line")} value={form.lineCode}
                onChange={v => setField("lineCode", v)} fullWidth />
              <EquipSelect label={t("production.order.equip")} value={form.equipCode}
                onChange={v => setField("equipCode", v)} fullWidth />
            </div>
          </div>

          {/* 비고 */}
          <div>
            <Input label={t("common.remark")} value={form.remark}
              onChange={e => setField("remark", e.target.value)} fullWidth />
          </div>

          {/* BOM 자동생성 (신규 시만) */}
          {!isEdit && (
            <label className="flex items-center gap-2 text-xs text-text cursor-pointer p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <input type="checkbox" checked={form.autoCreateChildren}
                onChange={e => setField("autoCreateChildren", e.target.checked)}
                className="w-4 h-4 rounded accent-primary" />
              {t("production.order.autoCreateChildren")}
            </label>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.itemCode || !form.planQty}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={(part) => setForm(p => ({ ...p, itemCode: part.itemCode }))}
      />
    </>
  );
}
