"use client";

/**
 * @file src/app/(authenticated)/master/routing/page.tsx
 * @description 라우팅 정보 페이지 - 좌측 BOM 트리(품목+공정) + 우측 양품조건
 *
 * 초보자 가이드:
 * 1. **좌측**: 품목 선택 → BOM 구조 트리 (제품F + 반제품S + 공정P)
 *    - 품목별 라우팅 그룹 자동 생성/조회
 *    - 공정 추가/삭제
 * 2. **우측**: 선택된 공정(P)의 양품조건(검사조건) 인라인 편집
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Route, RefreshCw } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import RoutingTreePanel from "./components/RoutingTreePanel";
import QualityConditionPanel from "./components/QualityConditionPanel";
import type { SelectedProcess } from "./types";

export default function RoutingPage() {
  const { t } = useTranslation();
  const [selectedProcess, setSelectedProcess] = useState<SelectedProcess | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-gray-100 flex items-center gap-2">
            <Route className="w-7 h-7 text-primary" />
            {t("master.routing.title")}
          </h1>
          <p className="text-text-muted dark:text-gray-400 mt-1">
            {t("master.routing.subtitle")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-0 flex-1">
        {/* 좌측: 트리 */}
        <div className="col-span-4 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              <RoutingTreePanel
                key={refreshKey}
                selectedProcess={selectedProcess}
                onSelectProcess={setSelectedProcess}
              />
            </CardContent>
          </Card>
        </div>

        {/* 우측: 양품조건 */}
        <div className="col-span-8 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4">
              {selectedProcess ? (
                <QualityConditionInline selectedProcess={selectedProcess} />
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted dark:text-gray-400 text-sm">
                  {t("master.routing.selectProcessPrompt")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── 우측 양품조건 인라인 패널 (모달 아닌 인라인) ─── */
import { useState as useStateInline, useCallback as useCallbackInline, useEffect as useEffectInline, useMemo as useMemoInline } from "react";
import { Plus, X, Save, RefreshCw as RefreshCwIcon } from "lucide-react";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import type { QualityCondition, EditableCondition } from "./types";

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

function QualityConditionInline({ selectedProcess }: { selectedProcess: SelectedProcess }) {
  const { t } = useTranslation();
  const conditionOptions = useComCodeOptions("QUALITY_CONDITION");
  const unitOptions = useComCodeOptions("UNIT_TYPE");

  const [conditions, setConditions] = useStateInline<EditableCondition[]>([]);
  const [original, setOriginal] = useStateInline<EditableCondition[]>([]);
  const [loading, setLoading] = useStateInline(false);
  const [saving, setSaving] = useStateInline(false);

  const isDirty = useMemoInline(() => JSON.stringify(conditions) !== JSON.stringify(original), [conditions, original]);

  const fetch = useCallbackInline(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/conditions`);
      const data = (res.data?.data ?? []).map(toEditable);
      setConditions(data); setOriginal(data);
    } catch { setConditions([]); setOriginal([]); }
    finally { setLoading(false); }
  }, [selectedProcess.routingCode, selectedProcess.seq]);

  useEffectInline(() => { fetch(); }, [fetch]);

  const addRow = useCallbackInline(() => {
    tempIdCounter += 1;
    const nextSeq = conditions.length > 0 ? Math.max(...conditions.map((c) => c.conditionSeq)) + 1 : 1;
    setConditions((p) => [...p, { tempId: `new-${tempIdCounter}`, conditionSeq: nextSeq, conditionCode: "", minValue: "", maxValue: "", unit: "", equipInterfaceYn: "N" }]);
  }, [conditions]);

  const removeRow = useCallbackInline((id: string) => setConditions((p) => p.filter((c) => c.tempId !== id)), []);

  const change = useCallbackInline((id: string, field: keyof EditableCondition, value: string) => {
    setConditions((p) => p.map((c) => c.tempId === id ? { ...c, [field]: value } : c));
  }, []);

  const save = useCallbackInline(async () => {
    setSaving(true);
    try {
      await api.put(`/master/routing-groups/${selectedProcess.routingCode}/processes/${selectedProcess.seq}/conditions/bulk`, {
        conditions: conditions.map((c, i) => ({
          conditionSeq: i + 1, conditionCode: c.conditionCode || null,
          minValue: c.minValue ? parseFloat(c.minValue) : null, maxValue: c.maxValue ? parseFloat(c.maxValue) : null,
          unit: c.unit || null, equipInterfaceYn: c.equipInterfaceYn,
        })),
      });
      await fetch();
    } catch { /* */ }
    finally { setSaving(false); }
  }, [selectedProcess, conditions, fetch]);

  const inputCls = "w-full px-2 py-1 text-xs border border-border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-text dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-medium text-primary truncate">{selectedProcess.routingCode}</span>
          <span className="text-text-muted dark:text-gray-400">&gt;</span>
          <span className="font-medium text-text dark:text-gray-200 truncate">{selectedProcess.processName}</span>
          <span className="text-text-muted dark:text-gray-400 text-xs">{selectedProcess.processCode}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{t("master.routing.unsavedChanges")}</span>}
          <Button size="sm" onClick={save} disabled={saving || !isDirty}>
            {saving ? <RefreshCwIcon className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}{t("common.save")}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCwIcon className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface dark:bg-gray-800">
              <tr className="border-b border-border dark:border-gray-600">
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
                <tr key={c.tempId} className="border-b border-border/50 dark:border-gray-700 hover:bg-surface-hover dark:hover:bg-gray-700/50">
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
                  <td className="py-1.5 px-2 text-center"><input type="checkbox" checked={c.equipInterfaceYn === "Y"} onChange={(e) => change(c.tempId, "equipInterfaceYn", e.target.checked ? "Y" : "N")} className="w-4 h-4 rounded text-primary cursor-pointer" /></td>
                  <td className="py-1.5 px-2 text-center"><button onClick={() => removeRow(c.tempId)} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && (
          <div className="flex justify-center py-3">
            <button onClick={addRow} className="flex items-center gap-1 px-4 py-1.5 text-xs text-text-muted dark:text-gray-400 border border-dashed border-border dark:border-gray-600 rounded-lg hover:border-primary hover:text-primary transition-colors">
              <Plus className="w-3.5 h-3.5" />{t("master.routing.addCondition")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
