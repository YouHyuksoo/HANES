"use client";

/**
 * @file src/app/(authenticated)/inspection/history/page.tsx
 * @description 검사 이력조회 페이지 - INSPECT_RESULTS 전체 검사유형 조회
 *
 * 초보자 가이드:
 * 1. GET /quality/inspect-results 로 전체 검사이력 조회
 * 2. 검사유형/합격여부/날짜/시리얼 필터
 * 3. 외관검사, 단자검사, 통전검사를 INSPECT_TYPE으로 구분 표시
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap, RefreshCw, Search, CheckCircle, XCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface InspectHistoryRow {
  resultNo: string;
  prodResultNo: string | null;
  inspectType: string;
  inspectScope: string | null;
  passYn: string;
  fgBarcode: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  inspectAt: string;
  inspectorId: string | null;
}

export default function InspectionHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InspectHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        limit: 5000,
      };
      if (typeFilter) params.inspectType = typeFilter;
      if (debouncedSearch) params.serialNo = debouncedSearch;
      if (resultFilter) params.passYn = resultFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;

      const res = await api.get("/quality/inspect-results", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const inspectTypeLabel = useMemo<Record<string, string>>(() => ({
    VISUAL: t("inspection.history.typeVisual", "외관검사"),
    TERMINAL: t("inspection.history.typeTerminal", "단자검사"),
    CONTINUITY: t("inspection.history.typeContinuity", "통전검사"),
  }), [t]);

  const inspectTypeClass = useMemo<Record<string, string>>(() => ({
    VISUAL: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    TERMINAL: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    CONTINUITY: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  }), []);

  const columns = useMemo<ColumnDef<InspectHistoryRow>[]>(() => [
    {
      accessorKey: "inspectAt", header: t("inspection.result.issuedAt", "검사시간"),
      size: 150,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
      },
    },
    {
      accessorKey: "inspectType", header: t("inspection.history.inspectType", "검사유형"),
      size: 110, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = String(getValue() ?? "").toUpperCase();
        if (!v) return <span className="text-text-muted">-</span>;
        return (
          <span className={`inline-flex h-6 items-center rounded border px-2 text-xs font-medium ${inspectTypeClass[v] ?? "border-border bg-surface text-text"}`}>
            {inspectTypeLabel[v] ?? v}
          </span>
        );
      },
    },
    {
      accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode", "FG 바코드"),
      size: 150, meta: { filterType: "text" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v
          ? <span className="font-mono text-xs text-primary">{v}</span>
          : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "passYn", header: t("quality.inspect.judgement", "판정"),
      size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === "Y"
          ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="w-4 h-4" />{t("quality.inspect.pass")}</span>
          : <span className="flex items-center gap-1 text-red-500 dark:text-red-400"><XCircle className="w-4 h-4" />{t("quality.inspect.fail")}</span>;
      },
    },
    {
      accessorKey: "errorCode", header: t("quality.inspect.mainDefectCode", "불량코드"),
      size: 100, meta: { filterType: "text" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="text-red-500 font-mono text-xs">{v}</span> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "errorDetail", header: t("quality.inspect.detailReason", "상세사유"),
      size: 200, meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span>,
    },
    {
      accessorKey: "inspectorId", header: t("quality.inspect.inspector", "검사원"),
      size: 100, meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span>,
    },
    {
      accessorKey: "inspectScope", header: t("master.part.inspectMethod", "검사구분"),
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v === "FULL" ? t("inspection.history.scopeFull", "전수") : v === "SAMPLE" ? t("inspection.history.scopeSample", "샘플") : v || "-";
      },
    },
  ], [inspectTypeClass, inspectTypeLabel, t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" />{t("inspection.history.title", "검사이력")}
          </h1>
          <p className="text-text-muted mt-1">{t("inspection.history.subtitle", "외관검사, 단자검사, 통전검사 이력 조회")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("inspection.history.title", "검사이력")}
            toolbarLeft={
              <div className="flex gap-2 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("quality.inspect.searchPlaceholder", "검색")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="flex items-center gap-1">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                  <span className="text-text-muted">~</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
                </div>
                <div className="w-44">
                  <ComCodeSelect groupCode="INSPECT_TYPE" labelPrefix={t("inspection.history.inspectType", "검사유형")}
                    value={typeFilter} onChange={setTypeFilter} fullWidth />
                </div>
                <ComCodeSelect groupCode="INSPECT_RESULT" labelPrefix={t('common.result', '결과')} value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
            }
          
          sqlQuery={`SELECT RESULT_NO, PROD_RESULT_NO, INSPECT_TYPE, INSPECT_SCOPE, PASS_YN,\n       FG_BARCODE, ERROR_CODE, ERROR_DETAIL, INSPECT_AT, INSPECTOR_ID\nFROM INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY INSPECT_AT DESC`}/>
        </CardContent>
      </Card>
    </div>
  );
}
