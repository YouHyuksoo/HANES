/**
 * @file src/app/(authenticated)/master/partner/components/PartnerFormPanel.tsx
 * @description 거래처 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST /master/partners (생성), PUT /master/partners/:id (수정)
 */

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
// X 아이콘 제거됨 — 헤더에 취소/저장 버튼 사용
import { Button } from "@/components/ui";
import api from "@/services/api";
import { FieldInput, FieldComCodeSelect, FieldYnRadio } from "./PartnerFieldHelp";

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
  /** 작성 중(저장 안 됨) 여부를 부모에 보고 — 행 전환 시 유실 방어용 */
  onDirtyChange?: (dirty: boolean) => void;
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

export default function PartnerFormPanel({ mode, editingPartner, onClose, onSave, animate = true, onDirtyChange }: Props) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";

  const [form, setForm] = useState(() => getInitialForm(editingPartner, isEdit));
  const initialFormRef = useRef(form);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = getInitialForm(editingPartner, isEdit);
    setForm(init);
    initialFormRef.current = init;
  }, [editingPartner, isEdit]);

  // 작성 중(저장 안 됨) 여부 계산 후 부모에 보고 — 행 전환 시 유실 방어
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form],
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

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
      onDirtyChange?.(false);
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
            {saving ? t("common.saving") : t("common.save", "저장")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.partner.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput field="partnerCode" label={t("master.partner.partnerCode")}
              value={form.partnerCode} onChange={e => setField("partnerCode", e.target.value)}
              disabled={isEdit} required />
            <FieldComCodeSelect field="partnerType" groupCode="PARTNER_TYPE" includeAll={false}
              label={t("master.partner.partnerType")}
              value={form.partnerType} onChange={v => setField("partnerType", v)} required />
            <FieldInput field="partnerName" label={t("master.partner.partnerName")}
              wrapperClassName="col-span-2"
              value={form.partnerName} onChange={e => setField("partnerName", e.target.value)} required />
            <FieldInput field="bizNo" label={t("master.partner.bizNo")}
              value={form.bizNo} onChange={e => setField("bizNo", e.target.value)} />
            <FieldInput field="ceoName" label={t("master.partner.ceoName")}
              value={form.ceoName} onChange={e => setField("ceoName", e.target.value)} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.partner.sectionContact", "연락처")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput field="address" label={t("master.partner.address")}
              wrapperClassName="col-span-2"
              value={form.address} onChange={e => setField("address", e.target.value)} />
            <FieldInput field="tel" label={t("master.partner.tel")}
              value={form.tel} onChange={e => setField("tel", e.target.value)} />
            <FieldInput field="fax" label={t("master.partner.fax")}
              value={form.fax} onChange={e => setField("fax", e.target.value)} />
            <FieldInput field="email" label={t("master.partner.email")}
              value={form.email} onChange={e => setField("email", e.target.value)} />
            <FieldInput field="contactPerson" label={t("master.partner.contactPerson")}
              value={form.contactPerson} onChange={e => setField("contactPerson", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldInput field="remark" label={t("common.remark")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} />
          <FieldYnRadio field="useYn" label={t("common.useYn", "사용여부")}
            value={form.useYn} onChange={v => setField("useYn", v)} />
        </div>
      </div>

    </div>
  );
}
