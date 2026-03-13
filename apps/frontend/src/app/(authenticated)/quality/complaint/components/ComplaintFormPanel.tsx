"use client";

/**
 * @file quality/complaint/components/ComplaintFormPanel.tsx
 * @description 고객클레임 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. 기본 필드: 고객, 접수일, 품목, LOT, 수량, 유형, 긴급도, 내용
 * 3. 조사/대응 필드는 상태 전환 시 별도 API로 처리
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface ComplaintFormData {
  customerCode: string;
  customerName: string;
  complaintDate: string;
  itemCode: string;
  lotNo: string;
  defectQty: string;
  complaintType: string;
  urgency: string;
  description: string;
  responsibleCode: string;
  costAmount: string;
}

const INIT: ComplaintFormData = {
  customerCode: "", customerName: "", complaintDate: new Date().toISOString().slice(0, 10),
  itemCode: "", lotNo: "", defectQty: "", complaintType: "", urgency: "MEDIUM",
  description: "", responsibleCode: "", costAmount: "",
};

interface Props {
  editData: {
    id: number; customerCode: string; customerName: string; complaintDate: string;
    itemCode: string; lotNo: string; defectQty: number; complaintType: string;
    urgency: string; description: string; responsibleCode: string; costAmount: number | null;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ComplaintFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<ComplaintFormData>(INIT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        customerCode: editData.customerCode ?? "",
        customerName: editData.customerName ?? "",
        complaintDate: (editData.complaintDate ?? "").slice(0, 10),
        itemCode: editData.itemCode ?? "",
        lotNo: editData.lotNo ?? "",
        defectQty: String(editData.defectQty ?? ""),
        complaintType: editData.complaintType ?? "",
        urgency: editData.urgency ?? "MEDIUM",
        description: editData.description ?? "",
        responsibleCode: editData.responsibleCode ?? "",
        costAmount: editData.costAmount != null ? String(editData.costAmount) : "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof ComplaintFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.customerCode || !form.complaintType) return;
    setSaving(true);
    try {
      const payload = {
        customerCode: form.customerCode,
        customerName: form.customerName || undefined,
        complaintDate: form.complaintDate,
        itemCode: form.itemCode || undefined,
        lotNo: form.lotNo || undefined,
        defectQty: form.defectQty ? Number(form.defectQty) : undefined,
        complaintType: form.complaintType,
        urgency: form.urgency || undefined,
        description: form.description || undefined,
        responsibleCode: form.responsibleCode || undefined,
        costAmount: form.costAmount ? Number(form.costAmount) : undefined,
      };
      if (isEdit && editData) {
        await api.put(`/quality/complaints/${editData.id}`, payload);
      } else {
        await api.post("/quality/complaints", payload);
      }
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSave, onClose]);

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("common.edit") : t("quality.complaint.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.customerCode || !form.complaintType}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 고객 정보 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.complaint.customerCode")} value={form.customerCode}
            onChange={e => setField("customerCode", e.target.value)} fullWidth required />
          <Input label={t("quality.complaint.customerName")} value={form.customerName}
            onChange={e => setField("customerName", e.target.value)} fullWidth />
        </div>

        {/* 접수일 + 긴급도 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.complaint.complaintDate")} type="date" value={form.complaintDate}
            onChange={e => setField("complaintDate", e.target.value)} fullWidth required />
          <ComCodeSelect groupCode="COMPLAINT_URGENCY" includeAll={false}
            label={t("quality.complaint.urgency")} value={form.urgency}
            onChange={v => setField("urgency", v)} fullWidth />
        </div>

        {/* 클레임 유형 */}
        <ComCodeSelect groupCode="COMPLAINT_TYPE" includeAll={false}
          label={t("quality.complaint.complaintType")} value={form.complaintType}
          onChange={v => setField("complaintType", v)} fullWidth required />

        {/* 품목 / LOT */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("master.bom.itemCode")} value={form.itemCode}
            onChange={e => setField("itemCode", e.target.value)} fullWidth />
          <Input label="LOT No." value={form.lotNo}
            onChange={e => setField("lotNo", e.target.value)} fullWidth />
        </div>

        {/* 수량 / 비용 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.complaint.defectQty")} type="number" value={form.defectQty}
            onChange={e => setField("defectQty", e.target.value)} fullWidth />
          <Input label={t("quality.complaint.costAmount")} type="number" value={form.costAmount}
            onChange={e => setField("costAmount", e.target.value)} fullWidth />
        </div>

        {/* 담당자 */}
        <Input label={t("common.manager")} value={form.responsibleCode}
          onChange={e => setField("responsibleCode", e.target.value)} fullWidth />

        {/* 클레임 내용 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.complaint.description")}
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-xs min-h-[100px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.description}
            onChange={e => setField("description", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
