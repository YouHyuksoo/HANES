"use client";

/**
 * @file equipment/mold-mgmt/components/MoldUsageList.tsx
 * @description 금형 사용이력 목록 + 인라인 추가 폼
 *
 * 초보자 가이드:
 * 1. **사용이력**: 선택된 금형의 타수 이력을 표 형태로 표시
 * 2. **인라인 추가**: 하단 인라인 폼으로 신규 사용이력 등록
 * 3. API: GET /equipment/molds/:id, POST /equipment/molds/:id/usage
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, History, X } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { EquipSelect, WorkerSelect } from "@/components/shared";
import api from "@/services/api";

interface UsageRecord {
  usageDate: string;
  shotCount: number;
  orderNo: string;
  equipCode: string;
  workerCode: string;
  remark: string;
}

interface Props {
  mold: { moldCode: string; moldName: string };
}

interface UsageForm {
  usageDate: string;
  shotCount: string;
  orderNo: string;
  equipCode: string;
  workerCode: string;
  remark: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const INIT: UsageForm = {
  usageDate: today(), shotCount: "", orderNo: "",
  equipCode: "", workerCode: "", remark: "",
};

export default function MoldUsageList({ mold }: Props) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<UsageForm>(INIT);
  const [saving, setSaving] = useState(false);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/equipment/molds/${mold.moldCode}`);
      setRecords(res.data?.data?.usageHistory ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [mold.moldCode]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const setField = (key: keyof UsageForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleAdd = useCallback(async () => {
    if (!form.shotCount) return;
    setSaving(true);
    try {
      await api.post(`/equipment/molds/${mold.moldCode}/usage`, {
        usageDate: form.usageDate || undefined,
        shotCount: Number(form.shotCount) || 0,
        orderNo: form.orderNo || undefined,
        equipCode: form.equipCode || undefined,
        workerCode: form.workerCode || undefined,
        remark: form.remark || undefined,
      });
      setForm({ ...INIT, usageDate: today() });
      setShowForm(false);
      fetchUsage();
    } catch { /* api interceptor */ } finally {
      setSaving(false);
    }
  }, [form, mold.moldCode, fetchUsage]);

  return (
    <Card className="flex-shrink-0 max-h-[280px] overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            {t("equipment.mold.usageHistory")} - {mold.moldCode}
          </h3>
          <Button size="sm" variant="secondary"
            onClick={() => setShowForm(v => !v)}>
            {showForm ? <X className="w-3.5 h-3.5 mr-1" />
              : <Plus className="w-3.5 h-3.5 mr-1" />}
            {showForm ? t("common.cancel") : t("common.add")}
          </Button>
        </div>

        {/* 인라인 추가 폼 */}
        {showForm && (
          <div className="flex gap-2 items-end mb-3 flex-wrap border border-border rounded-lg p-3
            bg-surface dark:bg-slate-800">
            <Input label={t("equipment.mold.usageDate")} type="date" value={form.usageDate}
              onChange={e => setField("usageDate", e.target.value)} className="w-32" />
            <Input label={t("equipment.mold.shotCount")} type="number" value={form.shotCount}
              onChange={e => setField("shotCount", e.target.value)} className="w-24" />
            <Input label={t("equipment.mold.orderNo")} value={form.orderNo}
              onChange={e => setField("orderNo", e.target.value)} className="w-32" />
            <div className="w-32">
              <EquipSelect label={t("equipment.mold.equipCode")} value={form.equipCode}
                onChange={v => setField("equipCode", v)} fullWidth />
            </div>
            <div className="w-32">
              <WorkerSelect label={t("equipment.mold.worker")} value={form.workerCode}
                onChange={v => setField("workerCode", v)} fullWidth />
            </div>
            <Input label={t("common.remark")} value={form.remark}
              onChange={e => setField("remark", e.target.value)} className="w-32" />
            <Button size="sm" onClick={handleAdd} disabled={saving || !form.shotCount}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        )}

        {/* 이력 테이블 */}
        <div className="overflow-auto max-h-[160px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="border-b border-border bg-surface dark:bg-slate-800">
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("equipment.mold.usageDate")}</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">{t("equipment.mold.shotCount")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("equipment.mold.orderNo")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("equipment.mold.equipCode")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("equipment.mold.worker")}</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">{t("common.remark")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-4 text-text-muted">{t("common.loading")}</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-text-muted">{t("common.noData")}</td></tr>
              ) : records.map(r => (
                <tr key={`${r.usageDate}-${r.orderNo}`} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-1.5 text-text">{r.usageDate?.slice(0, 10)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text">{r.shotCount.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-text">{r.orderNo || "-"}</td>
                  <td className="px-3 py-1.5 text-text">{r.equipCode || "-"}</td>
                  <td className="px-3 py-1.5 text-text">{r.workerCode || "-"}</td>
                  <td className="px-3 py-1.5 text-text-muted">{r.remark || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
