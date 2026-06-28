"use client";

/**
 * @file src/app/(authenticated)/material/po/page.tsx
 * @description PO관리 페이지 — 단일 그리드 + 우측 사이드패널 등록/수정
 *
 * 초보자 가이드:
 * 1. 단일 DataGrid에 PO 목록 + 품목수 표시
 * 2. 등록/수정 버튼 → 우측 PoFormPanel 슬라이드
 * 3. API: GET/POST/PUT/DELETE /material/purchase-orders
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useComCodeMap } from "@/hooks/useComCode";
import {
  ShoppingCart, Plus, Search, RefreshCw,
} from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import PoFormPanel from "./components/PoFormPanel";
import type { PurchaseOrder } from "./components/PoFormPanel";
import { createPoGridColumns } from "./poColumns";

export default function PoPage() {
  const { t } = useTranslation();
  const poStatusMap = useComCodeMap("PO_STATUS");

  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // 발주일 구간 필터 — 기본값 당일(오늘)
  const [fromDate, setFromDate] = useState(getTodayLocal());
  const [toDate, setToDate] = useState(getTodayLocal());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/material/purchase-orders", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = useCallback(() => {
    setEditingPo(null);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((po: PurchaseOrder) => {
    setEditingPo(po);
    setIsFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingPo(null);
  }, []);

  const handleFormSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/material/purchase-orders/${deleteTarget.poNo}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo(() => createPoGridColumns({
    t,
    poStatusMap,
    onEditPo: openEdit,
    onDeletePo: setDeleteTarget,
  }), [t, openEdit, poStatusMap]);

  return (
    <div className="h-full flex overflow-hidden animate-fade-in">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col p-6 gap-4 min-w-0">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-primary" />{t("material.po.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("material.po.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("common.register")}
            </Button>
          </div>
        </div>

        {/* PO 그리드 */}
        <div className="flex-1 min-h-0">
          <Card className="h-full overflow-hidden" padding="none">
            <CardContent className="h-full p-4">
              <DataGrid data={data} columns={columns} isLoading={loading}
                enableColumnFilter enableExport exportFileName={t("material.po.title")}
                onRowClick={(row) => openEdit(row)}
                getRowId={(row) => row.poNo}
                toolbarLeft={
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <Input placeholder={t("material.po.searchPlaceholder")}
                        value={searchText} onChange={e => setSearchText(e.target.value)}
                        leftIcon={<Search className="w-4 h-4" />} fullWidth />
                    </div>
                    {/* 발주일 구간 */}
                    <DateRangeFilter
                      label={t("material.po.orderDate")}
                      from={fromDate}
                      to={toDate}
                      onFromChange={setFromDate}
                      onToChange={setToDate}
                      className="flex-shrink-0"
                    />
                    <div className="w-36 flex-shrink-0">
                      <ComCodeSelect groupCode="PO_STATUS"
                        value={statusFilter} onChange={setStatusFilter} fullWidth />
                    </div>
                  </div>
                }
                sqlQuery={`SELECT *\nFROM PO_HEADERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 사이드패널 */}
      {isFormOpen && (
        <PoFormPanel editData={editingPo} onClose={handleFormClose} onSave={handleFormSave} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.poNo || ""}'${t("common.deleteConfirm") || "을(를) 삭제하시겠습니까?"}`}
      />
    </div>
  );
}
