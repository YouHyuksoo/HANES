"use client";

/**
 * @file src/app/(authenticated)/shipping/customer-po-status/page.tsx
 * @description 고객발주현황 페이지 - 수주 대비 출하 진행률 조회
 *
 * 초보자 가이드:
 * 1. **목적**: 고객발주 대비 출하 진행 현황을 모니터링
 * 2. **출하율**: (출하수량 / 수주수량) x 100
 * 3. **잔량**: 수주수량 - 출하수량
 * 4. API: GET /shipping/customer-orders/status
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Search, RefreshCw, FileText, Loader, TruckIcon, CheckCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createCustomerPoStatusGridColumns } from "./customerPoStatusColumns";
import type { CustomerPoStatus } from "./types";

export default function CustomerPoStatusPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomerPoStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") },
    { value: "IN_PROGRESS", label: t("shipping.customerPoStatus.statusInProgress") },
    { value: "PARTIAL_SHIP", label: t("shipping.customerPoStatus.statusPartialShip") },
    { value: "COMPLETED", label: t("shipping.customerPoStatus.statusCompleted") },
    { value: "OVERDUE", label: t("shipping.customerPoStatus.statusOverdue") },
  ], [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/customer-orders/status", { params });
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
    inProgress: data.filter((d) => d.status === "IN_PROGRESS").length,
    partialShip: data.filter((d) => d.status === "PARTIAL_SHIP").length,
    completed: data.filter((d) => d.status === "COMPLETED").length,
  }), [data]);

  const columns = useMemo(() => createCustomerPoStatusGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BarChart3 className="w-7 h-7 text-primary" />{t("shipping.customerPoStatus.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.customerPoStatus.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("shipping.customerPoStatus.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.customerPoStatus.statusInProgress")} value={stats.inProgress} icon={Loader} color="yellow" />
        <StatCard label={t("shipping.customerPoStatus.statusPartialShip")} value={stats.partialShip} icon={TruckIcon} color="orange" />
        <StatCard label={t("shipping.customerPoStatus.statusCompleted")} value={stats.completed} icon={CheckCircle} color="green" />
      </div>
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("shipping.customerPoStatus.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.customerPoStatus.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM CUSTOMER_PO_STATUS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
