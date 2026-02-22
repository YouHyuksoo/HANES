"use client";

/**
 * @file src/app/(authenticated)/material/iqc-history/page.tsx
 * @description IQC 이력조회 페이지 - 수입검사 결과 조회 전용
 *
 * 초보자 가이드:
 * 1. **IQC**: Incoming Quality Control (수입검사)
 * 2. **결과**: PASS(합격), FAIL(불합격)
 * 3. API: GET /material/iqc-history
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Search, RefreshCw, CheckCircle, XCircle, FileText, BarChart3 } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface IqcHistoryItem {
  id: string;
  lotNo?: string;
  partCode?: string;
  partName?: string;
  unit?: string;
  inspectType: string;
  result: string;
  inspectorName?: string;
  inspectDate: string;
  remark?: string;
}

const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const typeColors: Record<string, string> = {
  INITIAL: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  RETEST: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function IqcHistoryPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<IqcHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (resultFilter) params.result = resultFilter;
      if (typeFilter) params.inspectType = typeFilter;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/material/iqc-history", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, resultFilter, typeFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resultOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "PASS", label: t("material.iqcHistory.pass") },
    { value: "FAIL", label: t("material.iqcHistory.fail") },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "INITIAL", label: t("material.iqcHistory.initial") },
    { value: "RETEST", label: t("material.iqcHistory.retest") },
  ], [t]);

  const stats = useMemo(() => {
    const total = data.length;
    const pass = data.filter(d => d.result === "PASS").length;
    const fail = data.filter(d => d.result === "FAIL").length;
    return { total, pass, fail, passRate: total > 0 ? Math.round((pass / total) * 100) : 0 };
  }, [data]);

  const columns = useMemo<ColumnDef<IqcHistoryItem>[]>(() => [
    {
      accessorKey: "inspectDate", header: t("material.iqcHistory.inspectDate"), size: 140,
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "lotNo", header: "LOT No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
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
      accessorKey: "inspectType", header: t("material.iqcHistory.inspectType"), size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[v] || ""}`}>{v}</span>;
      },
    },
    {
      accessorKey: "result", header: t("material.iqcHistory.result"), size: 80,
      cell: ({ getValue }) => {
        const r = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultColors[r] || ""}`}>{r}</span>;
      },
    },
    {
      accessorKey: "inspectorName", header: t("material.iqcHistory.inspector"), size: 90,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("material.iqcHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.iqcHistory.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.iqcHistory.stats.total")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("material.iqcHistory.stats.pass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("material.iqcHistory.stats.fail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("material.iqcHistory.stats.passRate")} value={`${stats.passRate}%`} icon={BarChart3} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.iqcHistory.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.iqcHistory.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={resultOptions}
                  value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={typeOptions}
                  value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
