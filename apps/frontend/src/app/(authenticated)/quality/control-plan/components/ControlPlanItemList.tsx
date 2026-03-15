"use client";

/**
 * @file quality/control-plan/components/ControlPlanItemList.tsx
 * @description 관리계획서 관리항목 인라인 편집 목록
 *
 * 초보자 가이드:
 * 1. planId를 받아 관리항목 목록을 조회/추가/수정
 * 2. 인라인 행 편집: 순번, 공정명, 특성번호, 제품특성, 공정특성, 특별특성 등
 * 3. APPROVED 상태에서는 편집 불가
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, X, Trash2 } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import { useProcessOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

/** 관리항목 타입 */
interface PlanItem {
  seq: number; processName: string; characteristicNo: string;
  productCharacteristic: string; processCharacteristic: string; specialCharClass: string;
  specification: string; evalMethod: string; sampleSize: string; sampleFreq: string;
  controlMethod: string; reactionPlan: string;
}
type FormFields = PlanItem;

const INIT_FORM: FormFields = {
  seq: 0, processName: "", characteristicNo: "", productCharacteristic: "",
  processCharacteristic: "", specialCharClass: "", specification: "",
  evalMethod: "", sampleSize: "", sampleFreq: "", controlMethod: "", reactionPlan: "",
};

interface Props {
  planId: number;
  planStatus: string;
}

export default function ControlPlanItemList({ planId, planStatus }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [form, setForm] = useState<FormFields>(INIT_FORM);
  const canEdit = planStatus === "DRAFT";

  /* 셀렉트 옵션 */
  const { options: processOptions } = useProcessOptions();
  const evalMethodOpts = useComCodeOptions("INSPECT_METHOD");
  const sampleSizeOpts = useComCodeOptions("SAMPLE_SIZE");
  const sampleFreqOpts = useComCodeOptions("SAMPLE_FREQ");
  const controlMethodOpts = useComCodeOptions("CONTROL_METHOD");

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get(`/quality/control-plans/${planId}`);
      setItems(res.data?.data?.items ?? []);
    } catch {
      setItems([]);
    }
  }, [planId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const setF = (key: keyof FormFields, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAdd = async () => {
    if (!form.processName) return;
    try {
      await api.post(`/quality/control-plans/${planId}/items`, {
        ...form, seq: items.length + 1,
      });
      setForm(INIT_FORM);
      setIsAdding(false);
      fetchItems();
    } catch { /* api 인터셉터 */ }
  };

  const handleUpdate = async (itemSeq: number) => {
    try {
      await api.put(`/quality/control-plans/${planId}/items/${itemSeq}`, form);
      setEditingSeq(null);
      setForm(INIT_FORM);
      fetchItems();
    } catch { /* api 인터셉터 */ }
  };

  const handleDelete = async (itemSeq: number) => {
    try {
      await api.delete(`/quality/control-plans/${planId}/items/${itemSeq}`);
      fetchItems();
    } catch { /* api 인터셉터 */ }
  };

  const startEdit = (item: PlanItem) => {
    setEditingSeq(item.seq);
    const s = (v: string) => v ?? "";
    setForm({ seq: item.seq, processName: s(item.processName), characteristicNo: s(item.characteristicNo),
      productCharacteristic: s(item.productCharacteristic), processCharacteristic: s(item.processCharacteristic),
      specialCharClass: s(item.specialCharClass), specification: s(item.specification), evalMethod: s(item.evalMethod),
      sampleSize: s(item.sampleSize), sampleFreq: s(item.sampleFreq), controlMethod: s(item.controlMethod), reactionPlan: s(item.reactionPlan) });
  };

  const specialOptions = [{ value: "", label: "-" }, { value: "CC", label: "CC" }, { value: "SC", label: "SC" }, { value: "HI", label: "HI" }];

  /** 인라인 편집 셀 */
  const renderEditCells = (isNew: boolean, itemSeq?: number) => (
    <>
      <td className="px-2 py-1">
        <select value={form.processName} onChange={e => setF("processName", e.target.value)}
          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
          <option value="">-</option>
          {processOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1"><Input value={form.characteristicNo} onChange={e => setF("characteristicNo", e.target.value)} fullWidth className="text-xs" /></td>
      <td className="px-2 py-1"><Input value={form.productCharacteristic} onChange={e => setF("productCharacteristic", e.target.value)} fullWidth className="text-xs" /></td>
      <td className="px-2 py-1"><Input value={form.processCharacteristic} onChange={e => setF("processCharacteristic", e.target.value)} fullWidth className="text-xs" /></td>
      <td className="px-2 py-1">
        <select value={form.specialCharClass} onChange={e => setF("specialCharClass", e.target.value)}
          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
          {specialOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1"><Input value={form.specification} onChange={e => setF("specification", e.target.value)} fullWidth className="text-xs" /></td>
      <td className="px-2 py-1">
        <select value={form.evalMethod} onChange={e => setF("evalMethod", e.target.value)}
          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
          <option value="">-</option>
          {evalMethodOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select value={form.sampleSize} onChange={e => setF("sampleSize", e.target.value)}
          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
          <option value="">-</option>
          {sampleSizeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select value={form.sampleFreq} onChange={e => setF("sampleFreq", e.target.value)}
          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
          <option value="">-</option>
          {sampleFreqOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <select value={form.controlMethod} onChange={e => setF("controlMethod", e.target.value)}
          className="w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-1.5 py-1 text-xs">
          <option value="">-</option>
          {controlMethodOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1"><Input value={form.reactionPlan} onChange={e => setF("reactionPlan", e.target.value)} fullWidth className="text-xs" /></td>
      <td className="px-2 py-1 text-center">
        <div className="flex gap-1 justify-center">
          <Button size="sm" variant="primary" onClick={isNew ? handleAdd : () => handleUpdate(itemSeq!)} className="px-1.5 py-0.5 h-6"><Save className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { isNew ? setIsAdding(false) : setEditingSeq(null); setForm(INIT_FORM); }} className="px-1.5 py-0.5 h-6"><X className="w-3 h-3" /></Button>
        </div>
      </td>
    </>
  );

  /** 코드값 → 라벨 변환 헬퍼 */
  const codeLabelMap = (opts: { value: string; label: string }[]) =>
    Object.fromEntries(opts.map(o => [o.value, o.label]));
  const processMap = codeLabelMap(processOptions);
  const evalMap = codeLabelMap(evalMethodOpts);
  const sizeMap = codeLabelMap(sampleSizeOpts);
  const freqMap = codeLabelMap(sampleFreqOpts);
  const ctrlMap = codeLabelMap(controlMethodOpts);
  const toLabel = (v: string, map: Record<string, string>) => map[v] || v;

  const cp = "quality.controlPlan";
  const headers = [
    { key: "seq", label: "#", w: "w-10" }, { key: "processName", label: t(`${cp}.processName`) },
    { key: "charNo", label: t(`${cp}.charNo`) }, { key: "prodChar", label: t(`${cp}.productChar`) },
    { key: "procChar", label: t(`${cp}.processChar`) }, { key: "specialChar", label: t(`${cp}.specialChar`), w: "w-16" },
    { key: "spec", label: t(`${cp}.spec`) }, { key: "evalMethod", label: t(`${cp}.evalMethod`) },
    { key: "sampleSize", label: t(`${cp}.sampleSize`), w: "w-16" }, { key: "sampleFreq", label: t(`${cp}.sampleFreq`), w: "w-16" },
    { key: "controlMethod", label: t(`${cp}.controlMethod`) }, { key: "reactionPlan", label: t(`${cp}.reactionPlan`) },
  ];

  return (
    <Card className="flex-shrink-0">
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text">{t("quality.controlPlan.items")}</h3>
          {canEdit && (
            <Button size="sm" variant="secondary"
              onClick={() => { setIsAdding(true); setForm({ ...INIT_FORM, seq: items.length + 1 }); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />{t("common.add")}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-surface dark:bg-slate-800">
                {headers.map(h => (
                  <th key={h.key} className={`px-2 py-2 text-left font-medium text-text-muted ${h.w ?? ""}`}>{h.label}</th>
                ))}
                {canEdit && <th className="px-2 py-2 text-center font-medium text-text-muted w-20">{t("common.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.seq} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                  {editingSeq === item.seq ? (
                    <><td className="px-2 py-1 text-text-muted">{item.seq}</td>{renderEditCells(false, item.seq)}</>
                  ) : (<>
                    {[item.seq, toLabel(item.processName, processMap), item.characteristicNo, item.productCharacteristic,
                      item.processCharacteristic, item.specialCharClass, item.specification, toLabel(item.evalMethod, evalMap),
                      toLabel(item.sampleSize, sizeMap), toLabel(item.sampleFreq, freqMap), toLabel(item.controlMethod, ctrlMap), item.reactionPlan,
                    ].map((v, i) => <td key={i} className="px-2 py-1 text-text-muted">{v || "-"}</td>)}
                    {canEdit && (
                      <td className="px-2 py-1 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(item)} className="text-[10px] px-1.5 py-0.5 h-6">{t("common.edit")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.seq)} className="text-[10px] px-1.5 py-0.5 h-6 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </td>
                    )}
                  </>)}
                </tr>
              ))}

              {/* 인라인 추가 행 */}
              {isAdding && (
                <tr className="border-b border-border/50 bg-primary/5 dark:bg-primary/10">
                  <td className="px-2 py-1 text-text-muted">{items.length + 1}</td>
                  {renderEditCells(true)}
                </tr>
              )}

              {items.length === 0 && !isAdding && (
                <tr><td colSpan={headers.length + 1} className="text-center text-text-muted py-6">{t("common.noData")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
