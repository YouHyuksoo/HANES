"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { WarehouseSelect, PartnerSelect, PartSearchModal, QtyInput } from "@/components/shared";
import type { PartItem } from "@/components/shared";
import api from "@/services/api";

interface ManualArrivalPanelProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  itemCode: string;
  itemName: string;
  warehouseCode: string;
  qty: string;
  supUid: string;
  manufactureDate: string;
  vendor: string;
  remark: string;
}

const INITIAL_FORM: FormState = {
  itemCode: "",
  itemName: "",
  warehouseCode: "",
  qty: "",
  supUid: "",
  manufactureDate: "",
  vendor: "",
  remark: "",
};

export default function ManualArrivalPanel({ onClose, onSuccess }: ManualArrivalPanelProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  useEffect(() => {
    setForm(INITIAL_FORM);
  }, []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePartSelect = (part: PartItem) => {
    setForm((prev) => ({ ...prev, itemCode: part.itemCode, itemName: part.itemName }));
  };

  const handleSubmit = async () => {
    if (!form.itemCode || !form.warehouseCode || !form.qty) return;
    setSubmitting(true);
    try {
      await api.post("/material/arrivals/manual", {
        itemCode: form.itemCode,
        warehouseId: form.warehouseCode,
        qty: Number(form.qty),
        supUid: form.supUid || undefined,
        manufactureDate: form.manufactureDate || undefined,
        vendor: form.vendor || undefined,
        remark: form.remark || undefined,
      });
      onSuccess();
    } catch (err) {
      console.error("수동 입하 등록 실패:", err);
    }
    setSubmitting(false);
  };

  const isValid = form.itemCode && form.warehouseCode && Number(form.qty) > 0;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* 패널 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-sm font-semibold text-text">
            {t("material.arrival.manualArrival")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 액션 버튼 — 상단 배치 (표준) */}
        <div className="flex justify-end gap-2 px-4 py-2 border-b border-border flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? t("common.processing") : t("common.save", "저장")}
          </Button>
        </div>

        {/* 폼 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 품목 */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t("common.partCode")}
            </label>
            <div className="flex gap-2">
              <Input
                value={form.itemCode ? `${form.itemCode} - ${form.itemName}` : ""}
                placeholder={t("material.arrival.selectPart")}
                readOnly
                fullWidth
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPartSearchOpen(true)}
                className="flex-shrink-0"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <WarehouseSelect
            label={t("material.arrival.col.warehouse")}
            value={form.warehouseCode}
            onChange={(v) => handleChange("warehouseCode", v)}
            fullWidth
          />

          <QtyInput
            label={t("common.quantity")}
            placeholder="0"
            value={Number(form.qty) || 0}
            onChange={(n) => handleChange("qty", n ? String(n) : "")}
            fullWidth
          />

          <Input
            label={t("common.supUid")}
            placeholder={t("material.arrival.matUidPlaceholder")}
            value={form.supUid}
            onChange={(e) => handleChange("supUid", e.target.value)}
            fullWidth
          />

          <Input
            label={t("material.arrival.col.manufactureDate")}
            type="date"
            value={form.manufactureDate}
            onChange={(e) => handleChange("manufactureDate", e.target.value)}
            fullWidth
          />

          <PartnerSelect
            partnerType="SUPPLIER"
            label={t("material.arrival.col.vendor")}
            value={form.vendor}
            onChange={(v) => handleChange("vendor", v)}
            fullWidth
          />

          <Input
            label={t("common.remark")}
            placeholder={t("material.arrival.remarkPlaceholder")}
            value={form.remark}
            onChange={(e) => handleChange("remark", e.target.value)}
            fullWidth
          />
        </div>
      </div>

      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={handlePartSelect}
      />
    </>
  );
}
