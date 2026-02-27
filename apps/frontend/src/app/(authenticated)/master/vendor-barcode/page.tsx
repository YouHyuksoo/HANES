"use client";

/**
 * @file src/app/(authenticated)/master/vendor-barcode/page.tsx
 * @description 제조사 바코드 매핑 관리 페이지
 *
 * 초보자 가이드:
 * 1. 제조사가 부여한 바코드를 MES 품목과 매핑
 * 2. 매칭 유형: EXACT(정확일치), PREFIX(접두사), REGEX(정규식)
 * 3. 추가/수정은 우측 슬라이드 패널에서 처리
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, ScanLine } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import VendorBarcodeFormPanel, { type VendorBarcodeMapping } from "./components/VendorBarcodeFormPanel";

const MATCH_TYPE_OPTIONS = [
  { value: "EXACT", label: "정확 일치" },
  { value: "PREFIX", label: "접두사" },
  { value: "REGEX", label: "정규식" },
];

const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PREFIX: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  REGEX: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function VendorBarcodeMappingPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<VendorBarcodeMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VendorBarcodeMapping | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorBarcodeMapping | null>(null);
  const panelAnimateRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/vendor-barcode-mappings", { params: { limit: 5000 } });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => data.filter((item) => {
    if (matchTypeFilter && item.matchType !== matchTypeFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      item.vendorBarcode.toLowerCase().includes(s) ||
      (item.itemCode ?? "").toLowerCase().includes(s) ||
      (item.itemName ?? "").toLowerCase().includes(s) ||
      (item.vendorName ?? "").toLowerCase().includes(s)
    );
  }), [data, searchText, matchTypeFilter]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/vendor-barcode-mappings/${deleteTarget.id}`);
      fetchData();
    } catch (e: unknown) {
      console.error("Delete error:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingItem(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const matchTypeOptions = useMemo(() => [
    { value: "", label: t("master.vendorBarcode.matchType", "매칭유형") },
    ...MATCH_TYPE_OPTIONS.map(o => ({
      value: o.value,
      label: t(`master.vendorBarcode.match${o.value.charAt(0) + o.value.slice(1).toLowerCase()}`, o.label),
    })),
  ], [t]);

  const columns = useMemo<ColumnDef<VendorBarcodeMapping>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingItem(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "vendorBarcode", header: t("master.vendorBarcode.vendorBarcode", "제조사 바코드"), size: 200,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded">{getValue() as string}</span>
      ),
    },
    { accessorKey: "itemCode", header: t("master.vendorBarcode.partCode", "품번"), size: 120 },
    { accessorKey: "itemName", header: t("master.vendorBarcode.partName", "품명"), size: 150 },
    { accessorKey: "vendorCode", header: t("master.vendorBarcode.vendorCode", "제조사코드"), size: 100 },
    { accessorKey: "vendorName", header: t("master.vendorBarcode.vendorName", "제조사명"), size: 120 },
    {
      accessorKey: "matchType", header: t("master.vendorBarcode.matchType", "매칭유형"), size: 90,
      meta: { filterType: "multi" as const, filterOptions: MATCH_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label })) },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${MATCH_TYPE_COLORS[v] ?? ""}`}>{v}</span>;
      },
    },
    { accessorKey: "mappingRule", header: t("master.vendorBarcode.mappingRule", "매핑규칙"), size: 150 },
    {
      accessorKey: "useYn", header: t("master.vendorBarcode.useYn", "사용"), size: 50,
      meta: { filterType: "multi" as const, filterOptions: [{ value: "Y", label: "Y" }, { value: "N", label: "N" }] },
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
  ], [t, isPanelOpen]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ScanLine className="w-7 h-7 text-primary" />
              {t("master.vendorBarcode.title", "제조사 바코드 매핑")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.vendorBarcode.subtitle", "제조사 바코드를 MES 품번과 매핑")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingItem(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("master.vendorBarcode.addMapping", "매핑 추가")}
            </Button>
          </div>
        </div>

        <Card><CardContent>
          <DataGrid data={filteredData} columns={columns} isLoading={loading} enableColumnPinning enableExport exportFileName={t("master.vendorBarcode.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingItem(row); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.vendorBarcode.searchPlaceholder", "바코드, 품번, 품명 검색...")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={matchTypeOptions} value={matchTypeFilter} onChange={setMatchTypeFilter} fullWidth />
                </div>
              </div>
            } />
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <VendorBarcodeFormPanel
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
        message={`'${deleteTarget?.vendorBarcode || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
