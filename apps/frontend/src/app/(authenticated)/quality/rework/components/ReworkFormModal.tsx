"use client";

/**
 * @file src/app/(authenticated)/quality/rework/components/ReworkFormModal.tsx
 * @description 재작업 등록/수정 모달 — 품목, 수량, 불량유형, 재작업방법, 라인/설비/작업자 입력
 *
 * 초보자 가이드:
 * 1. editData가 있으면 수정 모드, 없으면 등록 모드
 * 2. 품목코드(Input), 수량, 불량유형(ComCodeSelect), 재작업방법(textarea)
 * 3. 라인(LineSelect), 설비(EquipSelect), 작업자(WorkerSelect) 공용 컴포넌트 사용
 * 4. API: POST /quality/reworks (등록), PUT /quality/reworks/:id (수정)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Modal } from "@/components/ui";
import { LineSelect, EquipSelect, WorkerSelect, ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface ReworkFormData {
  itemCode: string;
  itemName: string;
  reworkQty: string;
  defectType: string;
  reworkMethod: string;
  lineCode: string;
  equipCode: string;
  workerCode: string;
  remarks: string;
}

const INITIAL_FORM: ReworkFormData = {
  itemCode: "", itemName: "", reworkQty: "", defectType: "",
  reworkMethod: "", lineCode: "", equipCode: "", workerCode: "", remarks: "",
};

interface EditData {
  id: number;
  itemCode: string;
  itemName: string;
  reworkQty: number;
  defectType: string;
  reworkMethod: string;
  lineCode: string;
  equipCode: string;
  workerCode: string;
  remarks: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData: EditData | null;
}

export default function ReworkFormModal({ isOpen, onClose, onSuccess, editData }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ReworkFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editData;

  useEffect(() => {
    if (isOpen && editData) {
      setForm({
        itemCode: editData.itemCode ?? "",
        itemName: editData.itemName ?? "",
        reworkQty: String(editData.reworkQty ?? ""),
        defectType: editData.defectType ?? "",
        reworkMethod: editData.reworkMethod ?? "",
        lineCode: editData.lineCode ?? "",
        equipCode: editData.equipCode ?? "",
        workerCode: editData.workerCode ?? "",
        remarks: editData.remarks ?? "",
      });
    } else if (isOpen) {
      setForm(INITIAL_FORM);
    }
  }, [isOpen, editData]);

  const setField = useCallback(
    <K extends keyof ReworkFormData>(key: K, value: ReworkFormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        itemName: form.itemName,
        reworkQty: Number(form.reworkQty) || 0,
        defectType: form.defectType || undefined,
        reworkMethod: form.reworkMethod,
        lineCode: form.lineCode || undefined,
        equipCode: form.equipCode || undefined,
        workerCode: form.workerCode || undefined,
        remarks: form.remarks || undefined,
      };
      if (isEdit && editData) {
        await api.put(`/quality/reworks/${editData.id}`, payload);
      } else {
        await api.post("/quality/reworks", payload);
      }
      onSuccess();
    } catch (e) {
      console.error("Rework save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSuccess]);

  const title = isEdit ? t("quality.rework.edit") : t("quality.rework.create");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* 1행: 품목코드, 품목명 */}
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("quality.rework.itemCode")} value={form.itemCode}
            onChange={(e) => setField("itemCode", e.target.value)} fullWidth />
          <Input label={t("quality.rework.itemName")} value={form.itemName}
            onChange={(e) => setField("itemName", e.target.value)} fullWidth />
        </div>

        {/* 2행: 수량, 불량유형 */}
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("quality.rework.reworkQty")} type="number" value={form.reworkQty}
            onChange={(e) => setField("reworkQty", e.target.value)} fullWidth />
          <ComCodeSelect groupCode="DEFECT_TYPE" includeAll={false}
            label={t("quality.rework.defectType")} value={form.defectType}
            onChange={(v) => setField("defectType", v)} fullWidth />
        </div>

        {/* 3행: 라인, 설비, 작업자 */}
        <div className="grid grid-cols-3 gap-4">
          <LineSelect label={t("quality.rework.line")} value={form.lineCode}
            onChange={(v) => setField("lineCode", v)} fullWidth />
          <EquipSelect label={t("quality.rework.equip")} value={form.equipCode}
            onChange={(v) => setField("equipCode", v)} fullWidth />
          <WorkerSelect label={t("quality.rework.worker")} value={form.workerCode}
            onChange={(v) => setField("workerCode", v)} fullWidth />
        </div>

        {/* 4행: 재작업방법 */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("quality.rework.reworkMethod")}
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.reworkMethod}
            onChange={(e) => setField("reworkMethod", e.target.value)}
          />
        </div>

        {/* 5행: 비고 */}
        <Input label={t("common.remark")} value={form.remarks}
          onChange={(e) => setField("remarks", e.target.value)} fullWidth />

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !form.itemCode || !form.reworkQty}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
