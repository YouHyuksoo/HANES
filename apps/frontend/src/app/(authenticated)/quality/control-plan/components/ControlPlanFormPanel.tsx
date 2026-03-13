"use client";

/**
 * @file quality/control-plan/components/ControlPlanFormPanel.tsx
 * @description 관리계획서 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. 품목코드(PartSearchModal), 단계(phase), 비고(remarks) 입력
 * 3. 하단에 ControlPlanItemList로 관리항목 편집
 * 4. api.post/put /quality/control-plans
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PartSearchModal } from "@/components/shared";
import type { PartItem } from "@/components/shared";
import api from "@/services/api";
import ControlPlanItemList from "./ControlPlanItemList";

/** 폼 데이터 */
interface FormData {
  itemCode: string;
  itemName: string;
  phase: string;
  remarks: string;
}

const INIT: FormData = { itemCode: "", itemName: "", phase: "PROTOTYPE", remarks: "" };

interface Props {
  editData: {
    id: number;
    itemCode: string;
    itemName: string;
    phase: string;
    revisionNo: number;
    status: string;
    [key: string]: unknown;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ControlPlanFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<FormData>(INIT);
  const [saving, setSaving] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        itemCode: editData.itemCode ?? "",
        itemName: editData.itemName ?? "",
        phase: editData.phase ?? "PROTOTYPE",
        remarks: (editData.remarks as string) ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handlePartSelect = (part: PartItem) => {
    setForm(prev => ({ ...prev, itemCode: part.itemCode, itemName: part.itemName }));
    setPartModalOpen(false);
  };

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.phase) return;
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        itemName: form.itemName || undefined,
        phase: form.phase,
        remarks: form.remarks || undefined,
      };
      if (isEdit && editData) {
        await api.put(`/quality/control-plans/${editData.id}`, payload);
      } else {
        await api.post("/quality/control-plans", payload);
      }
      onSave();
      onClose();
    } catch {
      /* api 인터셉터 */
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSave, onClose]);

  /** 단계 옵션 */
  const phaseOptions = [
    { value: "PROTOTYPE", label: "Prototype" },
    { value: "PRE_LAUNCH", label: "Pre-Launch" },
    { value: "PRODUCTION", label: "Production" },
  ];

  return (
    <div className="w-[560px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("common.edit") : t("quality.controlPlan.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />{t("common.cancel")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.itemCode}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 품목코드 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.controlPlan.itemCode")}
          </label>
          <div className="flex gap-2">
            <Input value={form.itemCode} readOnly fullWidth placeholder={t("quality.controlPlan.itemCode")} />
            <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 품목명 (읽기전용) */}
        {form.itemName && (
          <Input label={t("quality.controlPlan.itemName")} value={form.itemName} readOnly fullWidth />
        )}

        {/* 단계 / 개정번호 / 상태 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              {t("quality.controlPlan.phase")}
            </label>
            <select value={form.phase} onChange={e => setField("phase", e.target.value)}
              className="w-full rounded-md border border-border bg-white dark:bg-slate-900
                text-text px-3 py-2 text-xs focus:outline-none focus:ring-2
                focus:ring-primary/30 focus:border-primary">
              {phaseOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {isEdit && (
            <>
              <Input label={t("quality.controlPlan.revisionNo")}
                value={`Rev.${editData?.revisionNo ?? 0}`} readOnly fullWidth />
              <Input label={t("common.status")}
                value={editData?.status ?? ""} readOnly fullWidth />
            </>
          )}
        </div>

        {/* 비고 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("common.remark")}
          </label>
          <textarea className="w-full rounded-md border border-border bg-white dark:bg-slate-900
            text-text px-3 py-2 text-xs min-h-[60px] focus:outline-none focus:ring-2
            focus:ring-primary/30 focus:border-primary"
            value={form.remarks}
            onChange={e => setField("remarks", e.target.value)} />
        </div>

        {/* 관리항목 목록 (수정 모드에서만) */}
        {isEdit && editData && (
          <ControlPlanItemList planId={editData.id} planStatus={editData.status} />
        )}
      </div>

      {/* 품목검색 모달 */}
      <PartSearchModal isOpen={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onSelect={handlePartSelect} />
    </div>
  );
}
