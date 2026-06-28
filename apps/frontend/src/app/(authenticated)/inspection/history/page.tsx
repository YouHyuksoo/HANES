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
  Zap, RefreshCw, Search,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ComCodeSelect, DateRangeFilter } from "@/components/shared";
import { getTodayLocal } from "@/utils/date";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createInspectionHistoryGridColumns } from "./inspectionHistoryColumns";
import type { InspectHistoryRow } from "./types";

export default function InspectionHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InspectHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [fromDate, setDateFrom] = useState(() => getTodayLocal());
  const [toDate, setDateTo] = useState(() => getTodayLocal());

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
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get("/quality/inspect-results", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, resultFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createInspectionHistoryGridColumns(t), [t]);

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
                <DateRangeFilter
                  from={fromDate}
                  to={toDate}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                />
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
