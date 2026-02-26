"use client";

/**
 * @file src/app/(authenticated)/customs/usage/page.tsx
 * @description 보세 자재 사용신고 페이지
 *
 * 초보자 가이드:
 * 1. **사용신고**: 보세 자재 사용 내역을 세관에 신고
 * 2. **상태**: DRAFT(작성), REPORTED(신고), CONFIRMED(확인)
 * 3. API: GET/POST/PUT /customs/usage
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Search, Send, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface UsageReport {
  id: string;
  reportNo: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  usageQty: number;
  usageDate: string;
  reportDate: string | null;
  jobOrderNo: string | null;
  status: string;
  workerName: string;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  REPORTED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function CustomsUsagePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusLabels: Record<string, string> = useMemo(() => ({
    DRAFT: t("customs.usage.statusDraft"),
    REPORTED: t("customs.usage.statusReported"),
    CONFIRMED: t("customs.usage.statusConfirmed"),
  }), [t]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ lotNo: "", usageQty: "", jobOrderNo: "", remark: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      const res = await api.get("/customs/usage", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/customs/usage", form);
      setIsModalOpen(false);
      setForm({ lotNo: "", usageQty: "", jobOrderNo: "", remark: "" });
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const handleReport = useCallback(async (id: string) => {
    try {
      await api.put(`/customs/usage/${id}/report`);
      fetchData();
    } catch (e) {
      console.error("Report failed:", e);
    }
  }, [fetchData]);

  const handleConfirm = useCallback(async (id: string) => {
    try {
      await api.put(`/customs/usage/${id}/confirm`);
      fetchData();
    } catch (e) {
      console.error("Confirm failed:", e);
    }
  }, [fetchData]);

  const columns = useMemo<ColumnDef<UsageReport>[]>(() => [
    { accessorKey: "reportNo", header: t("customs.usage.reportNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "lotNo", header: t("customs.stock.lotNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "usageQty", header: t("customs.usage.usageQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "usageDate", header: t("customs.usage.usageDate"), size: 130, meta: { filterType: "date" as const } },
    { accessorKey: "reportDate", header: t("customs.usage.reportDate"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "jobOrderNo", header: t("customs.usage.jobOrder"), size: 110, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => { const status = getValue() as string; return <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>{statusLabels[status]}</span>; },
    },
    { accessorKey: "workerName", header: t("customs.usage.worker"), size: 80, meta: { filterType: "text" as const } },
    {
      id: "actions", header: t("common.manage"), size: 80, meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === "DRAFT" && (
            <button onClick={() => handleReport(row.original.id)} className="p-1 hover:bg-surface rounded" title={t("customs.usage.report")}><Send className="w-4 h-4 text-primary" /></button>
          )}
          {row.original.status === "REPORTED" && (
            <button onClick={() => handleConfirm(row.original.id)} className="p-1 hover:bg-surface rounded" title={t("customs.usage.confirm")}><CheckCircle className="w-4 h-4 text-green-500" /></button>
          )}
        </div>
      ),
    },
  ], [t, statusLabels, handleReport, handleConfirm]);

  const stats = useMemo(() => ({
    total: data.length,
    draft: data.filter((d) => d.status === "DRAFT").length,
    reported: data.filter((d) => d.status === "REPORTED").length,
    confirmed: data.filter((d) => d.status === "CONFIRMED").length,
  }), [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Send className="w-7 h-7 text-primary" />{t("customs.usage.title")}</h1>
          <p className="text-text-muted mt-1">{t("customs.usage.description")}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t("customs.usage.registerUsage")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("customs.usage.statusDraft")} value={stats.draft} icon={Clock} color="gray" />
        <StatCard label={t("customs.usage.statusReported")} value={stats.reported} icon={Send} color="blue" />
        <StatCard label={t("customs.usage.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("customs.usage.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("customs.usage.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("customs.usage.registerUsage")} size="lg">
        <div className="space-y-4">
          <Input label={t("customs.stock.lotNo")} placeholder="LOT250125-001" value={form.lotNo} onChange={(e) => setForm((p) => ({ ...p, lotNo: e.target.value }))} fullWidth />
          <Input label={t("customs.usage.usageQty")} type="number" placeholder="100" value={form.usageQty} onChange={(e) => setForm((p) => ({ ...p, usageQty: e.target.value }))} fullWidth />
          <Input label={t("customs.usage.jobOrder")} placeholder="JO-2025-001" value={form.jobOrderNo} onChange={(e) => setForm((p) => ({ ...p, jobOrderNo: e.target.value }))} fullWidth />
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")} value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("customs.usage.registerAndReport")}</Button>
        </div>
      </Modal>
    </div>
  );
}
