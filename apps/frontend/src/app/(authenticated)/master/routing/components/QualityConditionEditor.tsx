"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Save, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import type { EditableCondition, QualityCondition, SelectedProcess } from "../types";

function toEditable(condition: QualityCondition): EditableCondition {
  return {
    tempId: `${condition.routingCode}::${condition.seq}::${condition.conditionSeq}`,
    conditionSeq: condition.conditionSeq,
    conditionCode: condition.conditionCode || "",
    minValue: condition.minValue != null ? String(condition.minValue) : "",
    maxValue: condition.maxValue != null ? String(condition.maxValue) : "",
    unit: condition.unit || "",
    equipInterfaceYn: condition.equipInterfaceYn || "N",
  };
}

let tempIdCounter = 0;

export default function QualityConditionEditor({ selectedProcess }: { selectedProcess: SelectedProcess }) {
  const { t } = useTranslation();
  const conditionOptions = useComCodeOptions("QUALITY_CONDITION");
  const unitOptions = useComCodeOptions("UNIT_TYPE");

  const [conditions, setConditions] = useState<EditableCondition[]>([]);
  const [original, setOriginal] = useState<EditableCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => JSON.stringify(conditions) !== JSON.stringify(original), [conditions, original]);

  const fetchConditions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/conditions`);
      const data = (res.data?.data ?? []).map(toEditable);
      setConditions(data);
      setOriginal(data);
    } catch {
      setConditions([]);
      setOriginal([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProcess.routingCode, selectedProcess.seq]);

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

  const addRow = useCallback(() => {
    tempIdCounter += 1;
    const nextSeq = conditions.length > 0 ? Math.max(...conditions.map((c) => c.conditionSeq)) + 1 : 1;
    setConditions((prev) => [...prev, {
      tempId: `new-${tempIdCounter}`,
      conditionSeq: nextSeq,
      conditionCode: "",
      minValue: "",
      maxValue: "",
      unit: "",
      equipInterfaceYn: "N",
    }]);
  }, [conditions]);

  const removeRow = useCallback((id: string) => {
    setConditions((prev) => prev.filter((condition) => condition.tempId !== id));
  }, []);

  const change = useCallback((id: string, field: keyof EditableCondition, value: string) => {
    setConditions((prev) => prev.map((condition) =>
      condition.tempId === id ? { ...condition, [field]: value } : condition,
    ));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.put(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/conditions/bulk`, {
        conditions: conditions.map((condition, index) => ({
          conditionSeq: index + 1,
          conditionCode: condition.conditionCode || null,
          minValue: condition.minValue ? parseFloat(condition.minValue) : null,
          maxValue: condition.maxValue ? parseFloat(condition.maxValue) : null,
          unit: condition.unit || null,
          equipInterfaceYn: condition.equipInterfaceYn,
        })),
      });
      await fetchConditions();
    } finally {
      setSaving(false);
    }
  }, [conditions, fetchConditions, selectedProcess.routingCode, selectedProcess.seq]);

  const inputCls = "w-full px-2 py-1 text-xs border border-border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between mb-4 shrink-0 gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text dark:text-gray-100">
            {t("master.routing.conditionEditorTitle")}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted dark:text-gray-400 min-w-0">
            <span className="font-medium text-primary truncate">{selectedProcess.routingCode}</span>
            <span>&gt;</span>
            <span className="font-medium text-text dark:text-gray-200 truncate">{selectedProcess.processName}</span>
            <span>{selectedProcess.processCode}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t("master.routing.unsavedChanges")}</span>}
          <Button size="sm" onClick={save} disabled={saving || !isDirty}>
            {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface dark:bg-gray-800">
              <tr className="border-b border-border dark:border-gray-600">
                <th className="py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-8">#</th>
                <th className="text-left py-2 px-2 font-medium text-text-muted dark:text-gray-400 min-w-[160px]">{t("master.routing.conditionCode")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[100px]">{t("master.routing.minValue")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[100px]">{t("master.routing.maxValue")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[100px]">{t("master.routing.unit")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[70px]">{t("master.routing.equipInterface")}</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted dark:text-gray-400 w-[40px]">{t("common.delete")}</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((condition, index) => (
                <tr key={condition.tempId} className="border-b border-border/50 dark:border-gray-700 hover:bg-surface-hover dark:hover:bg-gray-700/50">
                  <td className="py-1.5 px-2 text-center text-text-muted">{index + 1}</td>
                  <td className="py-1.5 px-2">
                    <select value={condition.conditionCode} onChange={(e) => change(condition.tempId, "conditionCode", e.target.value)} className={inputCls}>
                      <option value="">-- {t("common.select")} --</option>
                      {conditionOptions.map((option) => <option key={option.value} value={option.value}>[{option.value}] {option.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2"><input type="number" step="0.01" value={condition.minValue} onChange={(e) => change(condition.tempId, "minValue", e.target.value)} className={`${inputCls} text-center`} /></td>
                  <td className="py-1.5 px-2"><input type="number" step="0.01" value={condition.maxValue} onChange={(e) => change(condition.tempId, "maxValue", e.target.value)} className={`${inputCls} text-center`} /></td>
                  <td className="py-1.5 px-2">
                    <select value={condition.unit} onChange={(e) => change(condition.tempId, "unit", e.target.value)} className={`${inputCls} text-center`}>
                      <option value="">--</option>
                      {unitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <input type="checkbox" checked={condition.equipInterfaceYn === "Y"} onChange={(e) => change(condition.tempId, "equipInterfaceYn", e.target.checked ? "Y" : "N")} className="w-4 h-4 rounded text-primary cursor-pointer" />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <button onClick={() => removeRow(condition.tempId)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && (
          <div className="flex justify-center py-3">
            <button onClick={addRow} className="flex items-center gap-1 px-4 py-1.5 text-xs text-text-muted dark:text-gray-400 border border-dashed border-border dark:border-gray-600 rounded-lg hover:border-primary hover:text-primary transition-colors">
              <Plus className="w-3.5 h-3.5" />
              {t("master.routing.addCondition")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
