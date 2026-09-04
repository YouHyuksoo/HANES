"use client";

/**
 * @file src/app/(authenticated)/material/shelf-life-history/page.tsx
 * @description 유수명자재 검사이력 조회 - 재검사(IQC RETEST) 결과 이력을 조회/필터/내보내기
 *
 * 초보자 가이드:
 * 1. **이력 조회**: 유수명자재 재검사(IqcLog inspectType=RETEST) 결과를 읽기 전용으로 조회
 * 2. **필터**: 검사일 구간(필수, 기본 당일) / 품목 / 결과(합격·불합격) / 검색어(LOT·품목·검사자)
 * 3. 데이터 출처 API: GET /material/shelf-life/reinspect
 *
 * 조회 원칙(조건 없는 전량 조회 금지):
 * - 이력성 화면이므로 검사일 구간이 항상 붙는다 (기본 당일, getTodayLocal)
 * - 품목/결과/검색어는 전부 서버 파라미터. 클라이언트에서 전량 받아 거르지 않는다
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { History, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { PartSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import ShelfLifeDetailModal, { type ShelfLifeDetailRecord } from "./ShelfLifeDetailModal";
import { createShelfLifeHistoryGridColumns, type ReinspectHistoryItem } from "./shelfLifeHistoryColumns";

/** 서버 페이지 크기 */
const PAGE_SIZE = 200;

export default function ShelfLifeHistoryPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ReinspectHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  // 검사일 구간 — 이력 화면은 날짜 구간이 필수, 기본 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);
  const [detailRecord, setDetailRecord] = useState<ShelfLifeDetailRecord | null>(null);

  useEffect(() => { setPage(1); }, [searchText, itemFilter, resultFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (resultFilter) params.result = resultFilter;
      if (itemFilter) params.itemCode = itemFilter;
      if (searchText.trim()) params.search = searchText.trim();
      const res = await api.get("/material/shelf-life/reinspect", { params });
      setData(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, fromDate, toDate, resultFilter, itemFilter, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resultOptions = useMemo(() => [
    { value: "", label: `${t("common.result", "결과")}: ${t("common.all", "전체")}` },
    { value: "PASS", label: t("material.shelfLife.pass", "합격") },
    { value: "FAIL", label: t("material.shelfLife.fail", "불합격") },
  ], [t]);

  const columns = useMemo(() => createShelfLifeHistoryGridColumns({
    t,
    onViewDetail: setDetailRecord,
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            {t("menu.material.shelfLifeHistory", "유수명자재 검사이력")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.shelfLife.historySubtitle", "유수명자재 재검사 결과 이력을 조회합니다.")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 이력 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
      sqlQuery={`SELECT *\nFROM IQC_LOGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND INSPECT_TYPE = 'RETEST'\n  AND INSPECT_DATE >= TRUNC(SYSDATE)\n  AND INSPECT_DATE <  TRUNC(SYSDATE) + 1\nORDER BY INSPECT_DATE DESC`}
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("menu.material.shelfLifeHistory", "유수명자재 검사이력")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                {/* 검사일 구간 — 필수(기본 당일) */}
                <DateRangeFilter
                  from={fromDate}
                  to={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                  presets
                  label={t("material.shelfLife.inspectDate", "검사일")}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("material.shelfLife.searchPlaceholder", "LOT·품목 검색...")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-48 flex-shrink-0">
                  <PartSelect labelPrefix={t("common.partName", "품목")} value={itemFilter} onChange={setItemFilter} includeInactive fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ShelfLifeDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
    </div>
  );
}
