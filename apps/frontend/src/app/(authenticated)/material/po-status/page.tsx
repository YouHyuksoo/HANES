"use client";

/**
 * @file src/app/(authenticated)/material/po-status/page.tsx
 * @description PO현황 페이지 - 좌측 마스터(PO목록) + 우측 디테일(품목 입고현황)
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: PO 목록 (마스터) - 클릭 시 우측에 해당 PO의 품목 입고현황 표시
 * 2. **우측 패널**: 선택된 PO의 품목별 입고율 (디테일)
 * 3. API: GET /material/po-status
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useComCodeMap } from "@/hooks/useComCode";
import { ClipboardList, Search, RefreshCw, Package } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface PoStatusItemRaw {
  id: number;
  poNo: string;
  itemCode: string;
  itemName: string;
  spec: string | null;
  unit: string | null;
  relNo: number | null;
  orderQty: number;
  receivedQty: number;
  receiveRate: number;
}

interface PoStatusRaw {
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalOrderQty: number;
  totalReceivedQty: number;
  receiveRate: number;
  items: PoStatusItemRaw[];
}

export default function PoStatusPage() {
  const { t } = useTranslation();
  const poStatusMap = useComCodeMap("PO_STATUS");

  const [data, setData] = useState<PoStatusRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPo, setSelectedPo] = useState<PoStatusRaw | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/po-status", { params });
      const list = res.data?.data ?? [];
      setData(list);
      if (selectedPo) {
        const updated = list.find((p: PoStatusRaw) => p.poNo === selectedPo.poNo);
        setSelectedPo(updated ?? list[0] ?? null);
      } else if (list.length > 0) {
        setSelectedPo(list[0]);
      }
    } catch {
      setData([]);
      setSelectedPo(null);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 마스터 그리드 컬럼 */
  const masterColumns = useMemo<ColumnDef<PoStatusRaw>[]>(() => [
    {
      accessorKey: "poNo", header: "PO No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "orderDate", header: t("material.po.orderDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 130,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full"
                style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${poStatusMap[s]?.attr1 || ""}`}>
            {poStatusMap[s]?.codeName || s}
          </span>
        );
      },
    },
  ], [t, poStatusMap]);

  /** 디테일 그리드 컬럼 (품목별 입고현황) */
  const detailColumns = useMemo<ColumnDef<PoStatusItemRaw>[]>(() => [
    {
      accessorKey: "itemCode", header: t("material.poStatus.itemCode"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "itemName", header: t("material.poStatus.itemName"), size: 180,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "spec", header: t("material.poStatus.spec"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "unit", header: t("material.poStatus.unit"), size: 60,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "relNo", header: t("material.poStatus.relNo"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="font-mono text-sm">{v ?? "-"}</span>;
      },
    },
    {
      accessorKey: "orderQty", header: t("material.poStatus.orderQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">{((getValue() as number) ?? 0).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "receivedQty", header: t("material.poStatus.receivedQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span>{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 130,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${rate >= 100 ? "bg-green-500" : rate > 0 ? "bg-yellow-500" : "bg-gray-400"}`}
                style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
  ], [t]);

  const detailItems = selectedPo?.items ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("material.poStatus.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.poStatus.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 마스터-디테일 좌우 분할 */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 좌측: PO 마스터 */}
        <div className="col-span-5 min-h-0">
          <Card className="h-full overflow-hidden" padding="none"><CardContent className="h-full p-4">
            <DataGrid data={data} columns={masterColumns} isLoading={loading}
              enableColumnFilter enableExport enableFullscreen
              exportFileName={t("material.poStatus.title")}
              onRowClick={(row) => setSelectedPo(row)}
              selectedRowId={selectedPo?.poNo}
              getRowId={(row) => row.poNo}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("material.poStatus.searchPlaceholder")}
                      value={searchText} onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <ComCodeSelect groupCode="PO_STATUS" labelPrefix={t("common.status")}
                      value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                </div>
              } 
              sqlQuery={`SELECT *\nFROM PO_HEADERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent></Card>
        </div>

        {/* 우측: 품목 입고현황 디테일 */}
        <div className="col-span-7 min-h-0">
          <Card className="h-full overflow-hidden" padding="none">
            <CardContent className="h-full p-4">
              {selectedPo ? (
                <div className="h-full">
                  <DataGrid data={detailItems} columns={detailColumns}
                    enableExport exportFileName={`${selectedPo.poNo}_status`}
                    enableFullscreen 
                    sqlQuery={`SELECT *\nFROM PO_HEADERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                  <Package className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">PO를 선택하면 품목 입고현황이 표시됩니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
