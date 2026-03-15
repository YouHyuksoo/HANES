"use client";

/**
 * @file quality/control-plan/components/ControlPlanFormPanel.tsx
 * @description 관리계획서 등록/수정 모달 (full 사이즈)
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. 품목코드(PartSearchModal), 단계(phase), 비고(remarks) 입력
 * 3. 하단에 ControlPlanItemList로 관리항목 편집
 * 4. api.post/put /quality/control-plans
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Modal, Button, Input, Select } from "@/components/ui";
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
  isOpen: boolean;
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

export default function ControlPlanFormPanel({ isOpen, editData, onClose, onSave }: Props) {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full"
      title={isEdit ? `${t("common.edit")} - ${t("quality.controlPlan.title")}` : t("quality.controlPlan.create")}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.itemCode}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      }>
      <div className="space-y-4 text-xs">
        {/* 기본 정보 */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              {t("quality.controlPlan.itemCode")} *
            </label>
            <div className="flex gap-2">
              <Input value={form.itemCode} readOnly fullWidth placeholder={t("quality.controlPlan.itemCode")} />
              <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Input label={t("quality.controlPlan.itemName")} value={form.itemName} readOnly fullWidth />
          <Select label={t("quality.controlPlan.phase")} value={form.phase}
            onChange={v => setField("phase", v)} fullWidth
            options={[
              { value: "PROTOTYPE", label: "Prototype" },
              { value: "PRE_LAUNCH", label: "Pre-Launch" },
              { value: "PRODUCTION", label: "Production" },
            ]} />
          {isEdit && editData ? (
            <div className="flex gap-3">
              <Input label={t("quality.controlPlan.revisionNo")}
                value={`Rev.${editData.revisionNo ?? 0}`} readOnly fullWidth />
              <Input label={t("common.status")}
                value={editData.status ?? ""} readOnly fullWidth />
            </div>
          ) : (
            <Input label={t("common.remark")} value={form.remarks}
              onChange={e => setField("remarks", e.target.value)} fullWidth />
          )}
        </div>

        {/* 비고 (수정 모드) */}
        {isEdit && (
          <Input label={t("common.remark")} value={form.remarks}
            onChange={e => setField("remarks", e.target.value)} fullWidth />
        )}

        {/* 관리항목 목록 (수정 모드에서만) */}
        {isEdit && editData && (
          <ControlPlanItemList planId={editData.id} planStatus={editData.status} />
        )}
      </div>

      {/* 품목검색 모달 */}
      <PartSearchModal isOpen={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onSelect={handlePartSelect} />
    </Modal>
  );
}
