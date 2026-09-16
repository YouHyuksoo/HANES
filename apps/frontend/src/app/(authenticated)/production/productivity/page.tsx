"use client";

/**
 * @file src/app/(authenticated)/production/productivity/page.tsx
 * @description 생산성분석 - 품목 x 공정 기준 UPH/공수/능률/가동률/OEE 분석
 *
 * 초보자 가이드:
 * 1. **목적**: 단순 실적수량이 아니라 "얼마나 효율적으로 만들었는가"를 본다
 * 2. **데이터**: PROD_RESULTS(실적/작업시간) + PROCESS_CAPAS(표준TT/표준UPH/투입인원)
 * 3. **지표**: 실적UPH, 표준UPH 달성률, 인당생산성, 능률, 가동률, OEE
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, Gauge, AlertTriangle } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createProductivityGridColumns } from "./productivityColumns";
import type { ProductivityRow } from "./types";

export default function ProductivityPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProductivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/production/prod-results/summary/productivity", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createProductivityGridColumns(t), [t]);

  /** 상단 요약: 수량 가중 평균으로 전체 생산성을 본다 */
  const summary = useMemo(() => {
    const totalQty = data.reduce((a, r) => a + (r.totalQty ?? 0), 0);
    const goodQty = data.reduce((a, r) => a + (r.goodQty ?? 0), 0);
    const workHours = data.reduce((a, r) => a + (r.workHours ?? 0), 0);
    const manHours = data.reduce((a, r) => a + (r.manHours ?? 0), 0);
    const stdSeconds = data.reduce((a, r) => a + (r.stdTactTime ?? 0) * (r.totalQty ?? 0), 0);
    return {
      totalQty,
      uph: workHours > 0 ? Math.round((totalQty / workHours) * 10) / 10 : 0,
      perManUph: manHours > 0 ? Math.round((totalQty / manHours) * 10) / 10 : 0,
      efficiencyRate: workHours > 0 && stdSeconds > 0
        ? Math.round((stdSeconds / (workHours * 3600)) * 1000) / 10
        : 0,
      yieldRate: totalQty > 0 ? Math.round((goodQty / totalQty) * 1000) / 10 : 0,
      manHours: Math.round(manHours * 100) / 100,
    };
  }, [data]);

  /** 실적·작업지시 둘 다 소요시간이 없으면 시간 기반 지표(UPH/공수/가동률)를 계산할 수 없다 */
  const noWorkTime = data.length > 0 && data.every((r) => (r.workHours ?? 0) <= 0);
  /** 작업지시 착수~완료로 대시 산정한 행이 있으면 근거를 명시한다 */
  const jobOrderBasedCount = data.filter((r) => r.workTimeSource === "JOB_ORDER").length;
  /** PROCESS_CAPAS 표준이 없으면 표준UPH/표준TT/능률/OEE가 비어 있다 */
  const noStandard = data.length > 0 && data.every((r) => !r.hasStandard);

  const kpis = [
    { label: t("production.productivity.kpiTotalQty"), value: summary.totalQty.toLocaleString(), unit: "EA" },
    { label: t("production.productivity.kpiManHours"), value: summary.manHours.toLocaleString(), unit: "M/H" },
    { label: t("production.productivity.kpiUph"), value: summary.uph.toLocaleString(), unit: "EA/H" },
    { label: t("production.productivity.kpiPerManUph"), value: summary.perManUph.toLocaleString(), unit: "EA/인·H" },
    { label: t("production.productivity.kpiEfficiency"), value: `${summary.efficiencyRate}`, unit: "%" },
    { label: t("production.productivity.kpiYield"), value: `${summary.yieldRate}`, unit: "%" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Gauge className="w-7 h-7 text-primary" />
            {t("production.productivity.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("production.productivity.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      {(noWorkTime || noStandard || jobOrderBasedCount > 0) && (
        <div className="flex-shrink-0 flex flex-col gap-1 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          {noWorkTime && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{t("production.productivity.noWorkTimeNotice")}</span>
            </div>
          )}
          {jobOrderBasedCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{t("production.productivity.jobOrderBasedNotice", { count: jobOrderBasedCount })}</span>
            </div>
          )}
          {noStandard && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{t("production.productivity.noStandardNotice")}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 flex-shrink-0">
        {kpis.map((k) => (
          <Card key={k.label} padding="none">
            <CardContent className="p-3">
              <div className="text-xs text-text-muted truncate">{k.label}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold text-text">{k.value}</span>
                <span className="text-xs text-text-muted">{k.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("production.productivity.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t("production.resultSummary.searchPlaceholder")}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <DateRangeFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} className="flex-shrink-0" />
            </div>
          }
          sqlQuery={`SELECT PR.RESULT_NO, JO.ITEM_CODE, PR.PROCESS_CODE,\n       PR.GOOD_QTY, PR.DEFECT_QTY, PR.START_TIME, PR.END_TIME,\n       PC.STD_TACT_TIME, PC.STD_UPH, PC.WORKER_CNT, PC.EQUIP_CNT\nFROM PROD_RESULTS PR\n  JOIN JOB_ORDERS JO ON JO.ORDER_NO = PR.ORDER_NO\n  LEFT JOIN PROCESS_CAPAS PC\n    ON PC.COMPANY = PR.COMPANY AND PC.PLANT_CD = PR.PLANT_CD\n   AND PC.ITEM_CODE = JO.ITEM_CODE AND PC.PROCESS_CODE = PR.PROCESS_CODE\nWHERE PR.STATUS != 'CANCELED'\n  AND PR.COMPANY = '40' AND PR.PLANT_CD = '1000'\n  AND PR.START_TIME >= TO_DATE(:fromDate, 'YYYY-MM-DD')\n  AND PR.START_TIME < TO_DATE(:toDate, 'YYYY-MM-DD') + 1`}
        />
      </CardContent></Card>
    </div>
  );
}
