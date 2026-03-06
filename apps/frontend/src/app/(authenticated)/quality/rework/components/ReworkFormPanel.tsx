"use client";

/**
 * @file quality/rework/components/ReworkFormPanel.tsx
 * @description 재작업 지시 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. editData=null → 신규 등록, editData 있으면 수정
 * 3. API: POST /quality/reworks (등록), PUT /quality/reworks/:id (수정)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { LineSelect, EquipSelect, WorkerSelect, ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface ProcessItem {
  processCode: string;
  processName: string;
  seq: number;
  processType: string | null;
  equipType: string | null;
}

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

const INIT: ReworkFormData = {
  itemCode: "", itemName: "", reworkQty: "", defectType: "",
  reworkMethod: "", lineCode: "", equipCode: "", workerCode: "", remarks: "",
};

export interface ReworkEditData {
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
  editData: ReworkEditData | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function ReworkFormPanel({ editData, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<ReworkFormData>(INIT);
  const [saving, setSaving] = useState(false);
  const [routingProcesses, setRoutingProcesses] = useState<ProcessItem[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (editData) {
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
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof ReworkFormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  /** 라우팅 조회 — 품목코드 기반 공정 목록 fetch */
  const fetchRouting = useCallback(async () => {
    if (!form.itemCode) return;
    try {
      const res = await api.get("/master/routings", { params: { itemCode: form.itemCode } });
      const items: ProcessItem[] = res.data?.data ?? [];
      setRoutingProcesses(items);
      setSelectedProcesses(new Set(items.map((_: ProcessItem, i: number) => i)));
    } catch {
      setRoutingProcesses([]);
    }
  }, [form.itemCode]);

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.reworkQty) return;
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
        processItems: routingProcesses
          .filter((_, idx) => selectedProcesses.has(idx))
          .map(p => ({
            processCode: p.processCode,
            processName: p.processName,
            seq: p.seq,
            workerCode: form.workerCode || undefined,
            lineCode: form.lineCode || undefined,
            equipCode: form.equipCode || undefined,
          })),
      };
      if (isEdit && editData) {
        await api.put(`/quality/reworks/${editData.id}`, payload);
      } else {
        await api.post("/quality/reworks", payload);
      }
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSave, onClose, routingProcesses, selectedProcesses]);

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("quality.rework.edit") : t("quality.rework.create")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 기본정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.rework.itemCode")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input label={t("quality.rework.itemCode")} value={form.itemCode}
                  onChange={e => setField("itemCode", e.target.value)} fullWidth />
              </div>
              <Button size="sm" variant="secondary" onClick={fetchRouting}
                className="self-end mb-0.5" disabled={!form.itemCode}>
                <Search className="w-3.5 h-3.5 mr-1" />{t("common.lookup")}
              </Button>
            </div>
            <Input label={t("quality.rework.itemName")} value={form.itemName}
              onChange={e => setField("itemName", e.target.value)} fullWidth />
          </div>
        </div>

        {/* 수량/불량유형 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("quality.rework.reworkQty")} type="number" value={form.reworkQty}
            onChange={e => setField("reworkQty", e.target.value)} fullWidth />
          <ComCodeSelect groupCode="DEFECT_TYPE" includeAll={false}
            label={t("quality.rework.defectType")} value={form.defectType}
            onChange={v => setField("defectType", v)} fullWidth />
        </div>

        {/* 공정 선택 */}
        {routingProcesses.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-text-muted">{t("quality.rework.selectProcesses")}</h3>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox"
                  checked={selectedProcesses.size === routingProcesses.length}
                  onChange={e => {
                    if (e.target.checked) setSelectedProcesses(new Set(routingProcesses.map((_, i) => i)));
                    else setSelectedProcesses(new Set());
                  }}
                  className="w-3.5 h-3.5 rounded text-primary" />
                {t("common.selectAll")}
              </label>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto border border-border rounded-lg p-2">
              {routingProcesses.map((proc, idx) => (
                <label key={idx}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-xs
                    ${selectedProcesses.has(idx) ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-surface"}`}>
                  <input type="checkbox"
                    checked={selectedProcesses.has(idx)}
                    onChange={e => {
                      const next = new Set(selectedProcesses);
                      if (e.target.checked) next.add(idx); else next.delete(idx);
                      setSelectedProcesses(next);
                    }}
                    className="w-3.5 h-3.5 rounded text-primary" />
                  <span className="text-text-muted w-6">{proc.seq}</span>
                  <span className="font-medium text-text">{proc.processCode}</span>
                  <span className="text-text-muted">{proc.processName}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 라인/설비/작업자 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.rework.line")}</h3>
          <div className="grid grid-cols-1 gap-3">
            <LineSelect label={t("quality.rework.line")} value={form.lineCode}
              onChange={v => setField("lineCode", v)} fullWidth />
            <EquipSelect label={t("quality.rework.equip")} value={form.equipCode}
              onChange={v => setField("equipCode", v)} fullWidth />
            <WorkerSelect label={t("quality.rework.worker")} value={form.workerCode}
              onChange={v => setField("workerCode", v)} fullWidth />
          </div>
        </div>

        {/* 재작업방법 */}
        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.rework.reworkMethod")}
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.reworkMethod}
            onChange={e => setField("reworkMethod", e.target.value)}
          />
        </div>

        {/* 비고 */}
        <Input label={t("common.remark")} value={form.remarks}
          onChange={e => setField("remarks", e.target.value)} fullWidth />
      </div>

      {/* 푸터 */}
      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !form.itemCode || !form.reworkQty}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </div>
  );
}
