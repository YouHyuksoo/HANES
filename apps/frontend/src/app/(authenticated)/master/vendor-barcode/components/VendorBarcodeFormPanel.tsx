/**
 * @file src/app/(authenticated)/master/vendor-barcode/components/VendorBarcodeFormPanel.tsx
 * @description 제조사 바코드 매핑 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST/PUT /master/vendor-barcode-mappings
 */

"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import api from "@/services/api";

interface VendorBarcodeMapping {
  id: string;
  vendorBarcode: string;
  itemCode: string | null;
  itemName: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  mappingRule: string | null;
  matchType: string;
  remark: string | null;
  useYn: string;
}

interface Props {
  editingItem: VendorBarcodeMapping | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const MATCH_TYPE_OPTIONS = [
  { value: "EXACT", label: "정확 일치" },
  { value: "PREFIX", label: "접두사" },
  { value: "REGEX", label: "정규식" },
];

export type { VendorBarcodeMapping };

export default function VendorBarcodeFormPanel({ editingItem, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingItem;

  const [form, setForm] = useState({
    vendorBarcode: editingItem?.vendorBarcode || "",
    itemCode: editingItem?.itemCode || "",
    itemName: editingItem?.itemName || "",
    vendorCode: editingItem?.vendorCode || "",
    vendorName: editingItem?.vendorName || "",
    matchType: editingItem?.matchType || "EXACT",
    mappingRule: editingItem?.mappingRule || "",
    remark: editingItem?.remark || "",
    useYn: editingItem?.useYn || "Y",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      vendorBarcode: editingItem?.vendorBarcode || "",
      itemCode: editingItem?.itemCode || "",
      itemName: editingItem?.itemName || "",
      vendorCode: editingItem?.vendorCode || "",
      vendorName: editingItem?.vendorName || "",
      matchType: editingItem?.matchType || "EXACT",
      mappingRule: editingItem?.mappingRule || "",
      remark: editingItem?.remark || "",
      useYn: editingItem?.useYn || "Y",
    });
  }, [editingItem]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.vendorBarcode.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/master/vendor-barcode-mappings/${editingItem.id}`, form);
      } else {
        await api.post("/master/vendor-barcode-mappings", form);
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
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? 'animate-slide-in-right' : ''}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.vendorBarcode.editMapping", "매핑 수정") : t("master.vendorBarcode.addMapping", "매핑 추가")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.vendorBarcode.sectionBarcode", "바코드 정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("master.vendorBarcode.vendorBarcode", "제조사 바코드")} placeholder="JST-SVH-21T-P1.1"
                value={form.vendorBarcode} onChange={e => setField("vendorBarcode", e.target.value)} fullWidth />
            </div>
            <Select label={t("master.vendorBarcode.matchType", "매칭 유형")} options={MATCH_TYPE_OPTIONS}
              value={form.matchType} onChange={v => setField("matchType", v)} fullWidth />
            <Select label={t("master.vendorBarcode.useYn", "사용여부")}
              options={[{ value: "Y", label: "Y" }, { value: "N", label: "N" }]}
              value={form.useYn} onChange={v => setField("useYn", v)} fullWidth />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.vendorBarcode.sectionPart", "품목 매핑")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.vendorBarcode.partCode", "품번")}
              value={form.itemCode} onChange={e => setField("itemCode", e.target.value)} fullWidth />
            <Input label={t("master.vendorBarcode.partName", "품명")}
              value={form.itemName} onChange={e => setField("itemName", e.target.value)} fullWidth />
            <Input label={t("master.vendorBarcode.vendorCode", "제조사 코드")}
              value={form.vendorCode} onChange={e => setField("vendorCode", e.target.value)} fullWidth />
            <Input label={t("master.vendorBarcode.vendorName", "제조사명")}
              value={form.vendorName} onChange={e => setField("vendorName", e.target.value)} fullWidth />
          </div>
        </div>

        <div>
          <Input label={t("master.vendorBarcode.mappingRule", "매핑 규칙")} placeholder="예: 접두사 JST- → JST 계열 부품"
            value={form.mappingRule} onChange={e => setField("mappingRule", e.target.value)} fullWidth />
        </div>

        <div>
          <Input label={t("common.remark")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.vendorBarcode.trim()}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </div>
  );
}
