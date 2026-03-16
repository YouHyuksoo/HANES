"use client";

/**
 * @file src/app/(authenticated)/master/routing/components/QualityConditionPanel.tsx
 * @description 양품조건(합격조건) 모달 - routingCode + seq 기반
 *
 * 초보자 가이드:
 * 1. 공정 행의 양품조건 아이콘 클릭 → 모달 열림
 * 2. GET /master/routing-groups/:code/processes/:seq/conditions
 * 3. 저장: PUT .../conditions/bulk
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, Save, RefreshCw } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import type { SelectedProcess, QualityCondition, EditableCondition } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedProcess: SelectedProcess | null;
}

function toEditable(c: QualityCondition): EditableCondition {
  return {
    tempId: `${c.routingCode}::${c.seq}::${c.conditionSeq}`,
    conditionSeq: c.conditionSeq,
    conditionCode: c.conditionCode || "",
    minValue: c.minValue != null ? String(c.minValue) : "",
    maxValue: c.maxValue != null ? String(c.maxValue) : "",
    unit: c.unit || "",
    equipInterfaceYn: c.equipInterfaceYn || "N",
  };
}

let tempIdCounter = 0;

export default function QualityConditionPanel({ isOpen, onClose, selectedProcess }: Props) {
  const { t } = useTranslation();
  const conditionOptions = useComCodeOptions("QUALITY_CONDITION");
  const unitOptions = useComCodeOptions("UNIT_TYPE");

  const [conditions, setConditions] = useState<EditableCondition[]>([]);
  const [original, setOriginal] = useState<EditableCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(conditions) !== JSON.stringify(original), [conditions, original]);

  const fetch = useCallback(async () => {
    if (!selectedProcess) return;
    setLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/conditions`);
      const data = (res.data?.data ?? []).map(toEditable);
      setConditions(data);
      setOriginal(data);
    } catch { setConditions([]); setOriginal([]); }
    finally { setLoading(false); }
  }, [selectedProcess]);

  useEffect(() => { if (isOpen && selectedProcess) fetch(); }, [isOpen, selectedProcess, fetch]);

  const addRow = useCallback(() => {
    tempIdCounter += 1;
    const nextSeq = conditions.length > 0 ? Math.max(...conditions.map((c) => c.conditionSeq)) + 1 : 1;
    setConditions((p) => [...p, { tempId: `new-${tempIdCounter}`, conditionSeq: nextSeq, conditionCode: "", minValue: "", maxValue: "", unit: "", equipInterfaceYn: "N" }]);
  }, [conditions]);

  const removeRow = useCallback((id: string) => setConditions((p) => p.filter((c) => c.tempId !== id)), []);

  const change = useCallback((id: string, field: keyof EditableCondition, value: string) => {
    setConditions((p) => p.map((c) => c.tempId === id ? { ...c, [field]: value } : c));
  }, []);

  const save = useCallback(async () => {
    if (!selectedProcess) return;
    setSaving(true);
    try {
      await api.put(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/conditions/bulk`, {
        conditions: conditions.map((c, i) => ({
          conditionSeq: i + 1,
          conditionCode: c.conditionCode || null,
          minValue: c.minValue ? parseFloat(c.minValue) : null,
          maxValue: c.maxValue ? parseFloat(c.maxValue) : null,
          unit: c.unit || null,
          equipInterfaceYn: c.equipInterfaceYn,
        })),
      });
      await fetch();
    } catch { /* 인터셉터 */ }
    finally { setSaving(false); }
  }, [selectedProcess, conditions, fetch]);

  if (!selectedProcess) return null;

  const inputCls = "w-full px-2 py-1 text-xs border border-border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t("master.routing.conditionCode")} — ${selectedProcess.processName} [${selectedProcess.processCode}]`} size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-text-muted dark:text-gray-400">
          <span className="font-medium text-primary">{selectedProcess.routingCode}</span>
          <span>&gt;</span>
          <span className="text-text dark:text-gray-200">{selectedProcess.processName}</span>
          <span>{selectedProcess.processCode}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw className="w-5 h-5 text-primary animate-spin" /></div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border dark:border-gray-600 bg-surface dark:bg-gray-800">
                <th className="py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-8">#</th>
                <th className="text-left py-2 px-2 font-medium text-text-muted dark:text-gray-400 min-w-[160px]">{t("master.routing.conditionCode")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[100px]">{t("master.routing.minValue")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[100px]">{t("master.routing.maxValue")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[100px]">{t("master.routing.unit")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[50px]">I/F</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[40px]">{t("common.delete")}</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((c, i) => (
                <tr key={c.tempId} className="border-b border-border/50 dark:border-gray-700">
                  <td className="py-1.5 px-2 text-center text-text-muted">{i + 1}</td>
                  <td className="py-1.5 px-2">
                    <select value={c.conditionCode} onChange={(e) => change(c.tempId, "conditionCode", e.target.value)} className={inputCls}>
                      <option value="">-- {t("common.select")} --</option>
                      {conditionOptions.map((o) => <option key={o.value} value={o.value}>[{o.value}] {o.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2"><input type="number" step="0.01" value={c.minValue} onChange={(e) => change(c.tempId, "minValue", e.target.value)} className={`${inputCls} text-center`} /></td>
                  <td className="py-1.5 px-2"><input type="number" step="0.01" value={c.maxValue} onChange={(e) => change(c.tempId, "maxValue", e.target.value)} className={`${inputCls} text-center`} /></td>
                  <td className="py-1.5 px-2">
                    <select value={c.unit} onChange={(e) => change(c.tempId, "unit", e.target.value)} className={`${inputCls} text-center`}>
                      <option value="">--</option>
                      {unitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <input type="checkbox" checked={c.equipInterfaceYn === "Y"} onChange={(e) => change(c.tempId, "equipInterfaceYn", e.target.checked ? "Y" : "N")} className="w-4 h-4 rounded text-primary cursor-pointer" />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <button onClick={() => removeRow(c.tempId)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"><X className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && (
          <div className="flex justify-center">
            <button onClick={addRow} className="flex items-center gap-1 px-4 py-1.5 text-xs text-text-muted dark:text-gray-400 border border-dashed border-border dark:border-gray-600 rounded-lg hover:border-primary hover:text-primary transition-colors">
              <Plus className="w-3.5 h-3.5" />{t("master.routing.addCondition")}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border dark:border-gray-600">
          {isDirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium self-center mr-2">{t("master.routing.unsavedChanges")}</span>}
          <Button variant="secondary" size="sm" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={save} disabled={saving || !isDirty}>
            {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}{t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
