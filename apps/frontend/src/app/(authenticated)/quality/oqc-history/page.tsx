"use client";

/**
 * @file src/app/(authenticated)/quality/oqc-history/page.tsx
 * @description OQC 출하검사 이력 조회 페이지 - 읽기전용 이력 조회
 *
 * 초보자 가이드:
 * 1. **목적**: 완료된 OQC 검사 이력 조회 전용
 * 2. **필터**: 날짜범위, 판정결과, 검색
 * 3. **통계**: 총건수, 합격, 불합격, 합격률
 * 4. API: GET /quality/oqc (status 필터로 PASS/FAIL만 조회)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, Search, RefreshCw, CheckCircle, XCircle, FileText, BarChart3 } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface OqcHistoryItem {
  id: string;
  requestNo: string;
  partId: string;
  customer: string | null;
  requestDate: string;
  totalBoxCount: number;
  totalQty: number;
  status: string;
  result: string | null;
  inspectorName: string | null;
  inspectDate: string | null;
  part?: { partCode?: string; partName?: string };
}

export default function OqcHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<OqcHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (resultFilter) params.status = resultFilter;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/quality/oqc", { params });
      // 완료된 건(PASS/FAIL)만 필터 (서버에서 status 필터링이 없으면 클라이언트 필터)
      const allData: OqcHistoryItem[] = res.data?.data ?? [];
      const filtered = resultFilter
        ? allData
        : allData.filter(d => d.status === "PASS" || d.status === "FAIL");
      setData(filtered);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, resultFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resultOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "PASS", label: t("quality.oqc.pass") },
    { value: "FAIL", label: t("quality.oqc.fail") },
  ], [t]);

  const stats = useMemo(() => {
    const total = data.length;
    const pass = data.filter(d => d.result === "PASS" || d.status === "PASS").length;
    const fail = data.filter(d => d.result === "FAIL" || d.status === "FAIL").length;
    return { total, pass, fail, passRate: total > 0 ? Math.round((pass / total) * 100) : 0 };
  }, [data]);

  const columns = useMemo<ColumnDef<OqcHistoryItem>[]>(() => [
    {
      accessorKey: "requestNo", header: t("quality.oqc.requestNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "requestDate", header: t("quality.oqc.requestDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleDateString() : "-";
      },
    },
    {
      accessorFn: (row) => row.part?.partCode, id: "partCode",
      header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorFn: (row) => row.part?.partName, id: "partName",
      header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "customer", header: t("quality.oqc.customer"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "totalBoxCount", header: t("quality.oqc.boxCount"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{getValue() as number}</span>,
    },
    {
      accessorKey: "totalQty", header: t("quality.oqc.totalQty"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "status", header: t("quality.oqc.result"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="OQC_STATUS" code={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("quality.oqc.inspector"), size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "inspectDate", header: t("quality.oqc.inspectDate"), size: 140,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("quality.oqc.historyTitle")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.oqc.historyDescription")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("quality.oqc.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("quality.oqc.statPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("quality.oqc.statFail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("quality.oqc.passRate")} value={`${stats.passRate}%`} icon={BarChart3} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("quality.oqc.historyTitle")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t("quality.oqc.searchPlaceholder")}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
              </div>
            </div>
          }
        />
      </CardContent></Card>
    </div>
  );
}
