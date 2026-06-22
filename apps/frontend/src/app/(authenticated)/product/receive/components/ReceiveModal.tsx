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
import { QtyInput } from "@/components/shared";
import { usePartOptions, useWarehouseOptions } from "@/hooks/useMasterOptions";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultPartType?: "SEMI_PRODUCT" | "FINISHED";
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
  defaultPartType = "SEMI_PRODUCT",
}: ReceiveModalProps) {
  const { t } = useTranslation();

  const [modalPartType, setModalPartType] = useState<"SEMI_PRODUCT" | "FINISHED">(defaultPartType);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const { options: partOptions } = usePartOptions(modalPartType);
  const warehouseType = modalPartType === 'SEMI_PRODUCT' ? 'WIP' : 'FG';
  const { options: warehouseOptions } = useWarehouseOptions(warehouseType);

  const tabs = [
    { key: "SEMI_PRODUCT" as const, label: t("productMgmt.receive.tabWip") },
    { key: "FINISHED" as const, label: t("productMgmt.receive.tabFg") },
  ];

  /** 품목유형 전환 — partId 리셋 */
  const handlePartTypeChange = useCallback((type: "SEMI_PRODUCT" | "FINISHED") => {
    setModalPartType(type);
    setForm((prev) => ({ ...prev, itemCode: "" }));
  }, []);

  /** 입고 처리 */
  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || form.qty < 1) return;
    if (modalPartType === "SEMI_PRODUCT" && !form.warehouseCode) return;
    setSaving(true);
    try {
      const endpoint =
        modalPartType === "SEMI_PRODUCT" ? "/inventory/wip/receive" : "/inventory/fg/receive";
      await api.post(endpoint, {
        itemCode: form.itemCode,
        warehouseCode: form.warehouseCode,
        qty: form.qty,
        itemType: modalPartType,
        transType: modalPartType === "SEMI_PRODUCT" ? "WIP_IN" : "FG_IN",
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
          {modalPartType === "FINISHED" ? (
            <div className="flex items-end">
              <p className="text-sm text-text-muted rounded-md border border-border bg-muted px-3 py-2 w-full">
                {t(
                  "productMgmt.receive.modal.fgAutoWarehouse",
                  "완제품은 양품창고(FG 기본창고)로 자동 입고됩니다.",
                )}
              </p>
            </div>
          ) : (
            <Select
              label={t("productMgmt.receive.modal.warehouseId")}
              options={warehouseOptions}
              value={form.warehouseCode}
              onChange={(v) => setForm({ ...form, warehouseCode: v })}
            />
          )}
          <QtyInput
            label={t("productMgmt.receive.modal.qty")}
            value={form.qty}
            onChange={(n) => setForm({ ...form, qty: n })}
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
            disabled={saving || !form.itemCode || (modalPartType === "SEMI_PRODUCT" && !form.warehouseCode)}
          >
            {saving ? t("common.saving") : t("productMgmt.receive.modal.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
