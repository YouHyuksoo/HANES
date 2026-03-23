"use client";

/**
 * @file quality/capa/components/CapaFormPanel.tsx
 * @description CAPA 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. capaType, sourceType은 ComCodeSelect 사용
 * 3. lineCode는 LineSelect 공용 컴포넌트 사용
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { LineSelect, ComCodeSelect, WorkerSelect } from "@/components/shared";
import api from "@/services/api";

interface CapaFormData {
  capaType: string;
  sourceType: string;
  title: string;
  description: string;
  itemCode: string;
  lineCode: string;
  responsibleCode: string;
  targetDate: string;
  priority: string;
}

const INIT: CapaFormData = {
  capaType: "CORRECTIVE", sourceType: "", title: "", description: "",
  itemCode: "", lineCode: "", responsibleCode: "", targetDate: "", priority: "",
};

interface Props {
  editData: { capaNo: string; [key: string]: unknown } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CapaFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<CapaFormData>(INIT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        capaType: (editData.capaType as string) ?? "CORRECTIVE",
        sourceType: (editData.sourceType as string) ?? "",
        title: (editData.title as string) ?? "",
        description: (editData.description as string) ?? "",
        itemCode: (editData.itemCode as string) ?? "",
        lineCode: (editData.lineCode as string) ?? "",
        responsibleCode: (editData.responsibleCode as string) ?? "",
        targetDate: (editData.targetDate as string)?.slice(0, 10) ?? "",
        priority: (editData.priority as string) ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof CapaFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.title || !form.capaType) return;
    setSaving(true);
    try {
      const payload = {
        capaType: form.capaType,
        sourceType: form.sourceType || undefined,
        title: form.title,
        description: form.description || undefined,
        itemCode: form.itemCode || undefined,
        lineCode: form.lineCode || undefined,
        responsibleCode: form.responsibleCode || undefined,
        targetDate: form.targetDate || undefined,
        priority: form.priority || undefined,
      };
      if (isEdit && editData) {
        await api.put(`/quality/capas/${editData.capaNo}`, payload);
      } else {
        await api.post("/quality/capas", payload);
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
          {isEdit ? t("common.edit") : t("quality.capa.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.title || !form.capaType}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* CAPA 유형 / 우선순위 */}
        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="CAPA_TYPE" includeAll={false}
            label={t("quality.capa.capaType")} value={form.capaType}
            onChange={v => setField("capaType", v)} fullWidth />
          <ComCodeSelect groupCode="CHANGE_PRIORITY" includeAll={false}
            label={t("common.priority")} value={form.priority}
            onChange={v => setField("priority", v)} fullWidth />
        </div>

        {/* 출처 유형 */}
        <ComCodeSelect groupCode="CAPA_SOURCE_TYPE" includeAll={false}
          label={t("quality.capa.sourceType")} value={form.sourceType}
          onChange={v => setField("sourceType", v)} fullWidth />

        {/* 제목 */}
        <Input label={t("quality.capa.title")} value={form.title}
          onChange={e => setField("title", e.target.value)} fullWidth />

        {/* 부적합 내용 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.capa.description")}
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900 text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={form.description}
            onChange={e => setField("description", e.target.value)}
          />
        </div>

        {/* 품목코드 / 담당자 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.capa.itemCode")} value={form.itemCode}
            onChange={e => setField("itemCode", e.target.value)} fullWidth />
          <WorkerSelect label={t("quality.capa.responsible")} value={form.responsibleCode}
            onChange={v => setField("responsibleCode", v)} fullWidth />
        </div>

        {/* 라인 / 목표완료일 */}
        <div className="grid grid-cols-2 gap-3">
          <LineSelect label={t("quality.capa.line")} value={form.lineCode}
            onChange={v => setField("lineCode", v)} fullWidth />
          <Input label={t("quality.capa.targetDate")} type="date" value={form.targetDate}
            onChange={e => setField("targetDate", e.target.value)} fullWidth />
        </div>
      </div>
    </div>
  );
}
