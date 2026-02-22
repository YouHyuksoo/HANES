"use client";

/**
 * @file src/app/(authenticated)/material/scrap/page.tsx
 * @description 자재폐기 페이지 - 불량/만료 자재 폐기 처리 + 이력 조회
 *
 * 초보자 가이드:
 * 1. **폐기 등록**: LOT/창고/수량/사유 입력 → POST /inventory/scrap
 * 2. **이력 조회**: StockTransaction(transType=SCRAP) 조회
 * 3. **재고 자동 차감**: 폐기 시 Stock.qty 감소, Lot.currentQty 감소
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Trash, Search, RefreshCw, Plus, AlertTriangle } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import ScrapRegisterModal from "./components/ScrapRegisterModal";

interface ScrapRecord {
  id: string;
  transNo: string;
  transDate: string;
  partId: string;
  partCode?: string;
  partName?: string;
  lotNo?: string;
  qty: number;
  warehouseName?: string;
  remark: string;
  status: string;
}

export default function ScrapPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ScrapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { transType: "SCRAP", limit: "5000" };
      if (searchText) params.search = searchText;
      if (startDate) params.dateFrom = startDate;
      if (endDate) params.dateTo = endDate;
      const res = await api.get("/inventory/transactions", { params });
      const raw = res.data?.data ?? [];
      setData(raw.map((r: any) => ({
        id: r.id,
        transNo: r.transNo,
        transDate: r.transDate,
        partId: r.partId,
        partCode: r.part?.partCode || "",
        partName: r.part?.partName || "",
        lotNo: r.lot?.lotNo || r.lotId || "",
        qty: Math.abs(r.qty),
        warehouseName: r.fromWarehouse?.warehouseName || "",
        remark: r.remark || "",
        status: r.status,
      })));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = data.length;
    const totalQty = data.reduce((s, d) => s + d.qty, 0);
    return { total, totalQty };
  }, [data]);

  const columns = useMemo<ColumnDef<ScrapRecord>[]>(() => [
    {
      accessorKey: "transDate", header: t("material.scrap.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("material.scrap.transNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "partName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "lotNo", header: "LOT No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "qty", header: t("material.scrap.qty"), size: 90,
      meta: { align: "right" as const },
      cell: ({ getValue }) => <span className="text-red-600 dark:text-red-400 font-medium">-{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "warehouseName", header: t("material.scrap.warehouse"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "remark", header: t("material.scrap.reason"), size: 180,
      meta: { filterType: "text" as const },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Trash className="w-7 h-7 text-primary" />
            {t("material.scrap.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.scrap.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setShowRegister(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t("material.scrap.register")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label={t("material.scrap.totalCount")} value={stats.total} icon={Trash} color="red" />
        <StatCard label={t("material.scrap.totalQty")} value={stats.totalQty.toLocaleString()} icon={AlertTriangle} color="yellow" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.scrap.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.scrap.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <ScrapRegisterModal isOpen={showRegister} onClose={() => setShowRegister(false)} onCreated={fetchData} />
    </div>
  );
}
