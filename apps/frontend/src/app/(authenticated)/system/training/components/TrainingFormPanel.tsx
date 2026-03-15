"use client";

/**
 * @file system/training/components/TrainingFormPanel.tsx
 * @description 교육 계획 등록/수정 모달
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정 모드
 * 2. trainingType, targetRole은 ComCodeSelect로 공통코드 선택
 * 3. status는 읽기 전용으로 ComCodeBadge 표시
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, ComCodeBadge, Modal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

/** 교육 계획 폼 데이터 */
interface TrainingFormData {
  title: string;
  trainingType: string;
  targetRole: string;
  instructor: string;
  scheduledDate: string;
  duration: string;
  maxParticipants: string;
  description: string;
}

const INIT: TrainingFormData = {
  title: "", trainingType: "", targetRole: "", instructor: "",
  scheduledDate: "", duration: "", maxParticipants: "", description: "",
};

/** 수정 시 전달되는 편집 데이터 */
export interface TrainingEditData {
  planNo: string;
  title: string;
  trainingType: string;
  targetRole: string;
  instructor: string;
  scheduledDate: string;
  duration: number;
  maxParticipants: number;
  status: string;
  description: string;
}

interface Props {
  isOpen: boolean;
  editData: TrainingEditData | null;
  onClose: () => void;
  onSave: () => void;
}

export default function TrainingFormPanel({ isOpen, editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<TrainingFormData>(INIT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        title: editData.title ?? "",
        trainingType: editData.trainingType ?? "",
        targetRole: editData.targetRole ?? "",
        instructor: editData.instructor ?? "",
        scheduledDate: editData.scheduledDate?.slice(0, 10) ?? "",
        duration: String(editData.duration ?? ""),
        maxParticipants: String(editData.maxParticipants ?? ""),
        description: editData.description ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof TrainingFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.title || !form.trainingType) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        trainingType: form.trainingType,
        targetRole: form.targetRole || undefined,
        instructor: form.instructor || undefined,
        scheduledDate: form.scheduledDate || undefined,
        duration: Number(form.duration) || undefined,
        maxParticipants: Number(form.maxParticipants) || undefined,
        description: form.description || undefined,
      };
      if (isEdit && editData) {
        await api.put(`/system/trainings/${editData.planNo}`, payload);
      } else {
        await api.post("/system/trainings", payload);
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg"
      title={isEdit ? `${t("common.edit")} - ${t("system.training.title")}` : t("system.training.create")}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave}
            disabled={saving || !form.title || !form.trainingType}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }>
      <div className="space-y-4 text-xs">
        {/* 상태 표시 (수정 시) */}
        {isEdit && editData?.status && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">{t("common.status")}:</span>
            <ComCodeBadge groupCode="TRAINING_STATUS" code={editData.status} />
          </div>
        )}

        <Input label={t("system.training.planTitle")} value={form.title}
          onChange={e => setField("title", e.target.value)}
          placeholder={t("system.training.planTitle")} fullWidth />

        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="TRAINING_TYPE" includeAll={false}
            label={t("system.training.trainingType")} value={form.trainingType}
            onChange={v => setField("trainingType", v)} fullWidth />
          <ComCodeSelect groupCode="TARGET_ROLE" includeAll={false}
            label={t("system.training.targetRole")} value={form.targetRole}
            onChange={v => setField("targetRole", v)} fullWidth />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t("system.training.instructor")} value={form.instructor}
            onChange={e => setField("instructor", e.target.value)} fullWidth />
          <Input label={t("system.training.scheduledDate")} type="date"
            value={form.scheduledDate}
            onChange={e => setField("scheduledDate", e.target.value)} fullWidth />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t("system.training.duration")} type="number"
            value={form.duration}
            onChange={e => setField("duration", e.target.value)}
            placeholder={t("system.training.hours")} fullWidth />
          <Input label={t("system.training.maxParticipants")} type="number"
            value={form.maxParticipants}
            onChange={e => setField("maxParticipants", e.target.value)} fullWidth />
        </div>

        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("common.description")}
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
    </Modal>
  );
}
