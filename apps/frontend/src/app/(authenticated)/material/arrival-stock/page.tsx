"use client";

/**
 * @file src/app/(authenticated)/material/arrival-stock/page.tsx
 * @description 입하재고현황 조회 페이지 - 입하된 자재의 현재 재고 현황 조회 전용
 *
 * 초보자 가이드:
 * 1. **조회 전용**: CRUD 없이 DataGrid + 필터만 제공
 * 2. **통계카드**: 입하총량, 현재고합계, 품목수, LOT수
 * 3. API: GET /material/arrivals/stock-status
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Warehouse,
  Search,
  RefreshCw,
  PackageCheck,
  Package,
  Boxes,
  Layers,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ArrivalStockItem {
  id: string;
  arrivalNo: string;
  invoiceNo: string | null;
  poNo: string | null;
  vendorName: string | null;
  itemCode: string;
  itemName: string;
  unit: string;
  lotNo: string;
  arrivalQty: number;
  currentStock: number;
  warehouseName: string;
  arrivalType: string;
  arrivalDate: string;
  manufactureDate: string | null;
  expireDate: string | null;
}

interface ArrivalStockStats {
  totalArrivalQty: number;
  totalCurrentStock: number;
  partCount: number;
  lotCount: number;
}

const arrivalTypeColors: Record<string, string> = {
  PO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  MANUAL: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export default function ArrivalStockPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ArrivalStockItem[]>([]);
  const [stats, setStats] = useState<ArrivalStockStats>({
    totalArrivalQty: 0,
    totalCurrentStock: 0,
    partCount: 0,
    lotCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/material/arrivals/stock-status", { params });
      const result = res.data?.data;
      setData(result?.data ?? []);
      setStats(
        result?.stats ?? {
          totalArrivalQty: 0,
          totalCurrentStock: 0,
          partCount: 0,
          lotCount: 0,
        }
      );
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (val: string | null) => {
    if (!val) return "-";
    return new Date(val).toLocaleDateString("ko-KR");
  };

  const columns = useMemo<ColumnDef<ArrivalStockItem>[]>(
    () => [
      {
        accessorKey: "arrivalNo",
        header: t("material.arrivalStock.arrivalNo"),
        size: 180,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "invoiceNo",
        header: t("material.arrivalStock.invoiceNo"),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "vendorName",
        header: t("material.arrivalStock.vendorName"),
        size: 120,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "itemCode",
        header: t("material.arrivalStock.partCode"),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "itemName",
        header: t("material.arrivalStock.partName"),
        size: 150,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "lotNo",
        header: t("material.arrivalStock.lotNo"),
        size: 170,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "arrivalQty",
        header: t("material.arrivalStock.arrivalQty"),
        size: 100,
        meta: { filterType: "number" as const, align: "right" as const },
        cell: ({ getValue }) => (
          <span>{(getValue() as number).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "currentStock",
        header: t("material.arrivalStock.currentStock"),
        size: 100,
        meta: { filterType: "number" as const, align: "right" as const },
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return (
            <span
              className={
                v === 0
                  ? "text-red-500 dark:text-red-400"
                  : "font-semibold text-green-600 dark:text-green-400"
              }
            >
              {v.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: "unit",
        header: t("material.arrivalStock.unit"),
        size: 60,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "warehouseName",
        header: t("material.arrivalStock.warehouseName"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "arrivalType",
        header: t("material.arrivalStock.arrivalType"),
        size: 90,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${arrivalTypeColors[v] || ""}`}
            >
              {v}
            </span>
          );
        },
      },
      {
        accessorKey: "arrivalDate",
        header: t("material.arrivalStock.arrivalDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        accessorKey: "manufactureDate",
        header: t("material.arrivalStock.manufactureDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        accessorKey: "expireDate",
        header: t("material.arrivalStock.expireDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" />
            {t("material.arrivalStock.title")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.arrivalStock.subtitle")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw
            className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
          />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label={t("material.arrivalStock.stats.totalArrivalQty")}
          value={stats.totalArrivalQty.toLocaleString()}
          icon={PackageCheck}
          color="blue"
        />
        <StatCard
          label={t("material.arrivalStock.stats.totalCurrentStock")}
          value={stats.totalCurrentStock.toLocaleString()}
          icon={Package}
          color="green"
        />
        <StatCard
          label={t("material.arrivalStock.stats.partCount")}
          value={stats.partCount}
          icon={Boxes}
          color="yellow"
        />
        <StatCard
          label={t("material.arrivalStock.stats.lotCount")}
          value={stats.lotCount}
          icon={Layers}
          color="purple"
        />
      </div>

      <Card>
        <CardContent>
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("material.arrivalStock.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("material.arrivalStock.searchPlaceholder")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    fullWidth
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    fullWidth
                  />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
