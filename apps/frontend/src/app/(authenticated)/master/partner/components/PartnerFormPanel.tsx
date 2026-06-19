/**
 * @file src/app/(authenticated)/master/partner/components/PartnerFormPanel.tsx
 * @description 거래처 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST /master/partners (생성), PUT /master/partners/:id (수정)
 */

"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
// X 아이콘 제거됨 — 헤더에 취소/저장 버튼 사용
import { Button, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface Partner {
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
  mode?: "create" | "edit";
  editingPartner: Partner | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export type { Partner };

const EMPTY_FORM = {
  partnerCode: "",
  partnerName: "",
  partnerType: "SUPPLIER",
  bizNo: "",
  ceoName: "",
  address: "",
  tel: "",
  fax: "",
  email: "",
  contactPerson: "",
  remark: "",
  useYn: "Y",
};

const getInitialForm = (partner: Partner | null, isEdit: boolean) => {
  if (!isEdit || !partner) return EMPTY_FORM;
  return {
    partnerCode: partner.partnerCode || "",
    partnerName: partner.partnerName || "",
    partnerType: partner.partnerType || "SUPPLIER",
    bizNo: partner.bizNo || "",
    ceoName: partner.ceoName || "",
    address: partner.address || "",
    tel: partner.tel || "",
    fax: partner.fax || "",
    email: partner.email || "",
    contactPerson: partner.contactPerson || "",
    remark: partner.remark || "",
    useYn: partner.useYn || "Y",
  };
};

export default function PartnerFormPanel({ mode, editingPartner, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";

  const [form, setForm] = useState(() => getInitialForm(editingPartner, isEdit));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(getInitialForm(editingPartner, isEdit));
  }, [editingPartner, isEdit]);

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
      if (isEdit && editingPartner?.partnerCode) {
        await api.put(`/master/partners/${editingPartner.partnerCode}`, payload);
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.partnerCode.trim() || !form.partnerName.trim()}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.partner.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.partner.partnerCode")}
              value={form.partnerCode} onChange={e => setField("partnerCode", e.target.value)}
              disabled={isEdit} fullWidth required />
            <ComCodeSelect groupCode="PARTNER_TYPE" includeAll={false}
              label={t("master.partner.partnerType")}
              value={form.partnerType} onChange={v => setField("partnerType", v)} fullWidth required />
            <div className="col-span-2">
              <Input label={t("master.partner.partnerName")}
                value={form.partnerName} onChange={e => setField("partnerName", e.target.value)} fullWidth required />
            </div>
            <Input label={t("master.partner.bizNo")}
              value={form.bizNo} onChange={e => setField("bizNo", e.target.value)} fullWidth />
            <Input label={t("master.partner.ceoName")}
              value={form.ceoName} onChange={e => setField("ceoName", e.target.value)} fullWidth />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.partner.sectionContact", "연락처")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label={t("master.partner.address")}
                value={form.address} onChange={e => setField("address", e.target.value)} fullWidth />
            </div>
            <Input label={t("master.partner.tel")}
              value={form.tel} onChange={e => setField("tel", e.target.value)} fullWidth />
            <Input label={t("master.partner.fax")}
              value={form.fax} onChange={e => setField("fax", e.target.value)} fullWidth />
            <Input label={t("master.partner.email")}
              value={form.email} onChange={e => setField("email", e.target.value)} fullWidth />
            <Input label={t("master.partner.contactPerson")}
              value={form.contactPerson} onChange={e => setField("contactPerson", e.target.value)} fullWidth />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t("common.remark")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">{t("common.useYn", "사용여부")}</label>
            <div className="flex gap-3 h-[34px] items-center">
              {[
                { v: "Y", l: "Y", cls: "text-green-600 dark:text-green-400" },
                { v: "N", l: "N", cls: "text-red-500 dark:text-red-400" },
              ].map(opt => (
                <label key={opt.v} className={`flex items-center gap-1.5 cursor-pointer text-xs ${form.useYn === opt.v ? opt.cls + " font-semibold" : "text-text-muted"}`}>
                  <input type="radio" checked={form.useYn === opt.v} onChange={() => setField("useYn", opt.v)}
                    className="w-3.5 h-3.5 accent-primary" />
                  {opt.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
