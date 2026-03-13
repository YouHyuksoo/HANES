"use client";

/**
 * @file quality/spc/components/SpcFormPanel.tsx
 * @description SPC 관리도 마스터 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정
 * 2. 품목(PartSearchModal), 공정(ProcessSelect), 특성명, 관리도유형, 부분군크기 등 입력
 * 3. USL/LSL/Target 입력, UCL/LCL/CL은 계산 결과로 읽기전용 표시
 * 4. API: POST /quality/spc/charts, PATCH /quality/spc/charts/:id
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ProcessSelect, ComCodeSelect, PartSearchModal } from "@/components/shared";
import type { PartItem } from "@/components/shared";
import api from "@/services/api";

interface SpcFormData {
  itemCode: string;
  processCode: string;
  characteristicName: string;
  chartType: string;
  subgroupSize: number;
  usl: string;
  lsl: string;
  target: string;
}

const INIT: SpcFormData = {
  itemCode: "", processCode: "", characteristicName: "",
  chartType: "", subgroupSize: 5, usl: "", lsl: "", target: "",
};

interface Props {
  editData: {
    id: number; itemCode: string; processCode: string;
    characteristicName: string; chartType: string; subgroupSize: number;
    usl: number | null; lsl: number | null; target: number | null;
    ucl: number | null; lcl: number | null; cl: number | null;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function SpcFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<SpcFormData>(INIT);
  const [saving, setSaving] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        itemCode: editData.itemCode ?? "",
        processCode: editData.processCode ?? "",
        characteristicName: editData.characteristicName ?? "",
        chartType: editData.chartType ?? "",
        subgroupSize: editData.subgroupSize ?? 5,
        usl: editData.usl != null ? String(editData.usl) : "",
        lsl: editData.lsl != null ? String(editData.lsl) : "",
        target: editData.target != null ? String(editData.target) : "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof SpcFormData, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handlePartSelect = (part: PartItem) => {
    setField("itemCode", part.itemCode);
    setPartModalOpen(false);
  };

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.characteristicName || !form.chartType) return;
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        processCode: form.processCode || undefined,
        characteristicName: form.characteristicName,
        chartType: form.chartType,
        subgroupSize: form.subgroupSize,
        usl: form.usl ? Number(form.usl) : undefined,
        lsl: form.lsl ? Number(form.lsl) : undefined,
        target: form.target ? Number(form.target) : undefined,
      };
      if (isEdit && editData) {
        await api.patch(`/quality/spc/charts/${editData.id}`, payload);
      } else {
        await api.post("/quality/spc/charts", payload);
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
          {isEdit ? t("common.edit") : t("quality.spc.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave}
            disabled={saving || !form.itemCode || !form.characteristicName || !form.chartType}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 품목코드 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">{t("quality.spc.itemCode")}</label>
          <div className="flex gap-2">
            <Input value={form.itemCode} readOnly fullWidth placeholder={t("quality.spc.itemCode")} />
            <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 공정 */}
        <ProcessSelect label={t("quality.spc.processCode")} value={form.processCode}
          onChange={v => setField("processCode", v)} fullWidth />

        {/* 특성명 */}
        <Input label={t("quality.spc.characteristicName")} value={form.characteristicName}
          onChange={e => setField("characteristicName", e.target.value)} fullWidth />

        {/* 관리도유형 / 부분군크기 */}
        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="SPC_CHART_TYPE" includeAll={false}
            label={t("quality.spc.chartType")} value={form.chartType}
            onChange={v => setField("chartType", v)} fullWidth />
          <Input label={t("quality.spc.subgroupSize")} type="number"
            value={String(form.subgroupSize)}
            onChange={e => setField("subgroupSize", Number(e.target.value) || 1)} fullWidth />
        </div>

        {/* 규격: USL / LSL / Target */}
        <div className="grid grid-cols-3 gap-3">
          <Input label={t("quality.spc.usl")} type="number" value={form.usl}
            onChange={e => setField("usl", e.target.value)} fullWidth />
          <Input label={t("quality.spc.lsl")} type="number" value={form.lsl}
            onChange={e => setField("lsl", e.target.value)} fullWidth />
          <Input label={t("quality.spc.target")} type="number" value={form.target}
            onChange={e => setField("target", e.target.value)} fullWidth />
        </div>

        {/* 계산된 관리한계 (읽기전용) */}
        {isEdit && editData && (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs font-medium text-text-muted mb-3">{t("quality.spc.calculatedLimits")}</p>
            <div className="grid grid-cols-3 gap-3">
              <Input label={t("quality.spc.ucl")} value={editData.ucl != null ? String(editData.ucl) : "-"}
                readOnly fullWidth />
              <Input label={t("quality.spc.cl")} value={editData.cl != null ? String(editData.cl) : "-"}
                readOnly fullWidth />
              <Input label={t("quality.spc.lcl")} value={editData.lcl != null ? String(editData.lcl) : "-"}
                readOnly fullWidth />
            </div>
          </div>
        )}
      </div>

      {/* 품목 검색 모달 */}
      {partModalOpen && (
        <PartSearchModal isOpen={partModalOpen} onSelect={handlePartSelect} onClose={() => setPartModalOpen(false)} />
      )}
    </div>
  );
}
