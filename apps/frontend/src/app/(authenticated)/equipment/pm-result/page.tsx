"use client";

/**
 * @file src/app/(authenticated)/equipment/pm-result/page.tsx
 * @description PM 보전결과 페이지 - Work Order 실행 결과 목록 조회
 *
 * 초보자 가이드:
 * 1. PM 계획에서 생성된 Work Order의 실행 결과를 조회
 * 2. 상태: PLANNED(예정), IN_PROGRESS(진행중), COMPLETED(완료), CANCELLED(취소), OVERDUE(지연)
 * 3. API: GET /equipment/pm-work-orders
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Wrench, Search, RefreshCw,
  CheckCircle, AlertTriangle, Clock, Package,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createPmResultGridColumns } from "./pmResultColumns";
import type { WoRow } from "./types";

/** 서버 페이지 크기 */
const PAGE_SIZE = 200;

export default function PmResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // 예정일 구간 — 이력성 화면은 날짜 구간이 필수, 기본 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [searchText, statusFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/equipment/pm-work-orders", { params });
      setData(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total,
    completed: data.filter(d => d.status === "COMPLETED").length,
    planned: data.filter(d => d.status === "PLANNED" || d.status === "IN_PROGRESS").length,
    overdue: data.filter(d => d.status === "OVERDUE").length,
  }), [data, total]);

  const columns = useMemo(() => createPmResultGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Wrench className="w-7 h-7 text-primary" />{t("equipment.pmResult.title", "PM 보전결과")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.pmResult.subtitle", "예방보전 Work Order 실행 결과를 조회합니다.")}</p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("equipment.pmResult.statTotal", "전체 WO")} value={stats.total} icon={Package} color="blue" />
        <StatCard label={t("equipment.pmResult.completed", "완료")} value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.pmResult.planned", "예정/진행")} value={stats.planned} icon={Clock} color="yellow" />
        <StatCard label={t("equipment.pmResult.overdue", "지연")} value={stats.overdue} icon={AlertTriangle} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.pmResult.title", "PM보전결과")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <DateRangeFilter
                from={fromDate}
                to={toDate}
                onFromChange={setFromDate}
                onToChange={setToDate}
                presets
                label={t("equipment.pmResult.scheduledDate", "예정일")}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.pmResult.searchPlaceholder", "WO번호, 설비코드 검색...")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <ComCodeSelect groupCode="PM_WO_STATUS" labelPrefix={t("common.status")}
                  value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT *\nFROM PM_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
