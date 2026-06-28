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
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createResultSummaryGridColumns } from "./resultSummaryColumns";
import type { ProductSummary } from "./types";

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

  const columns = useMemo(() => createResultSummaryGridColumns(t), [t]);

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
