"use client";

/**
 * @file quality/fai/components/FaiItemList.tsx
 * @description 초물검사 검사항목별 결과 테이블 — 인라인 편집 + 자동 판정 (specMin~specMax → OK/NG)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import api from "@/services/api";

interface FaiItem {
  seq: number; inspectItem: string; specMin: number | null; specMax: number | null;
  measuredValue: number | null; unit: string; result: string; remark: string;
}

interface Props { faiId: string; faiNo: string; editable: boolean; }

const emptyItem = (seq: number): FaiItem => ({
  seq, inspectItem: "", specMin: null, specMax: null,
  measuredValue: null, unit: "", result: "", remark: "",
});

/** measuredValue가 specMin~specMax 범위인지 판정 */
function autoJudge(item: FaiItem): string {
  if (item.measuredValue == null) return "";
  if (item.specMin != null && item.measuredValue < item.specMin) return "NG";
  if (item.specMax != null && item.measuredValue > item.specMax) return "NG";
  if (item.specMin != null || item.specMax != null) return "OK";
  return "";
}

export default function FaiItemList({ faiId, faiNo, editable }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<FaiItem[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get(`/quality/fai/${faiId}`);
      const fetched = res.data?.data?.items ?? [];
      setItems(fetched.length > 0 ? fetched : []);
    } catch {
      setItems([]);
    }
  }, [faiId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const updateItem = (idx: number, key: keyof FaiItem, value: string | number | null) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [key]: value };
      item.result = autoJudge(item);
      next[idx] = item;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, seq: i + 1 })));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post(`/quality/fai/${faiId}/items`, items);
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [faiId, items]);

  const inputCls = "w-full rounded border border-border bg-white dark:bg-slate-900 text-text px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30";

  const Cell = ({ idx, field, type, align, fallback }: {
    idx: number; field: keyof FaiItem; type?: string; align?: string; fallback?: string;
  }) => {
    const val = items[idx][field];
    if (!editable) return <span className={`${align === "right" ? "font-mono text-right block" : "text-text"}`}>{val ?? fallback ?? "-"}</span>;
    return type === "number"
      ? <input type="number" className={`${inputCls} text-right`} value={val ?? ""}
          onChange={e => updateItem(idx, field, e.target.value ? Number(e.target.value) : null)} />
      : <input className={inputCls} value={(val as string) ?? ""} onChange={e => updateItem(idx, field, e.target.value)} />;
  };

  return (
    <Card className="flex-shrink-0">
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text">
            {t("quality.fai.inspectItem")} — {faiNo}
          </h3>
          {editable && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={addItem}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t("quality.fai.addItem")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface dark:bg-slate-800">
                <th className="px-2 py-2 text-left w-12">#</th>
                <th className="px-2 py-2 text-left">{t("quality.fai.inspectItem")}</th>
                <th className="px-2 py-2 text-right w-24">{t("quality.fai.specMin")}</th>
                <th className="px-2 py-2 text-right w-24">{t("quality.fai.specMax")}</th>
                <th className="px-2 py-2 text-right w-24">{t("quality.fai.measuredValue")}</th>
                <th className="px-2 py-2 text-left w-16">{t("quality.fai.unit")}</th>
                <th className="px-2 py-2 text-center w-16">{t("quality.fai.result")}</th>
                {editable && <th className="px-2 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={editable ? 8 : 7}
                    className="px-2 py-6 text-center text-text-muted">
                    {t("common.noData")}
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                  <td className="px-2 py-1.5 text-text-muted">{item.seq}</td>
                  <td className="px-2 py-1.5"><Cell idx={idx} field="inspectItem" /></td>
                  <td className="px-2 py-1.5"><Cell idx={idx} field="specMin" type="number" align="right" /></td>
                  <td className="px-2 py-1.5"><Cell idx={idx} field="specMax" type="number" align="right" /></td>
                  <td className="px-2 py-1.5"><Cell idx={idx} field="measuredValue" type="number" align="right" /></td>
                  <td className="px-2 py-1.5"><Cell idx={idx} field="unit" /></td>
                  <td className="px-2 py-1.5 text-center">
                    {item.result === "OK" && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">OK</span>}
                    {item.result === "NG" && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">NG</span>}
                    {!item.result && <span className="text-text-muted">-</span>}
                  </td>
                  {editable && (
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
