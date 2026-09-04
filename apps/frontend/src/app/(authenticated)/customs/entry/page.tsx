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
import { Plus, Eye, RefreshCw, FileText, Search, CheckCircle, Package, Layers } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, StatCard } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import { createCustomsEntryGridColumns, type CustomsEntry } from "./customsEntryColumns";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";

/** 서버 페이지당 건수 */
const PAGE_SIZE = 50;

export default function CustomsEntryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomsEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CustomsEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // 이력성 조회 — 조건 없는 전량 조회 금지: 기본 신고일 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [form, setForm] = useState({ entryNo: "", blNo: "", invoiceNo: "", origin: "", hsCode: "", totalAmount: "", currency: "USD", declarationDate: "", clearanceDate: "", status: "PENDING" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchTerm) params.search = searchTerm;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/customs/entries", { params });
      setData(res.data?.data ?? []);
      setTotal(res.data?.meta?.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, fromDate, toDate, page]);

  useEffect(() => { setPage(1); }, [searchTerm, fromDate, toDate]);
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
        await api.put(`/customs/entries/${selectedEntry.entryNo}`, form);
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

  const columns = useMemo(() => createCustomsEntryGridColumns({ t, onEditEntry: openEdit }), [t, openEdit]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />{t("customs.entry.title")}</h1>
          <p className="text-text-muted mt-1">{t("customs.entry.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> {t("customs.entry.register")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("customs.entry.statusPending")} value={stats.pending} icon={FileText} color="yellow" />
        <StatCard label={t("customs.entry.statusCleared")} value={stats.cleared} icon={CheckCircle} color="blue" />
        <StatCard label={t("customs.entry.statusReleased")} value={stats.released} icon={Package} color="green" />
        <StatCard label={t("customs.entry.bondedLot")} value={stats.totalLots} icon={Layers} color="purple" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          pageSize={PAGE_SIZE}
          enableColumnFilter
          enableExport
          exportFileName={t("customs.entry.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("customs.entry.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} className="flex-shrink-0" />
              <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} disabled={loading} className="flex-shrink-0" />
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM CUSTOMS_ENTRIES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
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
          <ComCodeSelect groupCode="CUSTOMS_ENTRY_STATUS" includeAll={false} label={t("common.status")} value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("common.save", "저장")}</Button>
        </div>
      </Modal>
    </div>
  );
}
