"use client";

/**
 * @file src/components/consumables/ConsumableMasterModal.tsx
 * @description 소모품 마스터 등록/수정 모달
 *
 * 초보자 가이드:
 * 1. **등록 모드**: item이 null이면 새 소모품 등록
 * 2. **수정 모드**: item이 전달되면 기존 데이터 수정
 * 3. **API**: POST /consumables (등록), PUT /consumables/:id (수정)
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal, Select } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";

export interface ConsumableItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  expectedLife: number | null;
  currentCount: number;
  warningCount: number | null;
  stockQty: number;
  safetyStock: number;
  location: string | null;
  vendor: string | null;
  unitPrice: number | null;
  status: string;
  useYn: string;
}

export interface ConsumableFormValues {
  consumableCode: string;
  consumableName: string;
  category: string;
  expectedLife: number | null;
  warningCount: number | null;
  location: string;
  vendor: string;
  unitPrice: number | null;
  safetyStock: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ConsumableFormValues) => void;
  item: ConsumableItem | null;
  loading?: boolean;
}

const EMPTY: ConsumableFormValues = {
  consumableCode: "",
  consumableName: "",
  category: "MOLD",
  expectedLife: null,
  warningCount: null,
  location: "",
  vendor: "",
  unitPrice: null,
  safetyStock: 0,
};

export default function ConsumableMasterModal({ isOpen, onClose, onSubmit, item, loading }: Props) {
  const { t } = useTranslation();
  const categoryOptions = useComCodeOptions("CONSUMABLE_CATEGORY");
  const [form, setForm] = useState<ConsumableFormValues>(EMPTY);

  useEffect(() => {
    if (isOpen) {
      setForm(
        item
          ? {
              consumableCode: item.consumableCode,
              consumableName: item.consumableName,
              category: item.category || "MOLD",
              expectedLife: item.expectedLife,
              warningCount: item.warningCount,
              location: item.location || "",
              vendor: item.vendor || "",
              unitPrice: item.unitPrice,
              safetyStock: item.safetyStock || 0,
            }
          : EMPTY,
      );
    }
  }, [isOpen, item]);

  const set = (k: keyof ConsumableFormValues, v: string | number | null) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.consumableCode || !form.consumableName) return;
    onSubmit(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? t("consumables.master.editConsumable") : t("consumables.master.register")}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t("consumables.master.code")}
          placeholder="CM-AP-110"
          value={form.consumableCode}
          onChange={(e) => set("consumableCode", e.target.value)}
          disabled={!!item}
          fullWidth
        />
        <Select
          label={t("consumables.master.category")}
          options={categoryOptions}
          value={form.category}
          onChange={(v) => set("category", v)}
          fullWidth
        />
        <Input
          label={t("consumables.master.name")}
          placeholder="110단자 압착금형"
          value={form.consumableName}
          onChange={(e) => set("consumableName", e.target.value)}
          fullWidth
          className="col-span-2"
        />
        <Input
          label={t("consumables.master.expectedLifeCount")}
          type="number"
          placeholder="100000"
          value={form.expectedLife?.toString() ?? ""}
          onChange={(e) => set("expectedLife", e.target.value ? Number(e.target.value) : null)}
          fullWidth
        />
        <Input
          label={t("consumables.master.warningThreshold")}
          type="number"
          placeholder="80000"
          value={form.warningCount?.toString() ?? ""}
          onChange={(e) => set("warningCount", e.target.value ? Number(e.target.value) : null)}
          fullWidth
        />
        <Input
          label={t("consumables.master.location")}
          placeholder="금형실-A1"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          fullWidth
        />
        <Input
          label={t("consumables.master.vendor")}
          placeholder="JST"
          value={form.vendor}
          onChange={(e) => set("vendor", e.target.value)}
          fullWidth
        />
        <Input
          label={t("consumables.master.unitPrice", "단가")}
          type="number"
          placeholder="750000"
          value={form.unitPrice?.toString() ?? ""}
          onChange={(e) => set("unitPrice", e.target.value ? Number(e.target.value) : null)}
          fullWidth
        />
        <Input
          label={t("consumables.master.safetyStock", "안전재고")}
          type="number"
          placeholder="1"
          value={form.safetyStock.toString()}
          onChange={(e) => set("safetyStock", Number(e.target.value) || 0)}
          fullWidth
        />
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !form.consumableCode || !form.consumableName}>
          {item ? t("common.edit") : t("common.register")}
        </Button>
      </div>
    </Modal>
  );
}
