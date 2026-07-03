"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, Warehouse, Package } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

type StockItemType = "SEMI_PRODUCT" | "FINISHED";

interface WipStock {
  id: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  qualityStatus: "GOOD" | "DEFECT" | string;
  whCode: string;
  whName: string;
  qty: number;
  unit: string;
  updatedAt: string;
}

interface LabelDetailRow {
  barcode: string;
  boxNo: string | null;
  status: string;
  inspectPassYn: string | null;
  orderNo: string | null;
  equipCode: string | null;
  resultNo: string | null;
  issueProcessCode: string | null;
  currentProcessCode: string | null;
  mountedEquipCode: string | null;
  warehouseCode: string | null;
  initQty: number | null;
  remainQty: number | null;
  issuedAt: string;
}

interface WipStockViewProps {
  itemType: StockItemType;
  titleKey: string;
  descriptionKey: string;
  enableTypeFilter?: boolean;
}

export default function WipStockView({ itemType, titleKey, descriptionKey, enableTypeFilter = false }: WipStockViewProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<WipStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(itemType);
  const [selectedItem, setSelectedItem] = useState<WipStock | null>(null);
  const [labelDetails, setLabelDetails] = useState<LabelDetailRow[]>([]);
  const [labelLoading, setLabelLoading] = useState(false);
  const effectiveItemType = enableTypeFilter ? typeFilter : itemType;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (effectiveItemType) params.itemType = effectiveItemType;
      const res = await api.get("/production/wip-stock", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, effectiveItemType]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    setSelectedItem(null);
    setLabelDetails([]);
  }, [effectiveItemType]);

  const fetchLabelDetails = useCallback(async (itemCode: string, itemType: string) => {
    setLabelLoading(true);
    try {
      const res = await api.get("/production/wip-stock/labels", { params: { itemCode, itemType } });
      const raw = res.data?.data;
      setLabelDetails(Array.isArray(raw) ? raw : raw?.data ?? []);
    } catch {
      setLabelDetails([]);
    } finally {
      setLabelLoading(false);
    }
  }, []);

  const handleRowClick = useCallback((row: WipStock) => {
    setSelectedItem(row);
    fetchLabelDetails(row.itemCode, row.itemType);
  }, [fetchLabelDetails]);

  const typeFilterOptions = useMemo(() => [
    { value: "", label: `${t("production.wipStock.type")}: ${t("common.all")}` },
    { value: "FINISHED", label: `${t("production.wipStock.type")}: ${t("production.wipStock.fgLabel")}` },
    { value: "SEMI_PRODUCT", label: `${t("production.wipStock.type")}: ${t("production.wipStock.wipLabel")}` },
  ], [t]);

  const columns = useMemo<ColumnDef<WipStock>[]>(() => [
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: "itemName", header: t("common.partName"), size: 130, meta: { filterType: "text" as const } },
    {
      accessorKey: "itemType", header: t("production.wipStock.type"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === "SEMI_PRODUCT"
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{t("production.wipStock.wipLabel")}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t("production.wipStock.fgLabel")}</span>;
      },
    },
    {
      accessorKey: "qualityStatus",
      header: t("production.wipStock.qualityStatus", "품질"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === "DEFECT"
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t("production.wipStock.defectStock", "불량")}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{t("production.wipStock.goodStock", "양품")}</span>;
      },
    },
    { accessorKey: "whName", header: t("production.wipStock.warehouse"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("production.wipStock.stockQty"), size: 100, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "unit", header: t("production.wipStock.unit"), size: 60, meta: { filterType: "text" as const } },
    { accessorKey: "updatedAt", header: t("production.wipStock.updatedAt"), size: 110, meta: { filterType: "date" as const } },
  ], [t]);

  const labelColumns = useMemo<ColumnDef<LabelDetailRow>[]>(() => [
    { accessorKey: "barcode", header: t("production.wipStock.labelBarcode", "라벨바코드"), size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: "boxNo", header: t("production.wipStock.boxNo", "박스번호"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string | null) ?? "-" },
    { accessorKey: "status", header: t("common.status"), size: 100, meta: { filterType: "multi" as const } },
    { accessorKey: "remainQty", header: t("production.wipStock.remainQty", "잔량"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => {
      const value = getValue() as number | null;
      return value == null ? "-" : value.toLocaleString();
    } },
    { accessorKey: "inspectPassYn", header: t("production.wipStock.inspectPass"), size: 60, meta: { filterType: "multi" as const }, cell: ({ getValue }) => (getValue() === "Y" ? "PASS" : ((getValue() as string) ?? "-")) },
    { accessorKey: "orderNo", header: t("production.wipStock.orderNo"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) ?? "-" },
    { accessorKey: "currentProcessCode", header: t("production.wipStock.currentProcess", "현재공정"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) ?? "-" },
    { accessorKey: "mountedEquipCode", header: t("production.wipStock.mountedEquip", "장착설비"), size: 110, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) ?? "-" },
    { accessorKey: "issuedAt", header: t("production.wipStock.issuedAt"), size: 140, meta: { filterType: "date" as const }, cell: ({ getValue }) => (getValue() as string)?.slice(0, 16) ?? "-" },
  ], [t]);

  const wipStockSql = useMemo(() => {
    const search = searchText.trim().replace(/'/g, "''").toUpperCase();

    const sqlItemType = effectiveItemType.replace(/'/g, "''");
    const sqlTypePredicate = effectiveItemType ? `\n  AND s.ITEM_TYPE = '${sqlItemType}'` : "";

    return `SELECT
  s.ITEM_CODE AS "itemCode",
  im.ITEM_NAME AS "itemName",
  s.ITEM_TYPE AS "itemType",
  s.QUALITY_STATUS AS "qualityStatus",
  s.WAREHOUSE_CODE AS "whCode",
  wh.WAREHOUSE_NAME AS "whName",
  s.QTY AS "qty",
  im.UNIT AS "unit",
  s.UPDATED_AT AS "updatedAt"
FROM PRODUCT_STOCKS s
LEFT JOIN ITEM_MASTERS im
  ON im.ITEM_CODE = s.ITEM_CODE
 AND im.COMPANY = s.COMPANY
 AND im.PLANT_CD = s.PLANT_CD
LEFT JOIN WAREHOUSES wh
  ON wh.WAREHOUSE_CODE = s.WAREHOUSE_CODE
 AND wh.COMPANY = s.COMPANY
 AND wh.PLANT_CD = s.PLANT_CD
WHERE s.COMPANY = '40'
  AND s.PLANT_CD = '1000'
  AND s.WAREHOUSE_CODE IN ('FG_WIP', 'SFG_WIP')${sqlTypePredicate}${search
    ? `\n  AND (UPPER(s.ITEM_CODE) LIKE '%${search}%' OR UPPER(im.ITEM_NAME) LIKE '%${search}%')`
    : ""}
ORDER BY s.UPDATED_AT DESC`;
  }, [searchText, effectiveItemType]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Warehouse className="w-7 h-7 text-primary" />{t(titleKey)}</h1>
          <p className="text-text-muted mt-1">{t(descriptionKey)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
            onRowClick={handleRowClick}
            enableExport exportFileName={t(titleKey)}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                {enableTypeFilter && (
                  <div className="w-44 flex-shrink-0">
                    <Select options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("production.wipStock.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
              </div>
            }
            sqlQuery={wipStockSql}/>
        </CardContent></Card>

        <Card className="w-[540px] flex-shrink-0 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-text">{t("production.wipStock.labelPanelTitle", "상세 라벨정보")}</h2>
            {selectedItem && <span className="text-sm text-text-muted truncate">- {selectedItem.itemCode} ({labelDetails.length})</span>}
          </div>
          {selectedItem ? (
            <div className="flex-1 min-h-0">
              <DataGrid data={labelDetails} columns={labelColumns} isLoading={labelLoading} enableColumnFilter />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">{t("production.wipStock.labelPanelEmpty", "좌측에서 품목을 선택하면 상세 라벨정보가 표시됩니다")}</div>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
