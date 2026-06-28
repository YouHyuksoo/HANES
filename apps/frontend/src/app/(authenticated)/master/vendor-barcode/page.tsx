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
import { Plus, Search, RefreshCw, ScanLine } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import VendorBarcodeFormPanel, { type VendorBarcodeMapping } from "./components/VendorBarcodeFormPanel";
import { createVendorBarcodeGridColumns, MATCH_TYPE_OPTIONS } from "./vendorBarcodeColumns";

export default function VendorBarcodeMappingPage() {
  const { t } = useTranslation();
  // AI 채팅 페이지 도구(제조사 바코드 매핑 CRUD write 도구) 등록 — backend 실행
  usePageAiTools("master.vendor-barcode");
  const [data, setData] = useState<VendorBarcodeMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VendorBarcodeMapping | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorBarcodeMapping | null>(null);
  const panelAnimateRef = useRef(true);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

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
      await api.delete(`/master/vendor-barcode-mappings/${encodeURIComponent(deleteTarget.vendorBarcode)}`);
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

  const openEdit = useCallback((item: VendorBarcodeMapping) => {
    guard(() => { panelAnimateRef.current = !isPanelOpen; setEditingItem(item); setIsPanelOpen(true); });
  }, [guard, isPanelOpen]);

  const openCreate = useCallback(() => {
    guard(() => { panelAnimateRef.current = !isPanelOpen; setEditingItem(null); setIsPanelOpen(true); });
  }, [guard, isPanelOpen]);

  const matchTypeOptions = useMemo(() => [
    { value: "", label: t("master.vendorBarcode.matchType", "매칭유형") + ": " + t("common.all") },
    ...MATCH_TYPE_OPTIONS.map(o => ({
      value: o.value,
      label: t("master.vendorBarcode.matchType", "매칭유형") + ": " + t(o.labelKey, o.labelFallback),
    })),
  ], [t]);

  const columns = useMemo(() => createVendorBarcodeGridColumns({
    t,
    onEditMapping: openEdit,
    onDeleteMapping: setDeleteTarget,
  }), [t, isPanelOpen, openEdit]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
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
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("master.vendorBarcode.addMapping", "매핑 추가")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={filteredData} columns={columns} isLoading={loading} enableColumnPinning enableColumnFilter enableExport exportFileName={t("master.vendorBarcode.title")}
            onRowClick={(row) => { if (isPanelOpen) guard(() => setEditingItem(row)); }}
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
            } 
            sqlQuery={`SELECT *\nFROM VENDOR_BARCODE_MAPPINGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <VendorBarcodeFormPanel
          editingItem={editingItem}
          onClose={() => guard(handlePanelClose)}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
          onDirtyChange={markDirty}
        />
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={t("master.company.deleteConfirm", {
          name: deleteTarget?.vendorBarcode || "",
          defaultValue: `'${deleteTarget?.vendorBarcode || ""}'을(를) 삭제하시겠습니까?`,
        })}
      />
    </div>
  );
}
