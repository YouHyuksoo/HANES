"use client";

/**
 * @file src/app/(authenticated)/inventory/product-hold/page.tsx
 * @description 제품재고홀드 페이지 - 제품 재고(WIP/FG)의 홀드/해제 관리
 *
 * 초보자 가이드:
 * 1. **홀드**: 품질 이슈 등으로 제품 재고 사용/출하 일시 중지
 * 2. **해제**: 이슈 해결 후 다시 출하 가능 상태로 변경
 * 3. API: GET /inventory/product-hold, POST /inventory/product-hold/hold, POST /inventory/product-hold/release
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldAlert, Search, RefreshCw, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createProductHoldGridColumns, type ProductHoldStock } from "./productHoldColumns";

export default function ProductHoldPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductHoldStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ProductHoldStock | null>(null);
  const [actionType, setActionType] = useState<"hold" | "release">("hold");
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.itemType = typeFilter;
      const res = await api.get("/inventory/product-hold", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);


  const stats = useMemo(() => ({
    total: data.length,
    holdCount: data.filter(d => d.status === "HOLD").length,
    normalCount: data.filter(d => d.status === "NORMAL").length,
  }), [data]);

  const handleAction = useCallback(async () => {
    if (!selectedStock?.id) return;
    setSaving(true);
    try {
      const url = actionType === "hold"
        ? "/inventory/product-hold/hold"
        : "/inventory/product-hold/release";
      await api.post(url, { stockId: selectedStock.id, reason });
      setIsModalOpen(false);
      setReason("");
      setSelectedStock(null);
      fetchData();
    } catch (e) {
      console.error("Product hold action failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedStock, actionType, reason, fetchData]);

  const columns = useMemo(() => createProductHoldGridColumns({
    t,
    setSelectedStock,
    setActionType,
    setReason,
    setIsModalOpen,
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" />
            {t("productHold.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productHold.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("productHold.stats.total")} value={stats.total} icon={ShieldAlert} color="blue" />
        <StatCard label={t("productHold.stats.holdCount")} value={stats.holdCount} icon={AlertTriangle} color="red" />
        <StatCard label={t("productHold.stats.normalCount")} value={stats.normalCount} icon={CheckCircle} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("productHold.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t("productHold.searchPlaceholder")}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-28 flex-shrink-0">
                <ComCodeSelect groupCode="ITEM_TYPE" labelPrefix={t('productHold.partType')} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <ComCodeSelect groupCode="PRODUCT_HOLD_STATUS" labelPrefix={t('common.status')} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM PROD_HOLDS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={actionType === "hold" ? t("productHold.holdTitle") : t("productHold.releaseTitle")}
        size="lg"
      >
        {selectedStock && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg border text-sm ${
              actionType === "hold"
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            }`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-text-muted">{t("productHold.partCode")}:</span>{" "}
                  <span className="font-mono font-medium">{selectedStock.itemCode}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.partName")}:</span>{" "}
                  {selectedStock.itemName}
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.partType")}:</span>{" "}
                  <ComCodeBadge groupCode="ITEM_TYPE" code={selectedStock.itemType} />
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.qty")}:</span>{" "}
                  <span className="font-medium">{selectedStock.qty?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.warehouseCode")}:</span>{" "}
                  {selectedStock.warehouseCode}
                </div>
              </div>
            </div>
            <Input
              label={t("productHold.reason")}
              placeholder={t("productHold.reasonPlaceholder")}
              value={reason}
              onChange={e => setReason(e.target.value)}
              fullWidth
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAction} disabled={saving}>
                {saving
                  ? t("common.saving")
                  : actionType === "hold"
                    ? t("productHold.hold")
                    : t("productHold.release")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
