"use client";

/**
 * @file quality/msa/components/GaugeFormPanel.tsx
 * @description 계측기 마스터 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. 계측기유형(ComCodeSelect), 제조사, 모델, 시리얼번호 등 입력
 * 3. lastCalibrationDate, nextCalibrationDate는 읽기전용
 * 4. api.post("/quality/msa/gauges") / api.patch("/quality/msa/gauges/:id")
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

/** 폼 데이터 타입 */
interface GaugeFormData {
  gaugeCode: string;
  gaugeName: string;
  gaugeType: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  resolution: string;
  measureRange: string;
  calibrationCycle: number;
  location: string;
  responsiblePerson: string;
}

const INIT: GaugeFormData = {
  gaugeCode: "", gaugeName: "", gaugeType: "", manufacturer: "",
  model: "", serialNo: "", resolution: "", measureRange: "",
  calibrationCycle: 12, location: "", responsiblePerson: "",
};

interface Props {
  editData: {
    gaugeCode: string;
    gaugeName: string;
    gaugeType: string;
    manufacturer: string;
    model: string;
    serialNo: string;
    resolution: string;
    measureRange: string;
    calibrationCycle: number;
    location: string;
    responsiblePerson: string;
    lastCalibrationDate?: string;
    nextCalibrationDate?: string;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function GaugeFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<GaugeFormData>(INIT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        gaugeCode: editData.gaugeCode ?? "",
        gaugeName: editData.gaugeName ?? "",
        gaugeType: editData.gaugeType ?? "",
        manufacturer: editData.manufacturer ?? "",
        model: editData.model ?? "",
        serialNo: editData.serialNo ?? "",
        resolution: editData.resolution ?? "",
        measureRange: editData.measureRange ?? "",
        calibrationCycle: editData.calibrationCycle ?? 12,
        location: editData.location ?? "",
        responsiblePerson: editData.responsiblePerson ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof GaugeFormData, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = useCallback(async () => {
    if (!form.gaugeCode || !form.gaugeName) return;
    setSaving(true);
    try {
      const payload = { ...form, calibrationCycle: Number(form.calibrationCycle) || 12 };
      if (isEdit && editData) {
        await api.patch(`/quality/msa/gauges/${editData.gaugeCode}`, payload);
      } else {
        await api.post("/quality/msa/gauges", payload);
      }
      onSave();
      onClose();
    } catch { /* api 인터셉터에서 처리 */ } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSave, onClose]);

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("common.edit") : t("common.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.gaugeCode || !form.gaugeName}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 계측기코드 / 계측기명 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.msa.gaugeCode")} value={form.gaugeCode}
            onChange={e => setField("gaugeCode", e.target.value)} fullWidth disabled={isEdit} />
          <Input label={t("quality.msa.gaugeName")} value={form.gaugeName}
            onChange={e => setField("gaugeName", e.target.value)} fullWidth />
        </div>

        {/* 계측기유형 */}
        <ComCodeSelect groupCode="GAUGE_TYPE" includeAll={false}
          label={t("quality.msa.gaugeType")} value={form.gaugeType}
          onChange={v => setField("gaugeType", v)} fullWidth />

        {/* 제조사 / 모델 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.msa.manufacturer")} value={form.manufacturer}
            onChange={e => setField("manufacturer", e.target.value)} fullWidth />
          <Input label={t("quality.msa.model")} value={form.model}
            onChange={e => setField("model", e.target.value)} fullWidth />
        </div>

        {/* 시리얼번호 */}
        <Input label={t("quality.msa.serialNo")} value={form.serialNo}
          onChange={e => setField("serialNo", e.target.value)} fullWidth />

        {/* 분해능 / 측정범위 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.msa.resolution")} value={form.resolution}
            onChange={e => setField("resolution", e.target.value)} fullWidth />
          <Input label={t("quality.msa.measureRange")} value={form.measureRange}
            onChange={e => setField("measureRange", e.target.value)} fullWidth />
        </div>

        {/* 교정주기(개월) */}
        <Input label={t("quality.msa.calibrationCycle")} type="number"
          value={String(form.calibrationCycle)}
          onChange={e => setField("calibrationCycle", parseInt(e.target.value) || 0)} fullWidth />

        {/* 보관장소 / 담당자 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.msa.location")} value={form.location}
            onChange={e => setField("location", e.target.value)} fullWidth />
          <Input label={t("quality.msa.responsible")} value={form.responsiblePerson}
            onChange={e => setField("responsiblePerson", e.target.value)} fullWidth />
        </div>

        {/* 읽기전용: 최종교정일 / 차기교정일 */}
        {isEdit && editData && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("quality.msa.lastCalibration")} readOnly
              value={editData.lastCalibrationDate?.slice(0, 10) ?? "-"} fullWidth />
            <Input label={t("quality.msa.nextCalibration")} readOnly
              value={editData.nextCalibrationDate?.slice(0, 10) ?? "-"} fullWidth />
          </div>
        )}
      </div>
    </div>
  );
}
