"use client";

/**
 * @file src/app/(authenticated)/shipping/box-stock/page.tsx
 * @description 박스재고조회 페이지 - 제품재고(시리얼=FG_LABELS) 기준 박스별 재고 조회
 *   - 왼쪽: 박스별 포장 재고 집계 (BOX_NO가 부여된 미출하 시리얼을 박스별로 집계)
 *   - 오른쪽: 선택 박스 내 재고 시리얼 목록
 *   BOX_NO는 포장 식별자이며, 창고입고 여부는 PRODUCT_TRANSACTIONS(refType=BOX)로 구분한다.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  PackageSearch, Search, RefreshCw,
  AlertTriangle, ClipboardList,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

type InventoryState = "PACKED_WAITING" | "WAREHOUSE_RECEIVED";

interface StockBox {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  orderNo: string | null;
  latestAt: string | null;
  inventoryState: InventoryState;
  warehouseCode: string | null;
  receivedAt: string | null;
}

interface StockSerial {
  seq: number;
  fgBarcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  equipCode: string | null;
  workerId: string | null;
  lineCode: string | null;
  status: string | null;
  inspectPassYn: string | null;
  issuedAt: string | null;
  inventoryState: InventoryState;
  warehouseCode: string | null;
  receivedAt: string | null;
}

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function inventoryStateClass(state: InventoryState): string {
  return state === "WAREHOUSE_RECEIVED"
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
}

export default function BoxStockPage() {
  const { t } = useTranslation();
  const [boxes, setBoxes] = useState<StockBox[]>([]);
  const [serials, setSerials] = useState<StockSerial[]>([]);
  const [selectedBox, setSelectedBox] = useState<StockBox | null>(null);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pageError, setPageError] = useState("");
  const [serialError, setSerialError] = useState("");

  const selectedBoxNo = selectedBox?.boxNo;

  const fetchSerials = useCallback(async (boxNo: string) => {
    setLoadingSerials(true);
    setSerialError("");
    try {
      const res = await api.get(`/shipping/box-stock/${encodeURIComponent(boxNo)}/serials`);
      setSerials(res.data?.data ?? []);
    } catch (e) {
      setSerials([]);
      setSerialError(errMsg(e, t("shipping.boxStock.itemLoadError")));
    } finally {
      setLoadingSerials(false);
    }
  }, [t]);

  const fetchBoxes = useCallback(async () => {
    setLoadingBoxes(true);
    setPageError("");
    try {
      const params: Record<string, string> = {};
      if (searchText) params.boxNo = searchText;
      const res = await api.get("/shipping/box-stock", { params });
      const list: StockBox[] = res.data?.data ?? [];
      setBoxes(list);
      const nextSelected = selectedBoxNo
        ? list.find((box) => box.boxNo === selectedBoxNo) ?? list[0] ?? null
        : list[0] ?? null;
      setSelectedBox(nextSelected);
      if (nextSelected) {
        await fetchSerials(nextSelected.boxNo);
      } else {
        setSerials([]);
      }
    } catch (e) {
      setBoxes([]);
      setSelectedBox(null);
      setSerials([]);
      setPageError(errMsg(e, t("shipping.boxStock.loadError")));
    } finally {
      setLoadingBoxes(false);
    }
  }, [fetchSerials, searchText, selectedBoxNo, t]);

  useEffect(() => { fetchBoxes(); }, [fetchBoxes]);

  const handleSelectBox = useCallback((box: StockBox) => {
    setSelectedBox(box);
    fetchSerials(box.boxNo);
  }, [fetchSerials]);

  const renderInventoryState = useCallback((state: InventoryState) => (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${inventoryStateClass(state)}`}>
      {state === "WAREHOUSE_RECEIVED"
        ? t("shipping.boxStock.warehouseReceived")
        : t("shipping.boxStock.packedWaiting")}
    </span>
  ), [t]);

  const boxColumns = useMemo<ColumnDef<StockBox>[]>(() => [
    { accessorKey: "boxNo", header: t("shipping.pack.boxNo"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 170, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "qty",
      header: t("shipping.boxStock.boxQty"),
      size: 90,
      meta: { align: "right" as const, filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "inventoryState",
      header: t("shipping.boxStock.inventoryState"),
      size: 125,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => renderInventoryState(getValue() as InventoryState),
    },
    { accessorKey: "warehouseCode", header: t("shipping.boxStock.warehouseCode"), size: 105, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "orderNo", header: t("shipping.boxStock.orderNo"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "latestAt", header: t("shipping.boxStock.issuedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
    { accessorKey: "receivedAt", header: t("shipping.boxStock.receivedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
  ], [renderInventoryState, t]);

  const serialColumns = useMemo<ColumnDef<StockSerial>[]>(() => [
    { accessorKey: "seq", header: "No", size: 55, meta: { align: "center" as const, filterType: "number" as const } },
    { accessorKey: "fgBarcode", header: t("common.prdUid"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => (
      <span className="font-mono text-text">{getValue() as string}</span>
    ) },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "orderNo", header: t("shipping.boxStock.orderNo"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "status", header: t("common.status"), size: 95, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "inventoryState",
      header: t("shipping.boxStock.inventoryState"),
      size: 125,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => renderInventoryState(getValue() as InventoryState),
    },
    { accessorKey: "warehouseCode", header: t("shipping.boxStock.warehouseCode"), size: 105, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "inspectPassYn", header: t("shipping.boxStock.inspectPassYn"), size: 80, meta: { align: "center" as const, filterType: "multi" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "issuedAt", header: t("shipping.boxStock.issuedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
    { accessorKey: "receivedAt", header: t("shipping.boxStock.receivedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
  ], [renderInventoryState, t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageSearch className="w-7 h-7 text-primary" />
            {t("shipping.boxStock.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("shipping.boxStock.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchBoxes}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loadingBoxes ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)] gap-4 flex-1 min-h-0">
        <div className="min-h-0 overflow-hidden">
          <div className="h-full">
            <DataGrid
              data={boxes}
              columns={boxColumns}
              isLoading={loadingBoxes}
              enableColumnFilter
              enableExport
              exportFileName={t("shipping.boxStock.title")}
              onRowClick={handleSelectBox}
              selectedRowId={selectedBox?.boxNo}
              getRowId={(row) => row.boxNo}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("shipping.boxStock.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                </div>
              }
              sqlQuery={`SELECT l.BOX_NO, l.ITEM_CODE, COUNT(*) AS QTY,\n       CASE WHEN MAX(tx.TRANS_NO) IS NULL THEN 'PACKED_WAITING' ELSE 'WAREHOUSE_RECEIVED' END AS INVENTORY_STATE,\n       MAX(COALESCE(tx.TO_WAREHOUSE_ID, tx.FROM_WAREHOUSE_ID)) AS WAREHOUSE_CODE,\n       MIN(l.ORDER_NO) AS ORDER_NO, MAX(l.ISSUED_AT) AS LATEST_AT, MAX(tx.TRANS_DATE) AS RECEIVED_AT\nFROM FG_LABELS l\nLEFT JOIN PRODUCT_TRANSACTIONS tx\n  ON tx.REF_TYPE = 'BOX'\n AND tx.REF_ID = l.BOX_NO\n AND tx.STATUS = 'DONE'\n AND tx.TRANS_TYPE IN ('WIP_OUT', 'FG_IN')\n AND tx.COMPANY = l.COMPANY\n AND tx.PLANT_CD = l.PLANT_CD\nWHERE l.COMPANY = '40'\n  AND l.PLANT_CD = '1000'\n  AND l.BOX_NO IS NOT NULL\n  AND l.STATUS <> 'SHIPPED'\nGROUP BY l.BOX_NO, l.ITEM_CODE\nORDER BY l.BOX_NO DESC`}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">
          <div className="h-full flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 flex-shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  {t("shipping.boxStock.itemsTitle")}
                </h2>
                <p className="text-xs text-text-muted mt-1 truncate">
                  {selectedBox
                    ? `${selectedBox.boxNo} / ${selectedBox.itemName ?? selectedBox.itemCode} / ${
                        selectedBox.inventoryState === "WAREHOUSE_RECEIVED"
                          ? t("shipping.boxStock.warehouseReceived")
                          : t("shipping.boxStock.packedWaiting")
                      }`
                    : t("shipping.boxStock.selectBox")}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-text-muted">{t("shipping.boxStock.itemCount")}</p>
                <p className="text-lg font-bold text-primary">{serials.length.toLocaleString()}</p>
              </div>
            </div>

            {serialError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{serialError}</span>
              </div>
            )}

            <div className="flex-1 min-h-0">
              <DataGrid
                data={serials}
                columns={serialColumns}
                isLoading={loadingSerials}
                enableColumnFilter
                enableExport
                exportFileName={selectedBox ? `${selectedBox.boxNo}-${t("shipping.boxStock.itemsTitle")}` : t("shipping.boxStock.itemsTitle")}
                emptyMessage={selectedBox ? t("shipping.boxStock.noItems") : t("shipping.boxStock.selectBox")}
                pageSize={25}
                sqlQuery={selectedBox ? `SELECT l.FG_BARCODE, l.ITEM_CODE, l.ORDER_NO, l.STATUS,\n       CASE WHEN MAX(tx.TRANS_NO) IS NULL THEN 'PACKED_WAITING' ELSE 'WAREHOUSE_RECEIVED' END AS INVENTORY_STATE,\n       MAX(COALESCE(tx.TO_WAREHOUSE_ID, tx.FROM_WAREHOUSE_ID)) AS WAREHOUSE_CODE,\n       l.INSPECT_PASS_YN, l.ISSUED_AT, MAX(tx.TRANS_DATE) AS RECEIVED_AT\nFROM FG_LABELS l\nLEFT JOIN PRODUCT_TRANSACTIONS tx\n  ON tx.REF_TYPE = 'BOX'\n AND tx.REF_ID = l.BOX_NO\n AND tx.STATUS = 'DONE'\n AND tx.TRANS_TYPE IN ('WIP_OUT', 'FG_IN')\nWHERE l.BOX_NO = '${selectedBox.boxNo}'\n  AND l.COMPANY = '40'\n  AND l.PLANT_CD = '1000'\n  AND l.STATUS <> 'SHIPPED'\nGROUP BY l.FG_BARCODE, l.ITEM_CODE, l.ORDER_NO, l.STATUS, l.INSPECT_PASS_YN, l.ISSUED_AT\nORDER BY l.FG_BARCODE` : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
