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
import { ColumnDef } from "@tanstack/react-table";
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
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { StatCard } from "@/components/ui";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

/** API 응답 재고 인터페이스 */
interface StockItem {
  id: string;
  warehouseCode: string;
  locationCode?: string | null;
  itemCode: string;
  lotId?: string | null;
  qty: number;
  reservedQty: number;
  availableQty: number;
  itemName?: string;
  unit?: string;
  safetyStock?: number;
  expiryDays?: number;
  lotNo?: string | null;
  manufactureDate?: string | null;
  expireDate?: string | null;
  elapsedDays?: number | null;
  remainingDays?: number | null;
}

/** 유효기간 상태 배지 */
function ShelfLifeBadge({
  remainingDays,
  labels,
}: {
  remainingDays: number | null | undefined;
  labels: { expired: string; imminent: string; normal: string };
}) {
  if (remainingDays == null) return <span className="text-text-muted">-</span>;

  if (remainingDays <= 0) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        {labels.expired}
      </span>
    );
  } else if (remainingDays <= 30) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
        {labels.imminent}
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
      {labels.normal}
    </span>
  );
}

/** 안전재고 대비 상태 표시 */
function StockLevelBadge({
  quantity,
  safetyStock,
  labels,
}: {
  quantity: number;
  safetyStock: number;
  labels: { shortage: string; caution: string; normal: string };
}) {
  if (!safetyStock || safetyStock <= 0) return null;
  const ratio = quantity / safetyStock;
  if (ratio < 1) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        {labels.shortage}
      </span>
    );
  } else if (ratio < 1.5) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
        {labels.caution}
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
      {labels.normal}
    </span>
  );
}

function StockPage() {
  const { t } = useTranslation();
  const { options: warehouseOpts } = useWarehouseOptions();
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

  const warehouseOptions = useMemo(
    () => [
      { value: "", label: t("material.stock.allWarehouse") },
      ...warehouseOpts,
    ],
    [t, warehouseOpts]
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

  const columns: ColumnDef<StockItem>[] = useMemo(
    () => [
      {
        accessorKey: "itemCode",
        header: t("material.stock.columns.partCode"),
        size: 110,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
        ),
      },
      {
        accessorKey: "itemName",
        header: t("material.stock.columns.partName"),
        size: 140,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "lotNo",
        header: t("material.col.lotNo"),
        size: 150,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>
        ),
      },
      {
        accessorKey: "warehouseCode",
        header: t("material.stock.columns.warehouse"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "qty",
        header: t("material.stock.columns.quantity"),
        size: 90,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.qty.toLocaleString()} {row.original.unit || ""}
          </span>
        ),
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        accessorKey: "safetyStock",
        header: t("material.stock.columns.safetyStock"),
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return val ? (
            <span className="text-text-muted">{val.toLocaleString()}</span>
          ) : (
            <span className="text-text-muted">-</span>
          );
        },
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        id: "stockLevel",
        header: t("material.stock.columns.status"),
        size: 80,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <StockLevelBadge
            quantity={row.original.qty}
            safetyStock={row.original.safetyStock || 0}
            labels={stockLevelLabels}
          />
        ),
      },
      {
        accessorKey: "manufactureDate",
        header: t("material.stock.columns.manufactureDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ row }) => {
          const d = row.original.manufactureDate;
          return d ? String(d).slice(0, 10) : "-";
        },
      },
      {
        accessorKey: "elapsedDays",
        header: t("material.stock.columns.elapsedDays"),
        size: 80,
        cell: ({ row }) => {
          const days = row.original.elapsedDays;
          if (days == null) return "-";
          return <span>{days}{t("material.stock.columns.dayUnit")}</span>;
        },
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        accessorKey: "remainingDays",
        header: t("material.stock.columns.remainingDays"),
        size: 100,
        cell: ({ row }) => {
          const days = row.original.remainingDays;
          if (days == null) return "-";
          const color =
            days <= 0
              ? "text-red-600 font-bold"
              : days <= 30
              ? "text-yellow-600 font-medium"
              : "text-green-600";
          return (
            <span className={color}>
              {days}{t("material.stock.columns.dayUnit")}
            </span>
          );
        },
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        id: "shelfLifeStatus",
        header: t("material.stock.columns.shelfLifeStatus"),
        size: 80,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <ShelfLifeBadge
            remainingDays={row.original.remainingDays}
            labels={shelfLifeLabels}
          />
        ),
      },
    ],
    [t, stockLevelLabels, shelfLifeLabels]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
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
            <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
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

      <Card>
        <CardContent>
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
                    <Select
                      options={warehouseOptions}
                      value={warehouseFilter}
                      onChange={setWarehouseFilter}
                      fullWidth
                    />
                  </div>
                </div>
              } />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default StockPage;
