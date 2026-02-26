"use client";

/**
 * @file components/ReceiveModal.tsx
 * @description 개별입고 등록 모달 - WIP/FG 품목유형 전환 버그 수정 포함
 *
 * 초보자 가이드:
 * 1. modalPartType을 페이지 activeTab과 독립적으로 관리
 * 2. 모달 내에서 WIP/FG 전환 시 partId를 자동 리셋
 * 3. usePartOptions(modalPartType)으로 모달 전용 품목 목록 사용
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@/components/ui";
import { usePartOptions, useWarehouseOptions } from "@/hooks/useMasterOptions";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultPartType?: "WIP" | "FG";
}

import api from "@/services/api";

const INITIAL_FORM = {
  itemCode: "",
  warehouseCode: "",
  qty: 1,
  orderNo: "",
  processCode: "",
  remark: "",
};

export default function ReceiveModal({
  isOpen,
  onClose,
  onSuccess,
  defaultPartType = "WIP",
}: ReceiveModalProps) {
  const { t } = useTranslation();

  const [modalPartType, setModalPartType] = useState<"WIP" | "FG">(defaultPartType);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const { options: partOptions } = usePartOptions(modalPartType);
  const { options: warehouseOptions } = useWarehouseOptions(modalPartType);

  const tabs = [
    { key: "WIP" as const, label: t("productMgmt.receive.tabWip") },
    { key: "FG" as const, label: t("productMgmt.receive.tabFg") },
  ];

  /** 품목유형 전환 — partId 리셋 */
  const handlePartTypeChange = useCallback((type: "WIP" | "FG") => {
    setModalPartType(type);
    setForm((prev) => ({ ...prev, itemCode: "" }));
  }, []);

  /** 입고 처리 */
  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || !form.warehouseCode || form.qty < 1) return;
    setSaving(true);
    try {
      const endpoint =
        modalPartType === "WIP" ? "/inventory/wip/receive" : "/inventory/fg/receive";
      await api.post(endpoint, {
        itemCode: form.itemCode,
        warehouseCode: form.warehouseCode,
        qty: form.qty,
        itemType: modalPartType,
        transType: modalPartType === "WIP" ? "WIP_IN" : "FG_IN",
        orderNo: form.orderNo || undefined,
        processCode: form.processCode || undefined,
        remark: form.remark || undefined,
      });
      setForm(INITIAL_FORM);
      onClose();
      onSuccess();
    } catch (e) {
      console.error("Receive failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, modalPartType, onClose, onSuccess]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("productMgmt.receive.modal.title")}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t("productMgmt.receive.modal.partType")}
            </label>
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handlePartTypeChange(tab.key)}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                    modalPartType === tab.key
                      ? "bg-primary text-white border-primary"
                      : "bg-surface border-border text-text hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <Select
            label={t("productMgmt.receive.modal.partId")}
            options={partOptions}
            value={form.itemCode}
            onChange={(v) => setForm({ ...form, itemCode: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t("productMgmt.receive.modal.warehouseId")}
            options={warehouseOptions}
            value={form.warehouseCode}
            onChange={(v) => setForm({ ...form, warehouseCode: v })}
          />
          <Input
            label={t("productMgmt.receive.modal.qty")}
            type="number"
            min={1}
            value={String(form.qty)}
            onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
            fullWidth
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("productMgmt.receive.modal.jobOrderId")}
            value={form.orderNo}
            onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
            fullWidth
          />
          <Input
            label={t("productMgmt.receive.modal.processCode")}
            value={form.processCode}
            onChange={(e) => setForm({ ...form, processCode: e.target.value })}
            fullWidth
          />
        </div>
        <Input
          label={t("productMgmt.receive.modal.remark")}
          value={form.remark}
          onChange={(e) => setForm({ ...form, remark: e.target.value })}
          fullWidth
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.itemCode || !form.warehouseCode}
          >
            {saving ? t("common.saving") : t("productMgmt.receive.modal.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
