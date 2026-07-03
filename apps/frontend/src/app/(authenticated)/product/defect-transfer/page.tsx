"use client";

/**
 * @file src/app/(authenticated)/product/defect-transfer/page.tsx
 * @description 제품 불량창고입고 페이지 - 좌측 공정 WIP 불량재고 대상, 우측 불량창고입고 이력
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArchiveRestore, RefreshCw, Search, XCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import { QtyInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import {
  createProductDefectHistoryGridColumns,
  createProductDefectTargetGridColumns,
  type ProductDefectStock,
  type ProductDefectTransferTx,
} from "./productDefectTransferColumns";

export default function ProductDefectTransferPage() {
  const { t } = useTranslation();

  const [targetData, setTargetData] = useState<ProductDefectStock[]>([]);
  const [historyData, setHistoryData] = useState<ProductDefectTransferTx[]>([]);
  const [targetLoading, setTargetLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());
  const [selectedStock, setSelectedStock] = useState<ProductDefectStock | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferRemark, setTransferRemark] = useState("");
  const [selectedTx, setSelectedTx] = useState<ProductDefectTransferTx | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const fetchTargetStocks = useCallback(async () => {
    setTargetLoading(true);
    try {
      const [sfgRes, fgRes] = await Promise.all([
        api.get("/inventory/product/stocks", {
          params: {
            itemType: "SEMI_PRODUCT",
            qualityStatus: "DEFECT",
            warehouseId: "SFG_WIP",
            includeZero: false,
          },
        }),
        api.get("/inventory/product/stocks", {
          params: {
            itemType: "FINISHED",
            qualityStatus: "DEFECT",
            warehouseId: "FG_WIP",
            includeZero: false,
          },
        }),
      ]);
      const sfgList = sfgRes.data?.data ?? sfgRes.data;
      const fgList = fgRes.data?.data ?? fgRes.data;
      const merged = [
        ...(Array.isArray(sfgList) ? sfgList : []),
        ...(Array.isArray(fgList) ? fgList : []),
      ] as ProductDefectStock[];
      setTargetData(merged.filter((row) => row.availableQty > 0));
    } catch {
      setTargetData([]);
    } finally {
      setTargetLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params: Record<string, string> = {
        transType: "DEFECT_IN,DEFECT_IN_CANCEL",
        limit: "5000",
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/inventory/product/transactions", { params });
      const list = res.data?.data ?? res.data;
      setHistoryData(Array.isArray(list) ? list : []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [fromDate, toDate]);

  const refreshAll = useCallback(() => {
    fetchTargetStocks();
    fetchHistory();
  }, [fetchTargetStocks, fetchHistory]);

  useEffect(() => { fetchTargetStocks(); }, [fetchTargetStocks]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleOpenTransfer = useCallback((stock: ProductDefectStock) => {
    setSelectedStock(stock);
    setTransferQty(Math.min(stock.availableQty, 1));
    setTransferRemark("");
  }, []);

  const handleTransfer = useCallback(async () => {
    if (!selectedStock || transferQty < 1) return;
    setSaving(true);
    try {
      await api.post("/inventory/product/defect-transfer", {
        fromWarehouseId: selectedStock.warehouseCode,
        itemCode: selectedStock.itemCode,
        itemType: selectedStock.itemType,
        qty: transferQty,
        remark: transferRemark || undefined,
      });
      setSelectedStock(null);
      setTransferRemark("");
      refreshAll();
    } catch (e) {
      console.error("Defect transfer failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedStock, transferQty, transferRemark, refreshAll]);

  const handleCancel = useCallback(async () => {
    if (!selectedTx || !cancelReason) return;
    setSaving(true);
    try {
      await api.post("/inventory/cancel", {
        transactionId: selectedTx.id,
        remark: cancelReason,
        source: "product",
      });
      setSelectedTx(null);
      setCancelReason("");
      refreshAll();
    } catch (e) {
      console.error("Cancel failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedTx, cancelReason, refreshAll]);

  const targetRows = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return targetData;
    return targetData.filter((row) =>
      [row.itemCode, row.itemName, row.warehouseCode, row.warehouseName]
        .some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [targetData, targetSearch]);

  const historyRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyData;
    return historyData.filter((row) =>
      [row.transNo, row.part?.itemCode, row.part?.itemName, row.fromWarehouse?.warehouseName, row.toWarehouse?.warehouseName]
        .some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [historyData, historySearch]);

  const targetColumns = useMemo(() => createProductDefectTargetGridColumns({
    t,
    onTransferStock: handleOpenTransfer,
  }), [t, handleOpenTransfer]);

  const historyColumns = useMemo(() => createProductDefectHistoryGridColumns({
    t,
    onCancelTx: (tx) => {
      setSelectedTx(tx);
      setCancelReason("");
    },
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ArchiveRestore className="w-7 h-7 text-primary" />
            {t("productMgmt.defectTransfer.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.defectTransfer.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refreshAll}>
          <RefreshCw className={`w-4 h-4 mr-1 ${targetLoading || historyLoading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 flex-1 min-h-0">
        <Card className="min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col min-h-0">
            <div className="mb-3 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-bold text-text">{t("productMgmt.defectTransfer.targetTitle", "입고 대상 불량 재고")}</h2>
              <span className="text-xs text-text-muted">{targetRows.length.toLocaleString()}건</span>
            </div>
            <DataGrid
              data={targetRows}
              columns={targetColumns}
              isLoading={targetLoading}
              enableColumnFilter
              enableExport
              exportFileName={t("productMgmt.defectTransfer.targetTitle", "입고 대상 불량 재고")}
              toolbarLeft={
                <Input
                  placeholder={t("productMgmt.defectTransfer.targetSearchPlaceholder", "품목코드, 품목명, 창고 검색...")}
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              }
              sqlQuery={`SELECT *\nFROM PRODUCT_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND QUALITY_STATUS = 'DEFECT'\n  AND WAREHOUSE_CODE IN ('SFG_WIP', 'FG_WIP')\n  AND AVAILABLE_QTY > 0\nORDER BY WAREHOUSE_CODE, ITEM_CODE`}
            />
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4 flex flex-col min-h-0">
            <div className="mb-3 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-bold text-text">{t("productMgmt.defectTransfer.historyTitle", "불량창고 입고 이력")}</h2>
              <span className="text-xs text-text-muted">{historyRows.length.toLocaleString()}건</span>
            </div>
            <DataGrid
              data={historyRows}
              columns={historyColumns}
              isLoading={historyLoading}
              enableColumnFilter
              enableExport
              exportFileName={t("productMgmt.defectTransfer.historyTitle", "불량창고 입고 이력")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("productMgmt.defectTransfer.searchPlaceholder")}
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <DateRangeFilter
                    from={fromDate}
                    to={toDate}
                    onFromChange={setStartDate}
                    onToChange={setEndDate}
                    className="flex-shrink-0"
                  />
                </div>
              }
              sqlQuery={`SELECT *\nFROM PRODUCT_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND TRANS_TYPE IN ('DEFECT_IN', 'DEFECT_IN_CANCEL')\nORDER BY TRANS_DATE DESC`}
            />
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={Boolean(selectedStock)}
        onClose={() => setSelectedStock(null)}
        title={t("productMgmt.defectTransfer.modal.title")}
        size="lg"
      >
        {selectedStock && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-muted">{t("common.partCode")}:</span>{" "}
                  <span className="font-mono">{selectedStock.itemCode}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("common.partName")}:</span>{" "}
                  {selectedStock.itemName}
                </div>
                <div>
                  <span className="text-text-muted">{t("productMgmt.defectTransfer.col.sourceWarehouse")}:</span>{" "}
                  {selectedStock.warehouseName || selectedStock.warehouseCode}
                </div>
                <div>
                  <span className="text-text-muted">{t("common.available")}:</span>{" "}
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {selectedStock.availableQty.toLocaleString()} {selectedStock.unit || ""}
                  </span>
                </div>
              </div>
            </div>
            <QtyInput
              label={t("productMgmt.defectTransfer.modal.qty")}
              value={transferQty}
              maxValue={selectedStock.availableQty}
              onChange={setTransferQty}
              fullWidth
            />
            <Input
              label={t("productMgmt.defectTransfer.modal.remark")}
              value={transferRemark}
              onChange={(e) => setTransferRemark(e.target.value)}
              fullWidth
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setSelectedStock(null)}>{t("common.cancel")}</Button>
              <Button onClick={handleTransfer} disabled={saving || transferQty < 1 || transferQty > selectedStock.availableQty}>
                {saving ? t("common.saving") : t("productMgmt.defectTransfer.modal.confirm")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title={t("productMgmt.defectTransfer.cancelTitle")}
        size="lg"
      >
        {selectedTx && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-muted">{t("productMgmt.defectTransfer.col.transNo")}:</span>{" "}
                  <span className="font-mono font-medium">{selectedTx.transNo}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("common.partCode")}:</span>{" "}
                  <span className="font-mono">{selectedTx.part?.itemCode}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("common.partName")}:</span>{" "}
                  {selectedTx.part?.itemName}
                </div>
                <div>
                  <span className="text-text-muted">{t("productMgmt.defectTransfer.col.qty")}:</span>{" "}
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {selectedTx.qty.toLocaleString()} {selectedTx.part?.unit || ""}
                  </span>
                </div>
              </div>
            </div>
            <Input
              label={t("productMgmt.defectTransfer.reason")}
              placeholder={t("productMgmt.defectTransfer.reasonPlaceholder")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              fullWidth
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setSelectedTx(null)}>{t("common.cancel")}</Button>
              <Button onClick={handleCancel} disabled={saving || !cancelReason}>
                {saving ? t("common.saving") : (
                  <><XCircle className="w-4 h-4 mr-1" />{t("productMgmt.defectTransfer.confirmCancel")}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
