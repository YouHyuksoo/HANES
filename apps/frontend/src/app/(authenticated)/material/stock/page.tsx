"use client";

/**
 * @file src/app/(authenticated)/material/stock/page.tsx
 * @description 재고현황 조회 페이지 - 창고별/품목별 재고 + 제조일자 기반 유효기간 관리
 *
 * 초보자 가이드:
 * 1. **재고 목록**: 품목별 현재 재고 수량 + 경과일수/남은유효기간 표시
 * 2. **창고 필터**: 창고별로 재고 필터링
 * 3. **유효기간 배지**: 만료/임박/정상 상태 색상 표시
 * 4. **기본 조건**: 조건 없는 전량 조회 금지. 기본은 수량>0 재고만 + 서버 페이징.
 *    "재고 0 포함"을 켜면 최종변동일 구간(기본 당일)이 항상 붙는다.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Warehouse,
  Search,
  RefreshCw,
  Package,
  AlertTriangle,
  TrendingUp,
  Boxes,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { StatCard } from "@/components/ui";
import { WarehouseSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import {
  createMaterialStockGridColumns,
  type StockItem,
} from "./materialStockColumns";

const PAGE_SIZE = 50;

function StockPage() {
  const { t } = useTranslation();
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  // 기본은 수량>0 재고만(꺼짐). 켜면 최종변동일 구간(기본 당일)이 필수로 붙는다.
  const [includeZero, setIncludeZero] = useState(false);
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setPage(1); }, [warehouseFilter, searchText, includeZero, fromDate, toDate]);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/stocks", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(warehouseFilter && { warehouseCode: warehouseFilter }),
          ...(searchText && { search: searchText }),
          ...(includeZero && { includeZero: "true", fromDate, toDate }),
        },
      });
      const rows: StockItem[] = res.data.data || [];
      setStocks(rows);
      setTotal(Number(res.data?.meta?.total ?? rows.length));
    } catch {
      setStocks([]);
      setTotal(0);
    }
    setLoading(false);
  }, [page, warehouseFilter, searchText, includeZero, fromDate, toDate]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  // totalItems 는 서버 meta 기준(현재 조건 전체 건수), 나머지는 현재 페이지 기준
  const stats = useMemo(
    () => ({
      totalItems: total,
      totalQuantity: stocks.reduce((sum, s) => sum + s.qty, 0),
      belowSafety: stocks.filter(
        (s) => s.safetyStock && s.safetyStock > 0 && s.qty < s.safetyStock
      ).length,
      expiryWarning: stocks.filter(
        (s) => s.remainingDays != null && s.remainingDays <= 30 && s.remainingDays > 0
      ).length,
    }),
    [stocks, total]
  );

  const stockLevelLabels = useMemo(
    () => ({
      shortage: t("material.stock.level.shortage"),
      caution: t("material.stock.level.caution"),
      normal: t("material.stock.level.normal"),
    }),
    [t]
  );

  const shelfLifeLabels = useMemo(
    () => ({
      expired: t("material.stock.shelfLife.expired"),
      imminent: t("material.stock.shelfLife.imminent"),
      normal: t("material.stock.shelfLife.normal"),
    }),
    [t]
  );

  /** 유효기간 행 배경색: 만료 → 붉은색, 10일 이내 → 노란색 */
  const rowClassName = useCallback((row: StockItem) => {
    if (row.remainingDays == null) return "";
    if (row.remainingDays <= 0)
      return "!bg-red-50 dark:!bg-red-950/40";
    if (row.remainingDays <= 10)
      return "!bg-yellow-50 dark:!bg-yellow-950/40";
    return "";
  }, []);

  const columns = useMemo(
    () =>
      createMaterialStockGridColumns({
        t,
        stockLevelLabels,
        shelfLifeLabels,
      }),
    [t, stockLevelLabels, shelfLifeLabels]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" />
            {t("material.stock.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.stock.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchStocks}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard
          label={t("material.stock.stats.totalItems")}
          value={stats.totalItems}
          icon={Package}
          color="blue"
        />
        <StatCard
          label={t("material.stock.stats.totalQuantity")}
          value={stats.totalQuantity}
          icon={Boxes}
          color="purple"
        />
        <StatCard
          label={t("material.stock.stats.belowSafety")}
          value={stats.belowSafety}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          label={t("material.stock.stats.expiryWarning")}
          value={stats.expiryWarning}
          icon={TrendingUp}
          color="yellow"
        />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          {/* 로딩 중에도 DataGrid(툴바 포함)를 유지 — 검색/페이지 입력 중 포커스가 끊기지 않는다 */}
          <DataGrid data={stocks} columns={columns} isLoading={loading} enableColumnFilter pageSize={PAGE_SIZE} rowClassName={rowClassName} enableExport exportFileName={t("material.stock.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0 items-center">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("material.stock.searchPlaceholder")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-40 flex-shrink-0">
                  <WarehouseSelect
                    includeAll
                    labelPrefix={t("common.warehouse", "창고")}
                    value={warehouseFilter}
                    onChange={setWarehouseFilter}
                    fullWidth
                  />
                </div>
                {/* 재고 0 포함 토글 — 기본 꺼짐. 켜면 최종변동일 구간(기본 당일) 필수 */}
                <label className="flex items-center gap-1.5 text-sm text-text whitespace-nowrap flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeZero}
                    onChange={(e) => setIncludeZero(e.target.checked)}
                  />
                  {t("common.includeZero")}
                </label>
                {includeZero && (
                  <DateRangeFilter
                    label={t("material.stock.columns.lastUpdated")}
                    from={fromDate}
                    to={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                    presets
                    className="flex-shrink-0"
                  />
                )}
                <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
              </div>
            }
            sqlQuery={`SELECT *\nFROM MAT_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND QTY > 0 -- 기본. '재고 0 포함' 시 QTY 조건 대신 UPDATED_AT 구간\nORDER BY UPDATED_AT DESC\nOFFSET :skip ROWS FETCH NEXT :limit ROWS ONLY`}/>
      </CardContent></Card>
    </div>
  );
}

export default StockPage;
