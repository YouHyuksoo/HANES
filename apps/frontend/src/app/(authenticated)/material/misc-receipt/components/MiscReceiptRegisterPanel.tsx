"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ComCodeSelect, QtyInput } from "@/components/shared";
import PartSearchModal, { type PartItem } from "@/components/shared/PartSearchModal";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface MiscReceiptRegisterPanelProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  warehouseCode: string;
  itemCode: string;
  itemName: string;
  qty: string;
  remark: string;
  account: string;
}

const INITIAL_FORM: FormState = {
  warehouseCode: "",
  itemCode: "",
  itemName: "",
  qty: "",
  remark: "",
  account: "PROD",
};

export default function MiscReceiptRegisterPanel({ onClose, onSuccess }: MiscReceiptRegisterPanelProps) {
  const { t } = useTranslation();
  const { options: warehouseOpts } = useWarehouseOptions();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);

  const warehouseOptions = useMemo(() => [
    { value: "", label: t("common.select") },
    ...warehouseOpts,
  ], [t, warehouseOpts]);

  const handleSelectPart = useCallback((part: PartItem) => {
    setForm((prev) => ({ ...prev, itemCode: part.itemCode, itemName: part.itemName }));
    setPartModalOpen(false);
  }, []);

  const handleRegister = useCallback(async () => {
    if (!form.warehouseCode || !form.itemCode || !form.qty || Number(form.qty) <= 0) return;
    setSaving(true);
    try {
      await api.post("/material/misc-receipt", {
        warehouseId: form.warehouseCode,
        itemCode: form.itemCode,
        qty: Number(form.qty),
        remark: form.remark,
        account: form.account || "PROD",
      });
      onSuccess();
    } catch (e) {
      console.error("Misc receipt failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, onSuccess]);

  const isValid = !!form.warehouseCode && !!form.itemCode && Number(form.qty) > 0;

  return (
    <>
    <div className="w-[480px] flex-shrink-0 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {t("material.miscReceipt.register")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={handleRegister} disabled={saving || !isValid}>
            {saving ? t("common.saving") : t("material.miscReceipt.register")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t("material.miscReceipt.warehouse")}
            options={warehouseOptions}
            value={form.warehouseCode}
            onChange={(v) => setForm((prev) => ({ ...prev, warehouseCode: v }))}
            fullWidth
          />
          <ComCodeSelect groupCode="RECEIPT_ACCOUNT" includeAll={false}
            label={t("material.miscReceipt.account", "입고계정")}
            value={form.account}
            onChange={(v) => setForm((prev) => ({ ...prev, account: v }))}
            fullWidth
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("material.miscReceipt.partSearch")}
          </label>
          <div className="flex gap-2">
            <Input
              placeholder={t("material.miscReceipt.partSearchPlaceholder")}
              value={form.itemCode ? `${form.itemCode} - ${form.itemName}` : ""}
              readOnly
              fullWidth
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPartModalOpen(true)}
              aria-label={t("material.miscReceipt.partSearch")}
              title={t("material.miscReceipt.partSearch")}
              className="flex-shrink-0"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <QtyInput
            label={t("material.miscReceipt.qty")}
            placeholder="0"
            value={Number(form.qty) || 0}
            onChange={(n) => setForm((prev) => ({ ...prev, qty: n ? String(n) : "" }))}
            fullWidth
          />
          <Input
            label={t("material.miscReceipt.remark")}
            placeholder={t("material.miscReceipt.remarkPlaceholder")}
            value={form.remark}
            onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
            fullWidth
          />
        </div>
      </div>
    </div>
    <PartSearchModal
      isOpen={partModalOpen}
      onClose={() => setPartModalOpen(false)}
      onSelect={handleSelectPart}
    />
    </>
  );
}
