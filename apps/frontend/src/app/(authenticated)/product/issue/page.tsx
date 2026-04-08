"use client";

/**
 * @file src/app/(authenticated)/product/issue/page.tsx
 * @description 제품출고관리 페이지 - 반제품/완제품 출고 처리 (폐기, 창고이동, 기타)
 *
 * 초보자 가이드:
 * 1. 출고 이력 DataGrid: WIP_OUT, FG_OUT, WIP_OUT_CANCEL, FG_OUT_CANCEL 조회
 * 2. 출고등록 우측 패널: 품목유형(WIP/FG) 선택 → 재고에서 품목 선택 → 출고계정(ISSUE_TYPE) 필수
 * 3. StatCards: 금일 출고건수/수량, WIP/FG 출고 건수
 * 4. API: POST /inventory/wip/issue 또는 POST /inventory/fg/issue
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  PackageX, RefreshCw, Search, Hash, Package, ClipboardPlus,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import ComCodeBadge from "@/components/ui/ComCodeBadge";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import IssueFormPanel, { IssueFormValues } from "./components/IssueFormPanel";

interface ProductIssueTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qty: number;
  status: string;
  issueType: string | null;
  remark: string | null;
  cancelRefId: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ProductIssuePage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductIssueTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  /* 우측 패널 */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /** 출고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        transType: "WIP_OUT,FG_OUT,WIP_OUT_CANCEL,FG_OUT_CANCEL",
        limit: "5000",
      };
      if (startDate) params.dateFrom = startDate;
      if (endDate) params.dateTo = endDate;
      const res = await api.get("/inventory/product/transactions", { params });
      const list = res.data?.data ?? res.data;
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 출고 처리 */
  const handleSubmit = useCallback(async (formValues: IssueFormValues) => {
    setSaving(true);
    try {
      const endpoint = formValues.itemType === "SEMI_PRODUCT" ? "/inventory/wip/issue" : "/inventory/fg/issue";
      await api.post(endpoint, {
        itemCode: formValues.itemCode,
        warehouseCode: formValues.warehouseCode,
        qty: formValues.qty,
        itemType: formValues.itemType,
        transType: formValues.transType,
        issueType: formValues.issueType,
        remark: formValues.remark || undefined,
      });
      setIsPanelOpen(false);
      fetchData();
    } catch (e) {
      console.error("Issue failed:", e);
    } finally {
      setSaving(false);
    }
  }, [fetchData]);

  /** 통계 */
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayDone = data.filter(
      (d) => (d.transType === "WIP_OUT" || d.transType === "FG_OUT") &&
        d.status === "DONE" && String(d.transDate).slice(0, 10) === today,
    );
    return {
      todayCount: todayDone.length,
      todayQty: todayDone.reduce((sum, d) => sum + Math.abs(d.qty), 0),
      wipCount: data.filter((d) => d.transType === "WIP_OUT" && d.status === "DONE").length,
      fgCount: data.filter((d) => d.transType === "FG_OUT" && d.status === "DONE").length,
    };
  }, [data]);

  const columns = useMemo<ColumnDef<ProductIssueTx>[]>(() => [
    {
      accessorKey: "transDate", header: t("productMgmt.issue.col.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.issue.col.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("common.type"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const isCancelType = v.includes("CANCEL");
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${isCancelType ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"}`}>
            {v}
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.part?.itemCode || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.itemName || "-",
    },
    {
      id: "warehouse", header: t("productMgmt.issue.col.warehouse"), size: 110,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "issueType", header: t("productMgmt.issue.col.issueType"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="ISSUE_TYPE" code={v} /> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "qty", header: t("common.quantity"), size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const q = row.original.qty;
        const color = q > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return (
          <span className={`font-medium ${color}`}>
            {q > 0 ? "+" : ""}{q.toLocaleString()} {row.original.part?.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ], [t]);

  return (
    <div className="flex h-full animate-fade-in">
      {/* 메인 영역 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <PackageX className="w-7 h-7 text-primary" />
              {t("productMgmt.issue.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("productMgmt.issue.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => setIsPanelOpen(true)} disabled={isPanelOpen}>
              <ClipboardPlus className="w-4 h-4 mr-1" />
              {t("productMgmt.issue.registerIssue")}
            </Button>
          </div>
        </div>

        {/* StatCards */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("productMgmt.issue.stats.todayCount")} value={stats.todayCount} icon={Hash} color="blue" />
          <StatCard label={t("productMgmt.issue.stats.todayQty")} value={stats.todayQty} icon={Package} color="green" />
          <StatCard label={t("productMgmt.issue.stats.wipCount")} value={stats.wipCount} icon={PackageX} color="yellow" />
          <StatCard label={t("productMgmt.issue.stats.fgCount")} value={stats.fgCount} icon={PackageX} color="purple" />
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
            exportFileName={t("productMgmt.issue.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("productMgmt.issueCancel.searchPlaceholder")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
                </div>
              </div>
            } />
        </CardContent></Card>
      </div>

      {/* 우측 출고등록 패널 */}
      {isPanelOpen && (
        <IssueFormPanel
          onClose={() => setIsPanelOpen(false)}
          onSubmit={handleSubmit}
          loading={saving}
        />
      )}
    </div>
  );
}
