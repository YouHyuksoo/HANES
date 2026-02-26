"use client";

/**
 * @file production/sample-inspect/components/SampleInspectInputModal.tsx
 * @description 반제품 샘플검사 입력 모달 - 작업지시 선택 → 샘플별 측정값 입력
 *
 * 초보자 가이드:
 * 1. 작업지시 선택 → 검사자/일자/검사유형 입력
 * 2. 샘플 수량 설정 → 각 샘플별 측정값/상하한/합불 입력
 * 3. 일괄 저장 (POST /production/sample-inspect-input)
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Minus } from "lucide-react";
import { Modal, Button, Input, Select } from "@/components/ui";
import api from "@/services/api";

interface JobOrderOption {
  value: string;
  label: string;
}

interface SampleRow {
  sampleNo: number;
  measuredValue: string;
  specUpper: string;
  specLower: string;
  passYn: string;
  remark: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function SampleInspectInputModal({ isOpen, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [jobOrders, setJobOrders] = useState<JobOrderOption[]>([]);

  const [form, setForm] = useState({
    orderNo: "",
    inspectDate: new Date().toISOString().slice(0, 10),
    inspectorName: "",
    inspectType: "",
  });

  const [samples, setSamples] = useState<SampleRow[]>([
    { sampleNo: 1, measuredValue: "", specUpper: "", specLower: "", passYn: "Y", remark: "" },
  ]);

  useEffect(() => {
    if (!isOpen) return;
    api.get("/production/job-orders", { params: { limit: 5000 } }).then(res => {
      const list = (res.data?.data ?? []).map((jo: any) => ({
        value: jo.id,
        label: `${jo.orderNo} - ${jo.part?.itemName || ""}`,
      }));
      setJobOrders(list);
    }).catch(() => setJobOrders([]));
  }, [isOpen]);

  const joOptions = useMemo(() => [
    { value: "", label: t("common.select") }, ...jobOrders,
  ], [t, jobOrders]);

  const passOptions = useMemo(() => [
    { value: "Y", label: t("production.sampleInspect.pass") },
    { value: "N", label: t("production.sampleInspect.fail") },
  ], [t]);

  const addSample = useCallback(() => {
    setSamples(prev => [
      ...prev,
      { sampleNo: prev.length + 1, measuredValue: "", specUpper: prev[0]?.specUpper || "", specLower: prev[0]?.specLower || "", passYn: "Y", remark: "" },
    ]);
  }, []);

  const removeSample = useCallback(() => {
    setSamples(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  const updateSample = useCallback((idx: number, field: keyof SampleRow, value: string) => {
    setSamples(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "measuredValue" && next[idx].specUpper && next[idx].specLower) {
        const val = parseFloat(value);
        const upper = parseFloat(next[idx].specUpper);
        const lower = parseFloat(next[idx].specLower);
        if (!isNaN(val) && !isNaN(upper) && !isNaN(lower)) {
          next[idx].passYn = val >= lower && val <= upper ? "Y" : "N";
        }
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.orderNo || !form.inspectorName) return;
    setSaving(true);
    try {
      await api.post("/production/sample-inspect-input", {
        orderNo: form.orderNo,
        inspectDate: form.inspectDate,
        inspectorName: form.inspectorName,
        inspectType: form.inspectType || undefined,
        samples: samples.map(s => ({
          sampleNo: s.sampleNo,
          measuredValue: s.measuredValue || undefined,
          specUpper: s.specUpper || undefined,
          specLower: s.specLower || undefined,
          passYn: s.passYn,
          remark: s.remark || undefined,
        })),
      });
      setForm({ orderNo: "", inspectDate: new Date().toISOString().slice(0, 10), inspectorName: "", inspectType: "" });
      setSamples([{ sampleNo: 1, measuredValue: "", specUpper: "", specLower: "", passYn: "Y", remark: "" }]);
      onCreated();
      onClose();
    } catch (e) {
      console.error("Sample inspect save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, samples, onCreated, onClose]);

  const failCount = samples.filter(s => s.passYn === "N").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("production.sampleInspect.inputTitle")} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <Select label={t("production.sampleInspect.orderNo")} options={joOptions}
            value={form.orderNo} onChange={v => setForm(p => ({ ...p, orderNo: v }))} fullWidth />
          <Input label={t("production.sampleInspect.inspectDate")} type="date"
            value={form.inspectDate} onChange={e => setForm(p => ({ ...p, inspectDate: e.target.value }))} fullWidth />
          <Input label={t("production.sampleInspect.inspector")}
            value={form.inspectorName} onChange={e => setForm(p => ({ ...p, inspectorName: e.target.value }))} fullWidth />
          <Input label={t("production.sampleInspect.inspectType")} placeholder={t("production.sampleInspect.inspectTypePlaceholder")}
            value={form.inspectType} onChange={e => setForm(p => ({ ...p, inspectType: e.target.value }))} fullWidth />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">
            {t("production.sampleInspect.sampleCount")}: {samples.length}
            {failCount > 0 && <span className="ml-2 text-red-600 dark:text-red-400">({t("production.sampleInspect.fail")}: {failCount})</span>}
          </span>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={removeSample}><Minus className="w-4 h-4" /></Button>
            <Button variant="secondary" size="sm" onClick={addSample}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-surface sticky top-0">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left w-14">#</th>
                <th className="px-3 py-2 text-left">{t("production.sampleInspect.measuredValue")}</th>
                <th className="px-3 py-2 text-left w-24">{t("production.sampleInspect.specLower")}</th>
                <th className="px-3 py-2 text-left w-24">{t("production.sampleInspect.specUpper")}</th>
                <th className="px-3 py-2 text-center w-20">{t("production.sampleInspect.judgment")}</th>
                <th className="px-3 py-2 text-left">{t("production.sampleInspect.remark")}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s, idx) => (
                <tr key={s.sampleNo} className={`border-b border-border ${s.passYn === "N" ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.sampleNo}</td>
                  <td className="px-3 py-1.5">
                    <input type="text" className="w-full px-2 py-1 text-sm border border-border rounded bg-white dark:bg-slate-800 text-text"
                      value={s.measuredValue} onChange={e => updateSample(idx, "measuredValue", e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" className="w-full px-2 py-1 text-sm border border-border rounded bg-white dark:bg-slate-800 text-text"
                      value={s.specLower} onChange={e => updateSample(idx, "specLower", e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" className="w-full px-2 py-1 text-sm border border-border rounded bg-white dark:bg-slate-800 text-text"
                      value={s.specUpper} onChange={e => updateSample(idx, "specUpper", e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <select className={`px-2 py-1 text-xs border border-border rounded ${s.passYn === "N" ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30" : "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30"}`}
                      value={s.passYn} onChange={e => updateSample(idx, "passYn", e.target.value)}>
                      <option value="Y">{t("production.sampleInspect.pass")}</option>
                      <option value="N">{t("production.sampleInspect.fail")}</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" className="w-full px-2 py-1 text-sm border border-border rounded bg-white dark:bg-slate-800 text-text"
                      value={s.remark} onChange={e => updateSample(idx, "remark", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.orderNo || !form.inspectorName}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </Modal>
  );
}
