"use client";

/**
 * @file src/app/(authenticated)/inspection/protocol/page.tsx
 * @description 검사기 프로토콜 설정 페이지 - EQUIP_PROTOCOLS CRUD 관리
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 프로토콜 목록 표시 (검색, 필터, 내보내기 지원)
 * 2. **우측 패널**: 추가/수정 폼 (ProtocolFormPanel)
 * 3. **API**: GET/POST/PUT/DELETE /quality/continuity-inspect/protocols
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, ScanLine, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { UseYnSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import ProtocolFormPanel, { Protocol } from "./components/ProtocolFormPanel";

export default function ProtocolPage() {
  const { t } = useTranslation();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Protocol | null>(null);
  const panelAnimateRef = useRef(true);

  /** 검색어 디바운스 (300ms) */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  /** DB에서 프로토콜 목록 조회 */
  const fetchProtocols = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/protocols");
      if (res.data.success) {
        let data: Protocol[] = res.data.data || [];
        if (useYnFilter) data = data.filter(p => p.useYn === useYnFilter);
        if (debouncedSearch) {
          const s = debouncedSearch.toLowerCase();
          data = data.filter(p =>
            p.protocolId.toLowerCase().includes(s) ||
            p.protocolName.toLowerCase().includes(s),
          );
        }
        setProtocols(data);
      }
    } catch { setProtocols([]); } finally { setLoading(false); }
  }, [useYnFilter, debouncedSearch]);

  useEffect(() => { fetchProtocols(); }, [fetchProtocols]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/quality/continuity-inspect/protocols/${deleteTarget.protocolId}`);
      fetchProtocols();
    } catch (e) { console.error("Delete failed:", e); }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, fetchProtocols]);

  const columns = useMemo<ColumnDef<Protocol>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingProtocol(row.original); setIsPanelOpen(true); }}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "protocolId", header: t("inspection.protocol.protocolId"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "protocolName", header: t("inspection.protocol.protocolName"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "commType", header: t("inspection.protocol.commType"), size: 90, meta: { filterType: "multi" as const } },
    { accessorKey: "delimiter", header: t("inspection.protocol.delimiter"), size: 70 },
    { accessorKey: "passValue", header: t("inspection.protocol.passValue"), size: 80 },
    { accessorKey: "failValue", header: t("inspection.protocol.failValue"), size: 80 },
    { accessorKey: "sampleData", header: t("inspection.protocol.sampleData"), size: 200, cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return <span className="text-xs text-text-muted truncate">{v || "-"}</span>;
    }},
    {
      accessorKey: "useYn", header: t("common.useYn"), size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
            {v}
          </span>
        );
      },
    },
  ], [t, isPanelOpen]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingProtocol(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => { fetchProtocols(); }, [fetchProtocols]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ScanLine className="w-7 h-7 text-primary" />
              {t("inspection.protocol.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("inspection.protocol.subtitle")} ({protocols.length})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => fetchProtocols()}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingProtocol(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("inspection.protocol.addProtocol")}
            </Button>
          </div>
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={protocols}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("inspection.protocol.title")}
              onRowClick={row => { if (isPanelOpen) setEditingProtocol(row); }}
              rowClassName={row => row.useYn === "N" ? "!text-red-500 dark:!text-red-400" : ""}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("inspection.protocol.searchPlaceholder")} value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} fullWidth />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* 우측 패널 */}
      {isPanelOpen && (
        <ProtocolFormPanel
          editingProtocol={editingProtocol}
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
        message={`'${deleteTarget?.protocolId || ""} (${deleteTarget?.protocolName || ""})'${t("common.deleteConfirmSuffix", "을(를) 삭제하시겠습니까?")}`}
      />
    </div>
  );
}
