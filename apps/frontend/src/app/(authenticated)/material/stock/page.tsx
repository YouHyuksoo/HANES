"use client";

/**
 * @file src/app/(authenticated)/material/stock/page.tsx
 * @description 재고현황 조회 페이지 - 창고별/품목별 재고 + 제조일자 기반 유효기간 관리
 *
 * 초보자 가이드:
 * 1. **재고 목록**: 품목별 현재 재고 수량 + 경과일수/남은유효기간 표시
 * 2. **창고 필터**: 창고별로 재고 필터링
 * 3. **유효기간 배지**: 만료/임박/정상 상태 색상 표시
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
import api from "@/services/api";
import {
  createMaterialStockGridColumns,
  type StockItem,
} from "./materialStockColumns";

function StockPage() {
  const { t } = useTranslation();
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/stocks", {
        params: {
          page: 1,
          limit: 200,
          ...(warehouseFilter && { warehouseCode: warehouseFilter }),
          ...(searchText && { search: searchText }),
        },
      });
      setStocks(res.data.data || []);
    } catch {
      setStocks([]);
    }
    setLoading(false);
  }, [warehouseFilter, searchText]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const stats = useMemo(
    () => ({
      totalItems: stocks.length,
      totalQuantity: stocks.reduce((sum, s) => sum + s.qty, 0),
      belowSafety: stocks.filter(
        (s) => s.safetyStock && s.safetyStock > 0 && s.qty < s.safetyStock
      ).length,
      expiryWarning: stocks.filter(
        (s) => s.remainingDays != null && s.remainingDays <= 30 && s.remainingDays > 0
      ).length,
    }),
    [stocks]
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
          {loading ? (
            <div className="py-10 text-center text-text-muted">
              {t("common.loading")}
            </div>
          ) : (
            <DataGrid data={stocks} columns={columns} isLoading={loading} enableColumnFilter rowClassName={rowClassName} enableExport exportFileName={t("material.stock.title")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
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
                </div>
              } 
              sqlQuery={`SELECT *\nFROM MAT_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          )}
      </CardContent></Card>
    </div>
  );
}

export default StockPage;
