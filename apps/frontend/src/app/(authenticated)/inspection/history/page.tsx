"use client";

/**
 * @file src/app/(authenticated)/inspection/history/page.tsx
 * @description 통전검사 이력조회 페이지 - INSPECT_RESULTS (inspectType=CONTINUITY) 조회
 *
 * 초보자 가이드:
 * 1. GET /quality/inspect-results?inspectType=CONTINUITY 로 검사이력 조회
 * 2. 합격/불합격 전체 이력 표시 + 날짜/판정 필터
 * 3. 합격건은 FG_BARCODE 연결 표시
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap, RefreshCw, Search, CheckCircle, XCircle, TrendingUp, Activity,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
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
        inspectType: "CONTINUITY",
        limit: 5000,
      };
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
  }, [debouncedSearch, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = data.length;
    const passed = data.filter((r) => r.passYn === "Y").length;
    const failed = total - passed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";
    return { total, passed, failed, passRate };
  }, [data]);

  const resultOptions = useMemo(() => [
    { value: "", label: t("quality.inspect.resultAll", "판정: 전체") },
    { value: "Y", label: t("quality.inspect.pass", "합격") },
    { value: "N", label: t("quality.inspect.fail", "불합격") },
  ], [t]);

  const columns = useMemo<ColumnDef<InspectHistoryRow>[]>(() => [
    {
      accessorKey: "inspectAt", header: t("inspection.result.issuedAt", "검사시간"),
      size: 150,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
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
      accessorKey: "inspectScope", header: t("master.part.inspectMethod", "검사방법"),
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v === "FULL" ? "전수" : v === "SAMPLE" ? "샘플" : v || "-";
      },
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" />{t("menu.inspection.history", "통전검사이력")}
          </h1>
          <p className="text-text-muted mt-1">{t("inspection.result.continuity", "통전검사")} {t("quality.inspect.subtitle", "이력 조회")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("quality.inspect.totalCount", "총 건수")} value={`${stats.total}`} icon={Activity} color="blue" />
        <StatCard label={t("quality.inspect.pass", "합격")} value={`${stats.passed}`} icon={CheckCircle} color="green" />
        <StatCard label={t("quality.inspect.fail", "불합격")} value={`${stats.failed}`} icon={XCircle} color="red" />
        <StatCard label={t("quality.inspect.passRate", "합격률")} value={`${stats.passRate}%`} icon={TrendingUp} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("menu.inspection.history", "통전검사이력")}
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
                <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
