"use client";

/**
 * @file src/app/(authenticated)/material/hold/page.tsx
 * @description 재고홀드 페이지 - 자재시리얼 홀드/해제 관리
 *
 * 초보자 가이드:
 * 1. **홀드**: 품질 이슈 등으로 자재시리얼 사용 일시 중지
 * 2. **해제**: 이슈 해결 후 다시 사용 가능 상태로 변경
 * 3. API: GET /material/hold, POST /material/hold/hold, POST /material/hold/release
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldAlert, Search, RefreshCw, Lock, Unlock,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DataGrid from "@/components/data-grid/DataGrid";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface HoldLot {
  matUid: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  status: string;
  vendor: string;
  vendorName?: string | null;
  warehouseName?: string;
}

const formatQty = (value?: number | null) => (typeof value === "number" ? value.toLocaleString() : "0");

export default function HoldPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<HoldLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<HoldLot | null>(null);
  const [actionType, setActionType] = useState<"hold" | "release">("hold");
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/hold", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = useCallback(async () => {
    if (!selectedLot?.matUid) return;
    setSaving(true);
    try {
      const url = actionType === "hold" ? "/material/hold/hold" : "/material/hold/release";
      await api.post(url, { matUid: selectedLot.matUid, reason });
      setIsModalOpen(false);
      setReason("");
      setSelectedLot(null);
      fetchData();
    } catch (e) {
      console.error("Hold action failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedLot, actionType, reason, fetchData]);

  const columns = useMemo<ColumnDef<HoldLot>[]>(() => [
    {
      id: "actions", header: "", size: 100, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const isHold = row.original.status === "HOLD";
        return (
          <Button size="sm" className="!h-6 !px-2 !text-xs !gap-1 !rounded-md" variant={isHold ? "secondary" : "primary"} onClick={() => {
            setSelectedLot(row.original);
            setActionType(isHold ? "release" : "hold");
            setReason("");
            setIsModalOpen(true);
          }}>
            {isHold
              ? <><Unlock className="w-4 h-4 mr-1" />{t("material.hold.release")}</>
              : <><Lock className="w-4 h-4 mr-1" />{t("material.hold.hold")}</>}
          </Button>
        );
      },
    },
    {
      accessorKey: "matUid", header: t("common.matUid"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "qty", header: t("material.hold.currentQty"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-semibold">{formatQty(row.original.qty)} {row.original.unit || ""}</span>
      ),
    },
    {
      accessorKey: "vendor", header: t("material.hold.vendor"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || row.original.vendor || "-",
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="MAT_LOT_STATUS" align="center" />, size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="MAT_LOT_STATUS" value={getValue() as string} />,
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary" />
            {t("material.hold.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.hold.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.hold.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.hold.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <ComCodeSelect groupCode="MAT_LOT_STATUS" labelPrefix={t("common.status")}
                  value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          } 
          sqlQuery={`SELECT l.MAT_UID, l.ITEM_CODE, l.CURRENT_QTY, l.STATUS, l.VENDOR,\n       s.WAREHOUSE_CODE, s.AVAILABLE_QTY\nFROM MAT_LOTS l\nLEFT JOIN MAT_STOCKS s\n  ON s.COMPANY = l.COMPANY\n AND s.PLANT_CD = l.PLANT_CD\n AND s.ITEM_CODE = l.ITEM_CODE\n AND s.MAT_UID = l.MAT_UID\nWHERE l.COMPANY = '40'\n  AND l.PLANT_CD = '1000'\nORDER BY l.CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={actionType === "hold" ? t("material.hold.holdTitle") : t("material.hold.releaseTitle")} size="lg">
        {selectedLot && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg border text-sm ${
              actionType === "hold"
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            }`}>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-text-muted">{t("common.matUid")}:</span> <span className="font-mono font-medium">{selectedLot.matUid}</span></div>
                <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedLot.itemCode}</span></div>
                <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedLot.itemName}</div>
                <div><span className="text-text-muted">{t("material.hold.currentQty")}:</span> <span className="font-medium">{formatQty(selectedLot.qty)}</span></div>
              </div>
            </div>
            <Input label={t("material.hold.reason")} placeholder={t("material.hold.reasonPlaceholder")}
              value={reason} onChange={e => setReason(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleAction} disabled={saving}>
                {saving ? t("common.saving") : actionType === "hold" ? t("material.hold.hold") : t("material.hold.release")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
