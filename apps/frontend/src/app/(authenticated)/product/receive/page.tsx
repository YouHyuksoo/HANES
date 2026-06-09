"use client";

/**
 * @file src/app/(authenticated)/product/receive/page.tsx
 * @description 제품입고관리 페이지 - 박스 스캔 입고 + 개별입고(모달) 지원
 *
 * 초보자 가이드:
 * 1. 박스 스캔 섹션: 포장 완료 박스를 스캔하여 빠르게 입고
 * 2. 개별입고 버튼: 수동으로 품목/수량 지정하여 입고
 * 3. 완제품(FG)/반제품(WIP) 탭으로 입고 이력 필터링 (FG 기본)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PackageCheck, RefreshCw, Search, ClipboardPlus, ScanLine } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import BoxReceiveList from "./components/BoxReceiveList";
import BoxScanModal from "./components/BoxScanModal";
import ReceiveModal from "./components/ReceiveModal";

interface ProductTransaction {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string;
  prdUid: string | null;
  orderNo: string | null;
  processCode: string | null;
  qty: number;
  status: string;
  remark: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  toWarehouse?: { warehouseName: string } | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ProductReceivePage() {
  const { t } = useTranslation();

  // 완제품(FG) 입고가 기본. 반제품(WIP)은 후순위.
  const [activeTab, setActiveTab] = useState<"SEMI_PRODUCT" | "FINISHED">("FINISHED");
  const [data, setData] = useState<ProductTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);

  /** 입고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const transType = activeTab === "SEMI_PRODUCT" ? "WIP_IN,WIP_IN_CANCEL" : "FG_IN,FG_IN_CANCEL";
      const res = await api.get("/inventory/product/transactions", {
        params: { transType, limit: 500 },
      });
      const body = res.data;
      if (body.success) setData(body.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo<ColumnDef<ProductTransaction>[]>(
    () => [
      {
        accessorKey: "transDate", header: t("productMgmt.receive.col.transDate"), size: 100,
        cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
      },
      {
        accessorKey: "transNo", header: t("productMgmt.receive.col.transNo"), size: 160,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
      },
      {
        accessorKey: "transType", header: t("common.type"), size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as string;
          const cancel = v.includes("CANCEL");
          return (
            <span className={`px-2 py-0.5 rounded text-xs ${cancel ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"}`}>
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
        id: "warehouse", header: t("productMgmt.receive.col.warehouse"), size: 110,
        cell: ({ row }) => row.original.toWarehouse?.warehouseName || "-",
      },
      {
        accessorKey: "qty", header: t("common.quantity"), size: 90,
        meta: { align: "right" as const },
        cell: ({ row }) => {
          const q = row.original.qty;
          const c = q > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
          return (
            <span className={`font-medium ${c}`}>
              {q > 0 ? "+" : ""}{q.toLocaleString()} {row.original.part?.unit || ""}
            </span>
          );
        },
      },
      {
        accessorKey: "orderNo", header: t("productMgmt.receive.col.jobOrderId"), size: 130,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
      },
      {
        accessorKey: "status", header: t("common.status"), size: 80,
        cell: ({ getValue }) => {
          const s = getValue() as string;
          return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
        },
      },
    ],
    [t],
  );

  const tabs = [
    { key: "FINISHED" as const, label: t("productMgmt.receive.tabFg") },
    { key: "SEMI_PRODUCT" as const, label: t("productMgmt.receive.tabWip") },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-primary" />
            {t("productMgmt.receive.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.receive.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button variant="secondary" onClick={() => setIsScanOpen(true)}>
            <ScanLine className="w-4 h-4 mr-1" />
            {t("productMgmt.receive.scanReceive")}
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <ClipboardPlus className="w-4 h-4 mr-1" />
            {t("productMgmt.receive.individualReceive")}
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 좌우 배치: 좌측=입고 대상 박스(Method A), 우측=입고 이력 */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* 좌: 입고 대상 체크선택 일괄입고 */}
        <div className="w-1/2 min-w-0 flex flex-col">
          <BoxReceiveList itemType={activeTab} onSuccess={fetchData} />
        </div>

        {/* 우: 입고 이력 */}
        <Card className="w-1/2 min-w-0 flex flex-col overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("productMgmt.receive.title")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("common.search")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                </div>
              }
              sqlQuery={`SELECT *\nFROM PROD_RECEIVES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
            />
          </CardContent>
        </Card>
      </div>

      {/* 스캔 입고 모달 (Method B) */}
      <BoxScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onSuccess={fetchData}
        itemType={activeTab}
      />

      {/* 개별입고 모달 */}
      <ReceiveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        defaultPartType={activeTab}
      />
    </div>
  );
}
