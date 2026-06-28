"use client";

/**
 * @file src/app/(authenticated)/material/adjustment/page.tsx
 * @description 재고보정 페이지 - 재고 수량 수동 보정
 *
 * 초보자 가이드:
 * 1. **보정**: 시스템 수량과 실제 수량 차이를 수동으로 조정
 * 2. **이력**: InvAdjLog에 보정 전후 수량과 사유 기록
 * 3. API: GET /material/adjustment, POST /material/adjustment
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SlidersHorizontal, Search, RefreshCw, Plus, TrendingUp, TrendingDown,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createAdjustmentGridColumns, type AdjustmentRecord } from "./adjustmentColumns";

export default function AdjustmentPage() {
  const { t } = useTranslation();
  const { options: warehouseOpts } = useWarehouseOptions();

  const [data, setData] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => getTodayLocal());
  const [endDate, setEndDate] = useState(() => getTodayLocal());
  const [showRegister, setShowRegister] = useState(false);

  const [form, setForm] = useState({ warehouseCode: "", itemCode: "", afterQty: "", reason: "" });
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<{ itemCode: string; itemName: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/material/adjustment", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchParts = useCallback(async (keyword: string) => {
    if (!keyword || keyword.length < 2) { setPartResults([]); return; }
    try {
      const res = await api.get("/master/parts", { params: { search: keyword, limit: 20 } });
      setPartResults((res.data?.data ?? []).map((p: any) => ({
        itemCode: p.itemCode, itemName: p.itemName,
      })));
    } catch { setPartResults([]); }
  }, []);

  const warehouseOptions = useMemo(() => [
    { value: "", label: t("common.select") }, ...warehouseOpts,
  ], [t, warehouseOpts]);

  const stats = useMemo(() => ({
    total: data.length,
    increase: data.filter(d => d.diffQty > 0).length,
    decrease: data.filter(d => d.diffQty < 0).length,
  }), [data]);

  const selectedPart = useMemo(() =>
    partResults.find(p => p.itemCode === form.itemCode), [partResults, form.itemCode]);

  const handleRegister = useCallback(async () => {
    if (!form.warehouseCode || !form.itemCode || !form.afterQty || !form.reason) return;
    setSaving(true);
    try {
      await api.post("/material/adjustment", {
        warehouseCode: form.warehouseCode,
        itemCode: form.itemCode,
        afterQty: Number(form.afterQty),
        reason: form.reason,
      });
      setShowRegister(false);
      setForm({ warehouseCode: "", itemCode: "", afterQty: "", reason: "" });
      setPartSearch("");
      setPartResults([]);
      fetchData();
    } catch (e) {
      console.error("Adjustment failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const columns = useMemo(() => createAdjustmentGridColumns({ t }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <SlidersHorizontal className="w-7 h-7 text-primary" />
            {t("material.adjustment.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.adjustment.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => setShowRegister(true)}>
            <Plus className="w-4 h-4 mr-1" />{t("material.adjustment.register")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("material.adjustment.stats.total")} value={stats.total} icon={SlidersHorizontal} color="blue" />
        <StatCard label={t("material.adjustment.stats.increase")} value={stats.increase} icon={TrendingUp} color="green" />
        <StatCard label={t("material.adjustment.stats.decrease")} value={stats.decrease} icon={TrendingDown} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.adjustment.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.adjustment.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter
                from={startDate}
                to={endDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
                className="flex-shrink-0"
              />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM MAT_ADJUSTMENTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)}
        title={t("material.adjustment.register")} size="lg">
        <div className="space-y-4">
          <Select label={t("material.adjustment.warehouse")} options={warehouseOptions}
            value={form.warehouseCode} onChange={v => setForm(p => ({ ...p, warehouseCode: v }))} fullWidth />
          <div>
            <Input label={t("material.adjustment.partSearch")}
              placeholder={t("material.adjustment.partSearchPlaceholder")}
              value={partSearch}
              onChange={e => { setPartSearch(e.target.value); searchParts(e.target.value); }}
              fullWidth />
            {partResults.length > 0 && !form.itemCode && (
              <div className="mt-1 border border-border rounded-lg max-h-40 overflow-y-auto bg-surface">
                {partResults.map(p => (
                  <button key={p.itemCode} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt dark:hover:bg-surface-alt transition-colors border-b border-border last:border-b-0"
                    onClick={() => { setForm(prev => ({ ...prev, itemCode: p.itemCode })); setPartSearch(`${p.itemCode} - ${p.itemName}`); }}>
                    <span className="font-mono text-primary">{p.itemCode}</span> — {p.itemName}
                  </button>
                ))}
              </div>
            )}
            {selectedPart && (
              <p className="mt-1 text-xs text-text-muted">
                {t("common.select")}: <span className="font-mono">{selectedPart.itemCode}</span> — {selectedPart.itemName}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <QtyInput label={t("material.adjustment.afterQty")} placeholder="0"
              value={Number(form.afterQty) || 0} onChange={n => setForm(p => ({ ...p, afterQty: n ? String(n) : "" }))} fullWidth />
            <Input label={t("material.adjustment.reason")} placeholder={t("material.adjustment.reasonPlaceholder")}
              value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setShowRegister(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleRegister}
            disabled={saving || !form.warehouseCode || !form.itemCode || !form.afterQty || !form.reason}>
            {saving ? t("common.saving") : t("material.adjustment.register")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
