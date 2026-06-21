"use client";

/**
 * @file src/app/(authenticated)/material/arrival-transaction/page.tsx
 * @description 입하수불조회 - MAT_ARRIVAL_TRANSACTIONS 기준 입하/입하취소 원장 조회
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Calendar, History, RefreshCw, Search } from "lucide-react";
import DataGrid from "@/components/data-grid/DataGrid";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import { api } from "@/services/api";
import { getTodayLocal } from "@/utils/date";

interface ArrivalTransactionRow {
  transNo: string;
  transType: "ARRIVAL_IN" | "ARRIVAL_CANCEL" | string;
  transDate: string;
  arrivalNo?: string | null;
  invoiceNo?: string | null;
  vendorName?: string | null;
  itemCode: string;
  itemName?: string | null;
  unit?: string | null;
  matUid?: string | null;
  qty: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  refType?: string | null;
  refId?: string | null;
  cancelRefId?: string | null;
  workerId?: string | null;
  status: string;
  remark?: string | null;
  part?: { itemCode?: string; itemName?: string; unit?: string } | null;
  lot?: { matUid?: string; poNo?: string | null } | null;
  toWarehouse?: { warehouseCode?: string; warehouseName?: string } | null;
}

const getToday = () => getTodayLocal();

const getOneMonthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getTodayLocal(d);
};

const getTransTypeClassName = (type: string) => {
  if (type === "ARRIVAL_CANCEL") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
  if (type === "ARRIVAL_IN") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";
};

const getStatusClassName = (status: string) => {
  if (status === "DONE") {
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  }
  if (status === "CANCELED") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const getSignedQty = (row: ArrivalTransactionRow) => {
  const qty = Number(row.qty ?? 0);
  return row.transType === "ARRIVAL_CANCEL" ? -Math.abs(qty) : qty;
};

export default function ArrivalTransactionPage() {
  const { t } = useTranslation();
  const transTypeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "ARRIVAL_IN", label: t("material.arrivalTransaction.typeIn", "입하") },
    { value: "ARRIVAL_CANCEL", label: t("material.arrivalTransaction.typeCancel", "입하취소") },
  ], [t]);
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "DONE", label: t("material.arrivalTransaction.statusDone", "완료") },
    { value: "CANCELED", label: t("material.arrivalTransaction.statusCanceled", "취소") },
  ], [t]);
  const getTransTypeLabel = useCallback((type: string) => {
    if (type === "ARRIVAL_IN") return t("material.arrivalTransaction.typeIn", "입하");
    if (type === "ARRIVAL_CANCEL") return t("material.arrivalTransaction.typeCancel", "입하취소");
    return type;
  }, [t]);
  const [rows, setRows] = useState<ArrivalTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: getOneMonthAgo(),
    toDate: getToday(),
    transType: "",
    status: "",
    matUid: "",
    search: "",
  });

  const fetchRows = useCallback(async () => {
    if (!filters.fromDate || !filters.toDate) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: "1",
        limit: "5000",
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      };
      if (filters.transType) params.transType = filters.transType;
      if (filters.status) params.status = filters.status;
      if (filters.matUid.trim()) params.matUid = filters.matUid.trim();
      if (filters.search.trim()) params.search = filters.search.trim();

      const res = await api.get("/material/arrivals", { params });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error("입하수불조회 실패:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns = useMemo<ColumnDef<ArrivalTransactionRow>[]>(
    () => [
      {
        accessorKey: "transDate",
        header: t("material.arrivalTransaction.col.transDate", "거래일시"),
        size: 160,
        meta: { filterType: "date" as const },
        cell: ({ row }) => formatDateTime(row.original.transDate),
      },
      {
        accessorKey: "transNo",
        header: t("material.arrivalTransaction.col.transNo", "거래번호"),
        size: 170,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "transType",
        header: t("common.type"),
        size: 110,
        meta: { filterType: "multi" as const },
        cell: ({ row }) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeClassName(row.original.transType)}`}>
            {getTransTypeLabel(row.original.transType)}
          </span>
        ),
      },
      {
        accessorKey: "arrivalNo",
        header: t("material.arrivalTransaction.col.arrivalNo", "입하번호"),
        size: 150,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.arrivalNo || row.original.refId || "-",
      },
      {
        accessorKey: "itemCode",
        header: t("common.partCode"),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.part?.itemCode || row.original.itemCode}
          </span>
        ),
      },
      {
        accessorKey: "itemName",
        header: t("common.partName"),
        size: 180,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.part?.itemName || row.original.itemName || "-",
      },
      {
        accessorKey: "matUid",
        header: "MAT UID",
        size: 170,
        meta: { filterType: "text" as const },
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.lot?.matUid || row.original.matUid || "-"}
          </span>
        ),
      },
      {
        accessorKey: "qty",
        header: t("common.quantity"),
        size: 100,
        meta: { filterType: "number" as const, align: "right" as const },
        cell: ({ row }) => {
          const signedQty = getSignedQty(row.original);
          const unit = row.original.part?.unit || row.original.unit || "";
          return (
            <span className={signedQty < 0 ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-blue-600 dark:text-blue-400"}>
              {signedQty > 0 ? "+" : ""}
              {signedQty.toLocaleString()} {unit}
            </span>
          );
        },
      },
      {
        accessorKey: "warehouseName",
        header: t("material.arrivalTransaction.col.warehouse", "입하창고"),
        size: 140,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.toWarehouse?.warehouseName || row.original.warehouseName || row.original.warehouseCode || "-",
      },
      {
        accessorKey: "refType",
        header: t("material.arrivalTransaction.col.reference", "참조"),
        size: 150,
        meta: { filterType: "text" as const },
        cell: ({ row }) => {
          const ref = [row.original.refType, row.original.refId].filter(Boolean).join(" / ");
          return ref || "-";
        },
      },
      {
        accessorKey: "workerId",
        header: t("material.arrivalTransaction.col.worker", "작업자"),
        size: 100,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.workerId || "-",
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        size: 90,
        meta: { filterType: "multi" as const },
        cell: ({ row }) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClassName(row.original.status)}`}>
            {row.original.status === "DONE"
              ? t("material.arrivalTransaction.statusDone", "완료")
              : row.original.status === "CANCELED"
                ? t("material.arrivalTransaction.statusCanceled", "취소")
                : row.original.status}
          </span>
        ),
      },
      {
        accessorKey: "remark",
        header: t("common.remark"),
        size: 180,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.remark || "-",
      },
    ],
    [t, getTransTypeLabel],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            {t("material.arrivalTransaction.title", "입하수불조회")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.arrivalTransaction.subtitle", "입하재고에 반영되는 입하 및 입하취소 원장을 조회합니다.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchRows}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={rows}
            columns={columns}
            isLoading={loading}
            emptyMessage={t("material.arrivalTransaction.empty", "조회된 입하수불 내역이 없습니다.")}
            enableColumnFilter
            enableExport
            exportFileName={t("material.arrivalTransaction.title", "입하수불조회")}
            toolbarLeft={
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <Input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                    className="w-36"
                  />
                  <span className="text-text-muted">~</span>
                  <Input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                    className="w-36"
                  />
                </div>
                <Select
                  options={transTypeOptions}
                  value={filters.transType}
                  onChange={(v) => setFilters((prev) => ({ ...prev, transType: v }))}
                  placeholder={t("common.type")}
                />
                <Select
                  options={statusOptions}
                  value={filters.status}
                  onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
                  placeholder={t("common.status")}
                />
                <Input
                  value={filters.matUid}
                  onChange={(e) => setFilters((prev) => ({ ...prev, matUid: e.target.value }))}
                  placeholder="MAT UID"
                  className="w-44"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder={t("material.arrivalTransaction.searchPlaceholder", "거래번호, 입하번호, 품목 검색")}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
              </div>
            }
            sqlQuery={`SELECT *\nFROM MAT_ARRIVAL_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY TRANS_DATE DESC`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
