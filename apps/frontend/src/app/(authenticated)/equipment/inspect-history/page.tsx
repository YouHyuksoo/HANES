"use client";

/**
 * @file src/app/(authenticated)/equipment/inspect-history/page.tsx
 * @description 점검이력조회 페이지 - 일상/정기 점검 이력 통합 조회 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **통합 조회**: 일상점검 + 정기점검 이력을 하나의 화면에서 조회
 * 2. **필터링**: 점검유형, 결과, 날짜 범위 등으로 필터링
 * 3. API: GET /equipment/inspect-history
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ScrollText, Search, RefreshCw,
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

interface InspectHistory {
  id: string;
  equipCode: string;
  equipName: string;
  inspectType: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
}

export default function InspectHistoryPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<InspectHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const comCodeTypeOptions = useComCodeOptions("INSPECT_CHECK_TYPE");
  const typeOptions = useMemo(() => [
    { value: "", label: t("equipment.inspectHistory.allType") },
    ...comCodeTypeOptions,
  ], [t, comCodeTypeOptions]);

  const comCodeResultOptions = useComCodeOptions("INSPECT_JUDGE");
  const resultOptions = useMemo(() => [
    { value: "", label: t("equipment.inspectHistory.allResult") },
    ...comCodeResultOptions,
  ], [t, comCodeResultOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      if (resultFilter) params.overallResult = resultFilter;
      if (dateFrom) params.inspectDateFrom = dateFrom;
      if (dateTo) params.inspectDateTo = dateTo;
      const res = await api.get("/equipment/inspect-history", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    pass: data.filter(d => d.overallResult === "PASS").length,
    fail: data.filter(d => d.overallResult === "FAIL").length,
    conditional: data.filter(d => d.overallResult === "CONDITIONAL").length,
  }), [data]);

  const columns = useMemo<ColumnDef<InspectHistory>[]>(() => [
    { accessorKey: "inspectDate", header: t("equipment.inspectHistory.inspectDate"), size: 110 },
    {
      accessorKey: "inspectType", header: t("equipment.inspectHistory.inspectType"), size: 80,
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_CHECK_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "equipCode", header: t("equipment.inspectHistory.equipCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "equipName", header: t("equipment.inspectHistory.equipName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "inspectorName", header: t("equipment.inspectHistory.inspector"), size: 90,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "overallResult", header: t("equipment.inspectHistory.result"), size: 90,
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_JUDGE" code={getValue() as string} />,
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ScrollText className="w-7 h-7 text-primary" />{t("equipment.inspectHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.inspectHistory.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("equipment.inspectHistory.statTotal")} value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label={t("equipment.inspectHistory.resultPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.inspectHistory.resultFail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("equipment.inspectHistory.resultConditional")} value={stats.conditional} icon={AlertTriangle} color="yellow" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.inspectHistory.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.inspectHistory.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
