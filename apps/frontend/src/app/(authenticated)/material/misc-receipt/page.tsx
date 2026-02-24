"use client";

/**
 * @file src/app/(authenticated)/material/misc-receipt/page.tsx
 * @description 기타입고 페이지 - PO 없는 기타 사유 입고 처리
 *
 * 초보자 가이드:
 * 1. **기타입고**: 정규 발주 외 입고 (반품, 무상공급, 테스트용 등)
 * 2. **StockTransaction**: MISC_IN 유형으로 기록
 * 3. API: GET /material/misc-receipt, POST /material/misc-receipt
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PackagePlus, Search, RefreshCw, Plus } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface MiscReceiptRecord {
  id: string;
  transNo: string;
  partCode: string;
  partName: string;
  warehouseName: string;
  qty: number;
  unit: string;
  remark: string;
  transDate: string;
}

export default function MiscReceiptPage() {
  const { t } = useTranslation();
  const { options: warehouseOpts } = useWarehouseOptions();

  const [data, setData] = useState<MiscReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  // 등록 폼
  const [form, setForm] = useState({
    warehouseId: "",
    partId: "",
    qty: "",
    remark: "",
  });
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<{ id: string; partCode: string; partName: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/material/misc-receipt", { params });
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
        id: p.id, partCode: p.partCode, partName: p.partName,
      })));
    } catch { setPartResults([]); }
  }, []);

  const stats = useMemo(() => ({
    total: data.length,
    totalQty: data.reduce((s, d) => s + d.qty, 0),
  }), [data]);

  const warehouseOptions = useMemo(() => [
    { value: "", label: t("common.select") }, ...warehouseOpts,
  ], [t, warehouseOpts]);

  const handleRegister = useCallback(async () => {
    if (!form.warehouseId || !form.partId || !form.qty) return;
    setSaving(true);
    try {
      await api.post("/material/misc-receipt", {
        warehouseId: form.warehouseId,
        partId: form.partId,
        qty: Number(form.qty),
        remark: form.remark,
      });
      setShowRegister(false);
      setForm({ warehouseId: "", partId: "", qty: "", remark: "" });
      setPartSearch("");
      setPartResults([]);
      fetchData();
    } catch (e) {
      console.error("Misc receipt failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const selectedPart = useMemo(() =>
    partResults.find(p => p.id === form.partId), [partResults, form.partId]);

  const columns = useMemo<ColumnDef<MiscReceiptRecord>[]>(() => [
    {
      accessorKey: "transDate", header: t("material.miscReceipt.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("material.miscReceipt.transNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "partName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "warehouseName", header: t("material.miscReceipt.warehouse"), size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "qty", header: t("material.miscReceipt.qty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">
          +{row.original.qty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "remark", header: t("material.miscReceipt.remark"), size: 180,
      meta: { filterType: "text" as const },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-primary" />
            {t("material.miscReceipt.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.miscReceipt.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setShowRegister(true)}>
          <Plus className="w-4 h-4 mr-1" />{t("material.miscReceipt.register")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("material.miscReceipt.stats.total")} value={stats.total} icon={PackagePlus} color="blue" />
        <StatCard label={t("material.miscReceipt.stats.totalQty")} value={stats.totalQty.toLocaleString()} icon={PackagePlus} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.miscReceipt.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.miscReceipt.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)}
        title={t("material.miscReceipt.register")} size="lg">
        <div className="space-y-4">
          <Select label={t("material.miscReceipt.warehouse")} options={warehouseOptions}
            value={form.warehouseId} onChange={v => setForm(p => ({ ...p, warehouseId: v }))} fullWidth />

          <div>
            <Input label={t("material.miscReceipt.partSearch")}
              placeholder={t("material.miscReceipt.partSearchPlaceholder")}
              value={partSearch}
              onChange={e => { setPartSearch(e.target.value); searchParts(e.target.value); }}
              fullWidth />
            {partResults.length > 0 && !form.partId && (
              <div className="mt-1 border border-border rounded-lg max-h-40 overflow-y-auto bg-surface">
                {partResults.map(p => (
                  <button key={p.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt dark:hover:bg-surface-alt transition-colors border-b border-border last:border-b-0"
                    onClick={() => { setForm(prev => ({ ...prev, partId: p.id })); setPartSearch(`${p.partCode} - ${p.partName}`); }}>
                    <span className="font-mono text-primary">{p.partCode}</span> — {p.partName}
                  </button>
                ))}
              </div>
            )}
            {selectedPart && (
              <p className="mt-1 text-xs text-text-muted">
                {t("common.select")}: <span className="font-mono">{selectedPart.partCode}</span> — {selectedPart.partName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label={t("material.miscReceipt.qty")} type="number" placeholder="0"
              value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} fullWidth />
            <Input label={t("material.miscReceipt.remark")} placeholder={t("material.miscReceipt.remarkPlaceholder")}
              value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setShowRegister(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleRegister}
            disabled={saving || !form.warehouseId || !form.partId || !form.qty || Number(form.qty) <= 0}>
            {saving ? t("common.saving") : t("material.miscReceipt.register")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
