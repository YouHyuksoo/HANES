/**
 * @file src/app/(authenticated)/master/partner/components/PartnerFormPanel.tsx
 * @description 거래처 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST /master/partners (생성), PUT /master/partners/:id (수정)
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import api from "@/services/api";

interface Partner {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: string;
  bizNo?: string;
  ceoName?: string;
  address?: string;
  tel?: string;
  fax?: string;
  email?: string;
  contactPerson?: string;
  remark?: string;
  useYn: string;
}

interface Props {
  editingPartner: Partner | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export type { Partner };

export default function PartnerFormPanel({ editingPartner, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingPartner;

  const partnerTypeOptions = useMemo(() => [
    { value: "SUPPLIER", label: t("master.partner.supplier") },
    { value: "CUSTOMER", label: t("master.partner.customer") },
  ], [t]);

  const [form, setForm] = useState({
    partnerCode: editingPartner?.partnerCode || "",
    partnerName: editingPartner?.partnerName || "",
    partnerType: editingPartner?.partnerType || "SUPPLIER",
    bizNo: editingPartner?.bizNo || "",
    ceoName: editingPartner?.ceoName || "",
    address: editingPartner?.address || "",
    tel: editingPartner?.tel || "",
    fax: editingPartner?.fax || "",
    email: editingPartner?.email || "",
    contactPerson: editingPartner?.contactPerson || "",
    remark: editingPartner?.remark || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      partnerCode: editingPartner?.partnerCode || "",
      partnerName: editingPartner?.partnerName || "",
      partnerType: editingPartner?.partnerType || "SUPPLIER",
      bizNo: editingPartner?.bizNo || "",
      ceoName: editingPartner?.ceoName || "",
      address: editingPartner?.address || "",
      tel: editingPartner?.tel || "",
      fax: editingPartner?.fax || "",
      email: editingPartner?.email || "",
      contactPerson: editingPartner?.contactPerson || "",
      remark: editingPartner?.remark || "",
    });
  }, [editingPartner]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.partnerCode.trim() || !form.partnerName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        bizNo: form.bizNo || undefined,
        ceoName: form.ceoName || undefined,
        address: form.address || undefined,
        tel: form.tel || undefined,
        fax: form.fax || undefined,
        email: form.email || undefined,
        contactPerson: form.contactPerson || undefined,
        remark: form.remark || undefined,
      };
      if (isEdit && editingPartner?.id) {
        await api.put(`/master/partners/${editingPartner.id}`, payload);
      } else {
        await api.post("/master/partners", payload);
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
          {isEdit ? t("master.partner.editPartner") : t("master.partner.addPartner")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.partner.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.partner.partnerCode")} placeholder="101001"
              value={form.partnerCode} onChange={e => setField("partnerCode", e.target.value)}
              disabled={isEdit} fullWidth />
            <Select label={t("master.partner.partnerType")} options={partnerTypeOptions}
              value={form.partnerType} onChange={v => setField("partnerType", v)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.partner.partnerName")} placeholder={t("master.partner.partnerName")}
                value={form.partnerName} onChange={e => setField("partnerName", e.target.value)} fullWidth />
            </div>
            <Input label={t("master.partner.bizNo")} placeholder="123-45-67890"
              value={form.bizNo} onChange={e => setField("bizNo", e.target.value)} fullWidth />
            <Input label={t("master.partner.ceoName")} placeholder={t("master.partner.ceoName")}
              value={form.ceoName} onChange={e => setField("ceoName", e.target.value)} fullWidth />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.partner.sectionContact", "연락처")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("master.partner.address")} placeholder={t("master.partner.address")}
                value={form.address} onChange={e => setField("address", e.target.value)} fullWidth />
            </div>
            <Input label={t("master.partner.tel")} placeholder="02-1234-5678"
              value={form.tel} onChange={e => setField("tel", e.target.value)} fullWidth />
            <Input label={t("master.partner.fax")} placeholder="02-1234-5679"
              value={form.fax} onChange={e => setField("fax", e.target.value)} fullWidth />
            <Input label={t("master.partner.email")} placeholder="contact@company.com"
              value={form.email} onChange={e => setField("email", e.target.value)} fullWidth />
            <Input label={t("master.partner.contactPerson")} placeholder={t("master.partner.contactPerson")}
              value={form.contactPerson} onChange={e => setField("contactPerson", e.target.value)} fullWidth />
          </div>
        </div>

        <div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.partnerCode.trim() || !form.partnerName.trim()}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </div>
  );
}
