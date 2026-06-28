"use client";

/**
 * @file src/app/(authenticated)/shipping/customer-po/page.tsx
 * @description 고객발주관리 페이지 - 고객 수주 CRUD (우측 패널 방식)
 *
 * 초보자 가이드:
 * 1. **고객발주**: 고객이 우리 회사에 발주한 주문서 관리
 * 2. **상태 흐름**: RECEIVED -> CONFIRMED -> IN_PRODUCTION -> PARTIAL_SHIP -> SHIPPED -> CLOSED
 * 3. **우측 패널**: 추가/수정 폼은 우측 슬라이드 패널에서 처리
 * 4. API: GET/POST/PUT/DELETE /shipping/customer-orders
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart, Plus, Search, RefreshCw,
  FileText, Clock, CheckCircle, Factory, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import CustomerPoFormPanel, { type CustomerOrder } from "./components/CustomerPoFormPanel";
import api from "@/services/api";
import { createCustomerPoGridColumns } from "./customerPoColumns";

export default function CustomerPoPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomerOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerOrder | null>(null);
  const panelAnimateRef = useRef(true);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/customer-orders", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    received: data.filter((d) => d.status === "RECEIVED").length,
    confirmed: data.filter((d) => d.status === "CONFIRMED").length,
    inProduction: data.filter((d) => d.status === "IN_PRODUCTION").length,
    shipped: data.filter((d) => d.status === "SHIPPED" || d.status === "CLOSED").length,
  }), [data]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingItem(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/shipping/customer-orders/${deleteTarget.id}`);
      fetchData();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo(() => createCustomerPoGridColumns({
    t,
    isPanelOpen,
    onEditOrder: (order, shouldAnimate) => {
      panelAnimateRef.current = shouldAnimate;
      setEditingItem(order);
      setIsPanelOpen(true);
    },
    onDeleteOrder: setDeleteTarget,
  }), [t, isPanelOpen]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-primary" />{t("shipping.customerPo.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("shipping.customerPo.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingItem(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("common.register")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 flex-shrink-0">
          <StatCard label={t("shipping.customerPo.statTotal")} value={stats.total} icon={FileText} color="blue" />
          <StatCard label={t("shipping.customerPo.statusReceived")} value={stats.received} icon={Clock} color="gray" />
          <StatCard label={t("shipping.customerPo.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
          <StatCard label={t("shipping.customerPo.statusInProduction")} value={stats.inProduction} icon={Factory} color="yellow" />
          <StatCard label={t("shipping.customerPo.statusShipped")} value={stats.shipped} icon={Truck} color="purple" />
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("shipping.customerPo.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingItem(row); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("shipping.customerPo.searchPlaceholder")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <ComCodeSelect groupCode="SHIPMENT_STATUS" labelPrefix={t('common.status')} value={statusFilter} onChange={setStatusFilter} fullWidth />
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM CUSTOMER_POS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <CustomerPoFormPanel
          key={editingItem?.id ?? "__new__"}
          editingItem={editingItem}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.orderNo || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
