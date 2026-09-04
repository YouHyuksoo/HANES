"use client";

/**
 * @file src/app/(authenticated)/inventory/material-physical-inv-history/page.tsx
 * @description 자재재고실사 이력 조회 페이지 - 실사 결과 내역 조회 (장부수량 vs 실사수량)
 *
 * 초보자 가이드:
 * 1. **실사 이력**: InvAdjLog(adjType=PHYSICAL_COUNT) 데이터를 조회
 * 2. **필터**: 창고, 일자범위, 검색어(품목코드/명) 필터링
 * 3. **차이수량**: 양수(파란색), 음수(빨간색), 0(초록색) 표시
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { WarehouseSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import {
  createMaterialPhysicalInvHistoryGridColumns,
  type InvHistoryItem,
} from "./materialPhysicalInvHistoryColumns";

/** 서버 페이지당 건수 */
const PAGE_SIZE = 50;

export default function MaterialPhysicalInvHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InvHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText) params.search = searchText;
      if (warehouseFilter) params.warehouseCode = warehouseFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/material/physical-inv/history", { params });
      setData(res.data?.data ?? []);
      setTotal(res.data?.meta?.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchText, warehouseFilter, fromDate, toDate, page]);

  useEffect(() => { setPage(1); }, [searchText, warehouseFilter, fromDate, toDate]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    positive: data.filter(d => d.diffQty > 0).length,
    negative: data.filter(d => d.diffQty < 0).length,
    matched: data.filter(d => d.diffQty === 0).length,
  }), [data]);

  const columns = useMemo(() => createMaterialPhysicalInvHistoryGridColumns({ t }), [t]);

  const rowClassName = useCallback((row: InvHistoryItem) => {
    if (row.diffQty > 0) return "!bg-blue-50/50 dark:!bg-blue-950/20";
    if (row.diffQty < 0) return "!bg-red-50/50 dark:!bg-red-950/20";
    return "";
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("inventory.matPhysicalInvHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("inventory.matPhysicalInvHistory.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("material.physicalInvHistory.stats.total")} value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label={t("material.physicalInvHistory.stats.positive")} value={stats.positive} icon={ClipboardCheck} color="purple" />
        <StatCard label={t("material.physicalInvHistory.stats.negative")} value={stats.negative} icon={ClipboardCheck} color="red" />
        <StatCard label={t("material.physicalInvHistory.stats.matched")} value={stats.matched} icon={ClipboardCheck} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} pageSize={PAGE_SIZE} enableColumnFilter rowClassName={rowClassName} enableExport exportFileName={t("inventory.matPhysicalInvHistory.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.physicalInvHistory.searchPlaceholder")}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <WarehouseSelect includeAll labelPrefix={t("common.warehouse", "창고")} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth />
              </div>
              <DateRangeFilter
                from={fromDate}
                to={toDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
                className="flex-shrink-0"
              />
              <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} disabled={loading} className="flex-shrink-0" />
            </div>
          }
          sqlQuery={`SELECT *\nFROM MAT_PHYSICAL_INV_HIST\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
