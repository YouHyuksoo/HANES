"use client";

/**
 * @file production/order/components/CreateJobOrderModal.tsx
 * @description 작업지시 생성 모달 - BOM 기반 반제품 자동생성 옵션 포함
 *
 * 초보자 가이드:
 * 1. 품목 선택 → 계획수량/일자 입력 → BOM 자동생성 체크 → 생성
 * 2. autoCreateChildren 옵션 시 WIP 반제품 작업지시 동시 생성
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select } from "@/components/ui";
import api from "@/services/api";

interface PartOption {
  value: string;
  label: string;
}

interface CreateJobOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateJobOrderModal({ isOpen, onClose, onCreated }: CreateJobOrderModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [parts, setParts] = useState<PartOption[]>([]);

  const [form, setForm] = useState({
    orderNo: "",
    partId: "",
    planQty: "",
    planDate: "",
    lineCode: "",
    priority: "5",
    remark: "",
    autoCreateChildren: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    api.get("/master/parts", { params: { limit: 5000 } }).then(res => {
      const list = (res.data?.data ?? []).map((p: any) => ({
        value: p.id,
        label: `${p.partCode} - ${p.partName}`,
      }));
      setParts(list);
    }).catch(() => setParts([]));
  }, [isOpen]);

  const generateOrderNo = useCallback(() => {
    const d = new Date();
    const prefix = `JO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `${prefix}-${seq}`;
  }, []);

  useEffect(() => {
    if (isOpen && !form.orderNo) {
      setForm(prev => ({ ...prev, orderNo: generateOrderNo() }));
    }
  }, [isOpen, form.orderNo, generateOrderNo]);

  const handleSubmit = useCallback(async () => {
    if (!form.partId || !form.planQty) return;
    setSaving(true);
    try {
      await api.post("/production/job-orders", {
        orderNo: form.orderNo,
        partId: form.partId,
        planQty: Number(form.planQty),
        planDate: form.planDate || undefined,
        lineCode: form.lineCode || undefined,
        priority: Number(form.priority),
        remark: form.remark || undefined,
        autoCreateChildren: form.autoCreateChildren,
      });
      setForm({ orderNo: "", partId: "", planQty: "", planDate: "", lineCode: "", priority: "5", remark: "", autoCreateChildren: false });
      onCreated();
      onClose();
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, onCreated, onClose]);

  const partOptions = useMemo(() => [{ value: "", label: t("common.select") }, ...parts], [t, parts]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("production.order.createTitle")} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("production.order.orderNo")} value={form.orderNo}
            onChange={e => setForm(p => ({ ...p, orderNo: e.target.value }))} fullWidth />
          <Select label={t("common.partName")} options={partOptions} value={form.partId}
            onChange={v => setForm(p => ({ ...p, partId: v }))} fullWidth />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label={t("production.order.planQty")} type="number" value={form.planQty}
            onChange={e => setForm(p => ({ ...p, planQty: e.target.value }))} fullWidth />
          <Input label={t("production.order.planDate")} type="date" value={form.planDate}
            onChange={e => setForm(p => ({ ...p, planDate: e.target.value }))} fullWidth />
          <Input label={t("production.order.priority")} type="number" value={form.priority}
            onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("production.order.line")} value={form.lineCode}
            onChange={e => setForm(p => ({ ...p, lineCode: e.target.value }))} fullWidth />
          <Input label={t("common.remark")} value={form.remark}
            onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
        </div>
        <label className="flex items-center gap-2 text-sm text-text cursor-pointer p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <input type="checkbox" checked={form.autoCreateChildren}
            onChange={e => setForm(p => ({ ...p, autoCreateChildren: e.target.checked }))}
            className="w-4 h-4 rounded accent-primary" />
          {t("production.order.autoCreateChildren")}
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.partId || !form.planQty}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </Modal>
  );
}
