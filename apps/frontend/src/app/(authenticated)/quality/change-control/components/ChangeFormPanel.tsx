"use client";

/**
 * @file quality/change-control/components/ChangeFormPanel.tsx
 * @description 변경점 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. 변경유형(ComCodeSelect), 제목, 상세내용, 사유, 위험성평가 등 입력
 * 3. api.post("/quality/changes") / api.put("/quality/changes/:id")
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface ChangeFormData {
  changeType: string;
  title: string;
  description: string;
  reason: string;
  riskAssessment: string;
  affectedItems: string;
  priority: string;
  effectiveDate: string;
}

const INIT: ChangeFormData = {
  changeType: "", title: "", description: "", reason: "",
  riskAssessment: "", affectedItems: "", priority: "MEDIUM", effectiveDate: "",
};

interface Props {
  editData: {
    changeNo: string;
    changeType: string;
    title: string;
    description: string;
    reason: string;
    riskAssessment: string;
    affectedItems: string;
    priority: string;
    effectiveDate: string;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ChangeFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<ChangeFormData>(INIT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        changeType: editData.changeType ?? "",
        title: editData.title ?? "",
        description: editData.description ?? "",
        reason: editData.reason ?? "",
        riskAssessment: editData.riskAssessment ?? "",
        affectedItems: editData.affectedItems ?? "",
        priority: editData.priority ?? "MEDIUM",
        effectiveDate: editData.effectiveDate?.slice(0, 10) ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof ChangeFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.changeType || !form.title) return;
    setSaving(true);
    try {
      const payload = {
        changeType: form.changeType,
        title: form.title,
        description: form.description || undefined,
        reason: form.reason || undefined,
        riskAssessment: form.riskAssessment || undefined,
        affectedItems: form.affectedItems || undefined,
        priority: form.priority,
        effectiveDate: form.effectiveDate || undefined,
      };
      if (isEdit && editData) {
        await api.put(`/quality/changes/${editData.changeNo}`, payload);
      } else {
        await api.post("/quality/changes", payload);
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
          {isEdit ? t("common.edit") : t("quality.change.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.changeType || !form.title}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 변경유형 / 우선순위 */}
        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="CHANGE_TYPE" includeAll={false}
            label={t("quality.change.changeType")} value={form.changeType}
            onChange={v => setField("changeType", v)} fullWidth />
          <ComCodeSelect groupCode="CHANGE_PRIORITY" includeAll={false}
            label={t("quality.change.priority")} value={form.priority}
            onChange={v => setField("priority", v)} fullWidth />
        </div>

        {/* 제목 */}
        <Input label={t("common.title")} value={form.title}
          onChange={e => setField("title", e.target.value)} fullWidth />

        {/* 변경내용 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.change.description")}
          </label>
          <textarea className="w-full rounded-md border border-border bg-white dark:bg-slate-900
            text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2
            focus:ring-primary/30 focus:border-primary"
            value={form.description}
            onChange={e => setField("description", e.target.value)} />
        </div>

        {/* 변경사유 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.change.reason")}
          </label>
          <textarea className="w-full rounded-md border border-border bg-white dark:bg-slate-900
            text-text px-3 py-2 text-xs min-h-[60px] focus:outline-none focus:ring-2
            focus:ring-primary/30 focus:border-primary"
            value={form.reason}
            onChange={e => setField("reason", e.target.value)} />
        </div>

        {/* 위험성평가 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.change.riskAssessment")}
          </label>
          <textarea className="w-full rounded-md border border-border bg-white dark:bg-slate-900
            text-text px-3 py-2 text-xs min-h-[60px] focus:outline-none focus:ring-2
            focus:ring-primary/30 focus:border-primary"
            value={form.riskAssessment}
            onChange={e => setField("riskAssessment", e.target.value)} />
        </div>

        {/* 영향품목 */}
        <Input label={t("quality.change.affectedItems")} value={form.affectedItems}
          onChange={e => setField("affectedItems", e.target.value)} fullWidth />

        {/* 시행일 */}
        <Input label={t("quality.change.effectiveDate")} type="date"
          value={form.effectiveDate}
          onChange={e => setField("effectiveDate", e.target.value)} fullWidth />
      </div>
    </div>
  );
}
