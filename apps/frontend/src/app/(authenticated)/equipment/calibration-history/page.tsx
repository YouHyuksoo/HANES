"use client";

/**
 * @file src/app/(authenticated)/equipment/calibration-history/page.tsx
 * @description 계측기 교정이력 조회 페이지 - 전체 교정 로그 통합 조회
 *
 * 초보자 가이드:
 * 1. 모든 계측기의 교정 이력을 통합 조회
 * 2. 교정결과(PASS/FAIL), 교정기관, 교정일 등 필터
 * 3. API: GET /quality/msa/calibrations (교정일 구간 + 서버 페이징)
 *
 * 조회 원칙(조건 없는 전량 조회 금지):
 * - 이력성 화면이므로 교정일 구간이 항상 붙는다 (기본 당일, getTodayLocal)
 * - 검색어/결과는 전부 서버 파라미터. 클라이언트에서 전량 받아 거르지 않는다
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { History, Search, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createCalibrationHistoryGridColumns } from "./calibrationHistoryColumns";
import type { CalibrationRow } from "./types";

/** 서버 페이지 크기 */
const PAGE_SIZE = 200;

export default function CalibrationHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CalibrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  // 교정일 구간 — 이력 화면은 날짜 구간이 필수, 기본 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [searchText, resultFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (searchText.trim()) params.search = searchText.trim();
      if (resultFilter) params.result = resultFilter;
      const res = await api.get("/quality/msa/calibrations", { params });
      const items = res.data?.data ?? [];
      setData(Array.isArray(items) ? items : []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, fromDate, toDate, searchText, resultFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    pass: data.filter(d => d.result === "PASS").length,
    fail: data.filter(d => d.result === "FAIL").length,
  }), [data]);

  const columns = useMemo(() => createCalibrationHistoryGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            {t("equipment.calibrationHistory.title", "계측기 교정이력")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.calibrationHistory.subtitle", "전체 계측기의 교정 이력을 조회합니다.")}</p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("equipment.calibrationHistory.statTotal", "전체 교정")} value={total} icon={History} color="blue" />
        <StatCard label="PASS" value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label="FAIL" value={stats.fail} icon={XCircle} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.calibrationHistory.title", "계측기교정이력")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <DateRangeFilter
                from={fromDate}
                to={toDate}
                onFromChange={setFromDate}
                onToChange={setToDate}
                presets
                label={t("equipment.calibrationHistory.date", "교정일")}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.calibrationHistory.searchPlaceholder", "교정번호, 계측기코드 검색...")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <ComCodeSelect groupCode="INSPECT_RESULT" labelPrefix={t("common.result", "결과")}
                  value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT *\nFROM EQUIP_CALIBRATIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND CALIBRATION_DATE >= TRUNC(SYSDATE)\n  AND CALIBRATION_DATE <  TRUNC(SYSDATE) + 1\nORDER BY CALIBRATION_DATE DESC`}/>
      </CardContent></Card>
    </div>
  );
}
