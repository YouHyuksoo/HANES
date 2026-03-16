"use client";

/**
 * @file src/app/(authenticated)/material/arrival/components/ManualArrivalModal.tsx
 * @description 수동 입하 등록 모달 - PO 없이 직접 품목/수량 지정
 *
 * 초보자 가이드:
 * 1. **품목 선택**: PartSearchModal로 품목코드 검색/선택
 * 2. **창고 선택**: WarehouseSelect 공유 컴포넌트 사용
 * 3. **공급업체**: PartnerSelect(SUPPLIER)로 선택
 * 4. **LOT 번호**: 미입력 시 서버에서 자동 생성
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Modal, Button, Input } from "@/components/ui";
import { WarehouseSelect, PartnerSelect, PartSearchModal } from "@/components/shared";
import type { PartItem } from "@/components/shared";
import api from "@/services/api";

interface ManualArrivalModalProps {
  isOpen: boolean;
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

export default function ManualArrivalModal({ isOpen, onClose, onSuccess }: ManualArrivalModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(INITIAL_FORM);
  }, [isOpen]);

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
        warehouseCode: form.warehouseCode,
        qty: Number(form.qty),
        supUid: form.supUid || undefined,
        manufactureDate: form.manufactureDate || undefined,
        vendor: form.vendor || undefined,
        remark: form.remark || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error("수동 입하 등록 실패:", err);
    }
    setSubmitting(false);
  };

  const isValid = form.itemCode && form.warehouseCode && Number(form.qty) > 0;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t("material.arrival.manualArrival")} size="xl">
        <div className="space-y-4">
          {/* 품목코드 — PartSearchModal로 선택 */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("common.partCode")}</label>
            <div className="flex gap-2">
              <Input
                value={form.itemCode ? `${form.itemCode} - ${form.itemName}` : ""}
                placeholder={t("material.arrival.selectPart")}
                readOnly
                fullWidth
              />
              <Button variant="secondary" onClick={() => setPartSearchOpen(true)} className="flex-shrink-0">
                <Search className="w-4 h-4 mr-1" />{t("common.search")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <WarehouseSelect
              label={t("material.arrival.col.warehouse")}
              value={form.warehouseCode}
              onChange={(v) => handleChange("warehouseCode", v)}
              fullWidth
            />
            <Input
              label={t("common.quantity")}
              type="number"
              min={1}
              placeholder="0"
              value={form.qty}
              onChange={(e) => handleChange("qty", e.target.value)}
              fullWidth
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

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

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!isValid || submitting}>
              {submitting ? t("common.processing") : t("common.register")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 품목 검색 모달 */}
      <PartSearchModal
        isOpen={partSearchOpen}
        onClose={() => setPartSearchOpen(false)}
        onSelect={handlePartSelect}
      />
    </>
  );
}
