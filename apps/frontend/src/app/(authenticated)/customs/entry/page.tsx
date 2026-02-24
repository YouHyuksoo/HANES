"use client";

/**
 * @file src/app/(authenticated)/customs/entry/page.tsx
 * @description 보세 수입신고 관리 페이지
 *
 * 초보자 가이드:
 * 1. **수입신고**: 보세구역으로 들어오는 자재의 통관 절차 관리
 * 2. **상태 흐름**: PENDING(대기) -> CLEARED(통관) -> RELEASED(반출)
 * 3. API: GET/POST/PUT /customs/entries
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Eye, RefreshCw, FileText, Search, CheckCircle, Package, Layers } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface CustomsEntry {
  id: string;
  entryNo: string;
  blNo: string;
  invoiceNo: string;
  declarationDate: string;
  clearanceDate: string | null;
  origin: string;
  hsCode: string;
  totalAmount: number;
  currency: string;
  status: string;
  lotCount: number;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  CLEARED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  RELEASED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function CustomsEntryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusLabels: Record<string, string> = useMemo(() => ({
    PENDING: t("customs.entry.statusPending"),
    CLEARED: t("customs.entry.statusCleared"),
    RELEASED: t("customs.entry.statusReleased"),
  }), [t]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CustomsEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ entryNo: "", blNo: "", invoiceNo: "", origin: "", hsCode: "", totalAmount: "", currency: "USD", declarationDate: "", clearanceDate: "", status: "PENDING" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      const res = await api.get("/customs/entries", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = useCallback((entry: CustomsEntry) => {
    setSelectedEntry(entry);
    setForm({ entryNo: entry.entryNo, blNo: entry.blNo, invoiceNo: entry.invoiceNo, origin: entry.origin, hsCode: entry.hsCode, totalAmount: String(entry.totalAmount), currency: entry.currency, declarationDate: entry.declarationDate, clearanceDate: entry.clearanceDate || "", status: entry.status });
    setIsModalOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setSelectedEntry(null);
    setForm({ entryNo: "", blNo: "", invoiceNo: "", origin: "", hsCode: "", totalAmount: "", currency: "USD", declarationDate: "", clearanceDate: "", status: "PENDING" });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (selectedEntry) {
        await api.put(`/customs/entries/${selectedEntry.id}`, form);
      } else {
        await api.post("/customs/entries", form);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedEntry, form, fetchData]);

  const stats = useMemo(() => ({
    pending: data.filter((d) => d.status === "PENDING").length,
    cleared: data.filter((d) => d.status === "CLEARED").length,
    released: data.filter((d) => d.status === "RELEASED").length,
    totalLots: data.reduce((s, d) => s + d.lotCount, 0),
  }), [data]);

  const columns = useMemo<ColumnDef<CustomsEntry>[]>(() => [
    { accessorKey: "entryNo", header: t("customs.entry.entryNo"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "blNo", header: t("customs.entry.blNo"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "invoiceNo", header: t("customs.entry.invoiceNo"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "declarationDate", header: t("customs.entry.declarationDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "clearanceDate", header: t("customs.entry.clearanceDate"), size: 100, meta: { filterType: "date" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "origin", header: t("customs.entry.origin"), size: 70, meta: { filterType: "text" as const } },
    { accessorKey: "hsCode", header: t("customs.entry.hsCode"), size: 90, meta: { filterType: "text" as const } },
    { accessorKey: "totalAmount", header: t("customs.entry.amount"), size: 100, meta: { filterType: "number" as const }, cell: ({ row }) => `${row.original.totalAmount.toLocaleString()} ${row.original.currency}` },
    {
      accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => { const s = getValue() as string; return <span className={`px-2 py-1 text-xs rounded-full ${statusColors[s]}`}>{statusLabels[s]}</span>; },
    },
    { accessorKey: "lotCount", header: t("customs.entry.lotCount"), size: 70, meta: { filterType: "number" as const } },
    {
      id: "actions", header: t("common.manage"), size: 100, meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}><Edit2 className="w-4 h-4 text-primary" /></button>
        </div>
      ),
    },
  ], [t, statusLabels, openEdit]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />{t("customs.entry.title")}</h1>
          <p className="text-text-muted mt-1">{t("customs.entry.description")}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> {t("customs.entry.register")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("customs.entry.statusPending")} value={stats.pending} icon={FileText} color="yellow" />
        <StatCard label={t("customs.entry.statusCleared")} value={stats.cleared} icon={CheckCircle} color="blue" />
        <StatCard label={t("customs.entry.statusReleased")} value={stats.released} icon={Package} color="green" />
        <StatCard label={t("customs.entry.bondedLot")} value={stats.totalLots} icon={Layers} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("customs.entry.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("customs.entry.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEntry ? t("customs.entry.detail") : t("customs.entry.register")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("customs.entry.entryNo")} placeholder="IMP20250125001" value={form.entryNo} onChange={(e) => setForm((p) => ({ ...p, entryNo: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.blNo")} placeholder="MSCU1234567" value={form.blNo} onChange={(e) => setForm((p) => ({ ...p, blNo: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.invoiceNo")} placeholder="INV-2025-001" value={form.invoiceNo} onChange={(e) => setForm((p) => ({ ...p, invoiceNo: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.origin")} placeholder="CN" value={form.origin} onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.hsCode")} placeholder="8544.30" value={form.hsCode} onChange={(e) => setForm((p) => ({ ...p, hsCode: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.amount")} type="number" placeholder="15000" value={form.totalAmount} onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.currency")} placeholder="USD" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.declarationDate")} type="date" value={form.declarationDate} onChange={(e) => setForm((p) => ({ ...p, declarationDate: e.target.value }))} fullWidth />
          <Input label={t("customs.entry.clearanceDate")} type="date" value={form.clearanceDate} onChange={(e) => setForm((p) => ({ ...p, clearanceDate: e.target.value }))} fullWidth />
          <Select label={t("common.status")} options={[{ value: "PENDING", label: t("customs.entry.statusPending") }, { value: "CLEARED", label: t("customs.entry.statusCleared") }, { value: "RELEASED", label: t("customs.entry.statusReleased") }]} value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : selectedEntry ? t("common.edit") : t("common.register")}</Button>
        </div>
      </Modal>
    </div>
  );
}
