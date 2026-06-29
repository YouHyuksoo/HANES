"use client";

/**
 * @file src/app/(authenticated)/customs/stock/page.tsx
 * @description 보세 자재 재고 현황 페이지
 *
 * 초보자 가이드:
 * 1. **보세 재고**: 수입신고 LOT별 보세 자재 재고 현황
 * 2. **상태**: BONDED(보세중), PARTIAL(일부사용), RELEASED(반출완료)
 * 3. API: GET /customs/stock
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Search, Package } from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createCustomsStockGridColumns } from "./customsStockColumns";
import type { CustomsLot } from "./types";

export default function CustomsStockPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomsLot[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/customs/stock", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createCustomsStockGridColumns(t), [t]);

  const stats = useMemo(() => {
    const bondedLots = data.filter((d) => d.status !== "RELEASED");
    const totalRemain = bondedLots.reduce((sum, d) => sum + d.remainQty, 0);
    return { totalLots: data.length, bondedLots: bondedLots.length, totalRemain };
  }, [data]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t("customs.stock.title")}</h1>
          <p className="text-text-muted mt-1">{t("customs.stock.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("customs.stock.totalLots")} value={stats.totalLots} icon={Package} color="blue" />
        <StatCard label={t("customs.stock.bondedLots")} value={stats.bondedLots} icon={Package} color="purple" />
        <StatCard label={t("customs.stock.totalRemain")} value={stats.totalRemain.toLocaleString()} icon={Package} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("customs.stock.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("customs.stock.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <ComCodeSelect groupCode="CUSTOMS_LOT_STATUS" value={statusFilter} onChange={setStatusFilter} placeholder={t("common.status")} />
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM CUSTOMS_STOCKS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
    </div>
  );
}
