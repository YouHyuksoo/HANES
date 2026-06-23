"use client";

/**
 * @file src/app/(authenticated)/production/result-summary/page.tsx
 * @description 작업실적 통합 조회 - 완제품별 계획/양품/불량/양품률 통합 집계
 *
 * 초보자 가이드:
 * 1. **목적**: 완제품 기준으로 전체 공정 실적을 한눈에 확인
 * 2. **데이터**: prod-results를 품목별 GROUP BY 집계
 * 3. **지표**: 계획달성률, 양품률, 불량률 등
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, BarChart3 } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";

interface ProductSummary {
  itemCode: string;
  itemName: string;
  itemType: string;
  lineCode: string;
  totalPlanQty: number;
  totalGoodQty: number;
  totalDefectQty: number;
  totalQty: number;
  defectRate: number;
  yieldRate: number;
  achieveRate: number;
  orderCount: number;
  resultCount: number;
}

export default function ResultSummaryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/production/prod-results/summary/by-product", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rateCell = (value: number, good: boolean) => {
    const cls = good
      ? value >= 95 ? "text-green-600 dark:text-green-400" : value >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
      : value <= 2 ? "text-green-600 dark:text-green-400" : value <= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
    return <span className={`font-medium ${cls}`}>{value}%</span>;
  };

  const columns = useMemo<ColumnDef<ProductSummary>[]>(() => [
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 160,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemType", header: t("production.resultSummary.partType"), size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const cls = v === "FINISHED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : v === "SEMI_PRODUCT" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
        const label = v === "FINISHED" ? t("production.order.itemTypeFG", "완제품")
          : v === "SEMI_PRODUCT" ? t("production.order.itemTypeWIP", "반제품")
          : v || "-";
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{label}</span>;
      },
    },
    {
      accessorKey: "lineCode", header: t("production.progress.line"), size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "totalPlanQty", header: t("production.resultSummary.planQty"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span>{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "totalGoodQty", header: t("production.resultSummary.goodQty"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400 font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "totalDefectQty", header: t("production.resultSummary.defectQty"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className={v > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-text-muted"}>{v.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "achieveRate", header: t("production.resultSummary.achieveRate"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => rateCell(getValue() as number, true),
    },
    {
      accessorKey: "yieldRate", header: t("production.resultSummary.yieldRate"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => rateCell(getValue() as number, true),
    },
    {
      accessorKey: "defectRate", header: t("production.resultSummary.defectRate"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => rateCell(getValue() as number, false),
    },
    {
      accessorKey: "orderCount", header: t("production.resultSummary.orderCount"), size: 70,
      meta: { filterType: "number" as const, align: "center" as const },
      cell: ({ getValue }) => <span className="text-text-muted">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            {t("production.resultSummary.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("production.resultSummary.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("production.resultSummary.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("production.resultSummary.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter from={fromDate} to={toDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM PROD_RESULT_SUMMARIES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
