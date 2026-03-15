/**
 * @file src/app/(authenticated)/inspection/protocol/components/ProtocolFormPanel.tsx
 * @description 검사기 프로토콜 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST (생성), PUT (수정) /quality/continuity-inspect/protocols
 * 3. **2컬럼 그리드**: 기본 필드는 2열, sampleData/description은 전체 폭
 */

"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "@/components/ui";
import api from "@/services/api";

/** 프로토콜 데이터 인터페이스 */
export interface Protocol {
  protocolId: string;
  protocolName: string;
  commType: string;
  equipCode: string | null;
  delimiter: string;
  resultIndex: number;
  passValue: string;
  failValue: string;
  errorIndex: number | null;
  dataStartChar: string | null;
  dataEndChar: string | null;
  sampleData: string | null;
  description: string | null;
  useYn: string;
}

interface Props {
  editingProtocol: Protocol | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

const COMM_TYPE_OPTIONS = [
  { value: "SERIAL", label: "SERIAL" },
  { value: "TCP", label: "TCP" },
  { value: "HTTP", label: "HTTP" },
];

export default function ProtocolFormPanel({ editingProtocol, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingProtocol;

  /** Y/N 라디오 버튼 그룹 */
  const YnRadio = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted">{label}</label>
      <div className="flex gap-3 h-[34px] items-center">
        {[
          { v: "Y", l: "Y", cls: "text-green-600 dark:text-green-400" },
          { v: "N", l: "N", cls: "text-red-500 dark:text-red-400" },
        ].map(opt => (
          <label key={opt.v} className={`flex items-center gap-1.5 cursor-pointer text-xs ${value === opt.v ? opt.cls + " font-semibold" : "text-text-muted"}`}>
            <input type="radio" checked={value === opt.v} onChange={() => onChange(opt.v)} className="w-3.5 h-3.5 accent-primary" />
            {opt.l}
          </label>
        ))}
      </div>
    </div>
  );

  const buildDefault = (p: Protocol | null) => ({
    protocolId: p?.protocolId || "",
    protocolName: p?.protocolName || "",
    commType: p?.commType || "SERIAL",
    equipCode: p?.equipCode || "",
    delimiter: p?.delimiter || ",",
    resultIndex: p?.resultIndex ?? 1,
    passValue: p?.passValue || "PASS",
    failValue: p?.failValue || "FAIL",
    errorIndex: p?.errorIndex ?? "",
    dataStartChar: p?.dataStartChar || "",
    dataEndChar: p?.dataEndChar || "",
    sampleData: p?.sampleData || "",
    description: p?.description || "",
    useYn: p?.useYn || "Y",
  });

  const [form, setForm] = useState(() => buildDefault(editingProtocol));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(buildDefault(editingProtocol)); }, [editingProtocol]);

  const setField = (key: string, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.protocolId.trim() || !form.protocolName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        protocolId: form.protocolId,
        protocolName: form.protocolName,
        commType: form.commType,
        equipCode: form.equipCode || null,
        delimiter: form.delimiter,
        resultIndex: Number(form.resultIndex),
        passValue: form.passValue,
        failValue: form.failValue,
        errorIndex: form.errorIndex !== "" ? Number(form.errorIndex) : null,
        dataStartChar: form.dataStartChar || null,
        dataEndChar: form.dataEndChar || null,
        sampleData: form.sampleData || null,
        description: form.description || null,
        useYn: form.useYn,
      };
      if (isEdit) {
        await api.put(`/quality/continuity-inspect/protocols/${editingProtocol!.protocolId}`, payload);
      } else {
        await api.post("/quality/continuity-inspect/protocols", payload);
      }
      onSave();
      onClose();
    } catch { /* api 인터셉터에서 처리 */ } finally { setSaving(false); }
  };

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("inspection.protocol.editProtocol") : t("inspection.protocol.addProtocol")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.protocolId.trim() || !form.protocolName.trim()}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 폼 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("inspection.protocol.protocolId")} value={form.protocolId}
            onChange={e => setField("protocolId", e.target.value)} disabled={isEdit} fullWidth />
          <Input label={t("inspection.protocol.protocolName")} value={form.protocolName}
            onChange={e => setField("protocolName", e.target.value)} fullWidth />
          <Select label={t("inspection.protocol.commType")} options={COMM_TYPE_OPTIONS}
            value={form.commType} onChange={v => setField("commType", v)} fullWidth />
          <Input label={t("common.equipCode", "설비코드")} value={form.equipCode}
            onChange={e => setField("equipCode", e.target.value)} fullWidth />
          <Input label={t("inspection.protocol.delimiter")} value={form.delimiter}
            onChange={e => setField("delimiter", e.target.value)} fullWidth />
          <Input label={t("inspection.protocol.resultIndex")} type="number" value={String(form.resultIndex)}
            onChange={e => setField("resultIndex", Number(e.target.value))} fullWidth />
          <Input label={t("inspection.protocol.passValue")} value={form.passValue}
            onChange={e => setField("passValue", e.target.value)} fullWidth />
          <Input label={t("inspection.protocol.failValue")} value={form.failValue}
            onChange={e => setField("failValue", e.target.value)} fullWidth />
          <Input label={t("inspection.protocol.errorIndex")} type="number" value={String(form.errorIndex)}
            onChange={e => setField("errorIndex", e.target.value === "" ? "" : Number(e.target.value))} fullWidth />
          <Input label={t("inspection.protocol.startChar")} value={form.dataStartChar}
            onChange={e => setField("dataStartChar", e.target.value)} fullWidth />
          <Input label={t("inspection.protocol.endChar")} value={form.dataEndChar}
            onChange={e => setField("dataEndChar", e.target.value)} fullWidth />
          <YnRadio label={t("common.useYn")} value={form.useYn} onChange={v => setField("useYn", v)} />
          <div className="col-span-2">
            <Input label={t("inspection.protocol.sampleData")} value={form.sampleData}
              onChange={e => setField("sampleData", e.target.value)} fullWidth />
          </div>
          <div className="col-span-2">
            <Input label={t("common.description", "설명")} value={form.description}
              onChange={e => setField("description", e.target.value)} fullWidth />
          </div>
        </div>
      </div>
    </div>
  );
}
