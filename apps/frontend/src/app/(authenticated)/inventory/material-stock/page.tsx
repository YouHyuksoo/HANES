"use client";

/**
 * @file src/app/(authenticated)/inventory/material-stock/page.tsx
 * @description 자재재고현황 조회 페이지 - 시리얼별 상세 / 품목별 그룹 합계 2탭 조회
 *
 * 초보자 가이드:
 * 1. **시리얼별 상세**: 자재시리얼(LOT) 단위 재고 + 경과일수/남은유효기간 표시
 * 2. **품목별 그룹 합계**: 품목코드 기준으로 재고수량을 합산해 요약 표시
 * 3. **창고 필터**: 창고별로 재고 필터링
 * 4. **유효기간 배지**: 만료/임박/정상 상태 색상 표시
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Warehouse,
  Search,
  RefreshCw,
  List,
  Layers,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { WarehouseSelect } from "@/components/shared";
import api from "@/services/api";
import {
  createMaterialStockGridColumns,
  createMaterialStockGroupGridColumns,
} from "./materialStockColumns";

/** API 응답 재고 인터페이스 */
export interface StockItem {
  id: string;
  warehouseCode: string;
  warehouseName?: string;
  locationCode?: string | null;
  itemCode: string;
  matUid?: string | null;
  qty: number;
  reservedQty: number;
  availableQty: number;
  itemName?: string;
  unit?: string;
  safetyStock?: number;
  expiryDays?: number;
  manufactureDate?: string | null;
  expireDate?: string | null;
  elapsedDays?: number | null;
  remainingDays?: number | null;
  specialAcceptYn?: string | null;
}

/** 품목별 그룹 합계 행 */
export interface GroupItem {
  itemCode: string;
  itemName?: string;
  unit?: string;
  totalQty: number;
  safetyStock: number;
  serialCount: number;
  warehouseCount: number;
}

/** 탭 키 타입 */
type TabKey = "serial" | "group";

function MaterialStockPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("serial");
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

  /** 품목코드 기준 재고 합계 그룹핑 */
  const groupedStocks = useMemo<GroupItem[]>(() => {
    const map = new Map<string, GroupItem>();
    for (const s of stocks) {
      const key = s.itemCode;
      const existing = map.get(key);
      if (existing) {
        existing.totalQty += s.qty;
        existing.serialCount += 1;
        existing.warehouseCount += 1; // 창고 set은 아래에서 보정
      } else {
        map.set(key, {
          itemCode: s.itemCode,
          itemName: s.itemName,
          unit: s.unit,
          totalQty: s.qty,
          safetyStock: s.safetyStock || 0,
          serialCount: 1,
          warehouseCount: 1,
        });
      }
    }
    // 창고 수는 distinct 기준으로 다시 계산
    const whSets = new Map<string, Set<string>>();
    for (const s of stocks) {
      if (!whSets.has(s.itemCode)) whSets.set(s.itemCode, new Set());
      whSets.get(s.itemCode)!.add(s.warehouseCode);
    }
    for (const [code, g] of map) {
      g.warehouseCount = whSets.get(code)?.size ?? 0;
    }
    return Array.from(map.values());
  }, [stocks]);

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
    if (row.remainingDays <= 0) return "!bg-red-50 dark:!bg-red-950/40";
    if (row.remainingDays <= 10) return "!bg-yellow-50 dark:!bg-yellow-950/40";
    return "";
  }, []);

  /** 시리얼별 상세 컬럼 */
  const columns = useMemo(
    () =>
      createMaterialStockGridColumns({ t, stockLevelLabels, shelfLifeLabels }),
    [t, stockLevelLabels, shelfLifeLabels]
  );

  /** 품목별 그룹 합계 컬럼 */
  const groupColumns = useMemo(
    () => createMaterialStockGroupGridColumns({ t, stockLevelLabels }),
    [t, stockLevelLabels]
  );

  const TAB_CONFIG: { key: TabKey; labelKey: string; icon: typeof List }[] = [
    { key: "serial", labelKey: "material.stock.tabs.serial", icon: List },
    { key: "group", labelKey: "material.stock.tabs.group", icon: Layers },
  ];

  /** 검색/창고 필터 공통 툴바 */
  const toolbarLeft = (
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
      <div className="w-48 flex-shrink-0">
        <WarehouseSelect
          includeAll
          labelPrefix={t("common.warehouse", "창고")}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          fullWidth
        />
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" />
            {t("inventory.matStock.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("inventory.matStock.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchStocks}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border flex-shrink-0">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          {loading ? (
            <div className="py-10 text-center text-text-muted">
              {t("common.loading")}
            </div>
          ) : activeTab === "serial" ? (
            <DataGrid
              data={stocks}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              rowClassName={rowClassName}
              enableExport
              exportFileName={t("material.stock.tabs.serial")}
              toolbarLeft={toolbarLeft}
              sqlQuery={`SELECT *\nFROM MAT_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
            />
          ) : (
            <DataGrid
              data={groupedStocks}
              columns={groupColumns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("material.stock.tabs.group")}
              toolbarLeft={toolbarLeft}
              sqlQuery={`SELECT ITEM_CODE,\n       SUM(QTY) AS TOTAL_QTY,\n       COUNT(*) AS SERIAL_COUNT,\n       COUNT(DISTINCT WAREHOUSE_CODE) AS WAREHOUSE_COUNT\nFROM MAT_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nGROUP BY ITEM_CODE\nORDER BY ITEM_CODE`}
            />
          )}
      </CardContent></Card>
    </div>
  );
}

export default MaterialStockPage;
