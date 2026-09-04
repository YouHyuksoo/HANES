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
import { QtyInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createCustomsUsageGridColumns, type UsageReport } from "./customsUsageColumns";

/** 서버 페이지당 건수 */
const PAGE_SIZE = 50;

export default function CustomsUsagePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<UsageReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // 이력성 조회 — 조건 없는 전량 조회 금지: 기본 사용일 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [form, setForm] = useState({ lotEntryNo: "", lotMatUid: "", usageQty: "", jobOrderNo: "", remark: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchTerm) params.search = searchTerm;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/customs/usage", { params });
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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/customs/usage", form);
      setIsModalOpen(false);
      setForm({ lotEntryNo: "", lotMatUid: "", usageQty: "", jobOrderNo: "", remark: "" });
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const handleReport = useCallback(async (reportNo: string) => {
    try {
      await api.put(`/customs/usage/${reportNo}`, { status: 'REPORTED' });
      fetchData();
    } catch (e) {
      console.error("Report failed:", e);
    }
  }, [fetchData]);

  const handleConfirm = useCallback(async (reportNo: string) => {
    try {
      await api.put(`/customs/usage/${reportNo}`, { status: 'CONFIRMED' });
      fetchData();
    } catch (e) {
      console.error("Confirm failed:", e);
    }
  }, [fetchData]);

  const columns = useMemo(() => createCustomsUsageGridColumns({
    t,
    onReport: handleReport,
    onConfirm: handleConfirm,
  }), [t, handleReport, handleConfirm]);

  const stats = useMemo(() => ({
    total: data.length,
    draft: data.filter((d) => d.status === "DRAFT").length,
    reported: data.filter((d) => d.status === "REPORTED").length,
    confirmed: data.filter((d) => d.status === "CONFIRMED").length,
  }), [data]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Send className="w-7 h-7 text-primary" />{t("customs.usage.title")}</h1>
          <p className="text-text-muted mt-1">{t("customs.usage.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("customs.usage.registerUsage")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("customs.usage.statusDraft")} value={stats.draft} icon={Clock} color="gray" />
        <StatCard label={t("customs.usage.statusReported")} value={stats.reported} icon={Send} color="blue" />
        <StatCard label={t("customs.usage.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          pageSize={PAGE_SIZE}
          enableColumnFilter
          enableExport
          exportFileName={t("customs.usage.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("customs.usage.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} className="flex-shrink-0" />
              <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} disabled={loading} className="flex-shrink-0" />
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM CUSTOMS_USAGE\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("customs.usage.registerUsage")} size="lg">
        <div className="space-y-4">
          <Input label={t("customs.entry.entryNo")} placeholder="IMP20250125001" value={form.lotEntryNo} onChange={(e) => setForm((p) => ({ ...p, lotEntryNo: e.target.value }))} fullWidth />
          <Input label={t("customs.stock.matUid")} placeholder="MAT250125-001" value={form.lotMatUid} onChange={(e) => setForm((p) => ({ ...p, lotMatUid: e.target.value }))} fullWidth />
          <QtyInput label={t("customs.usage.usageQty")} placeholder="100" value={Number(form.usageQty) || 0} onChange={(n) => setForm((p) => ({ ...p, usageQty: n ? String(n) : "" }))} fullWidth />
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
