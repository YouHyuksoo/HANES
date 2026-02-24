"use client";

/**
 * @file src/app/(authenticated)/master/part/page.tsx
 * @description 품목 마스터 관리 페이지 - DB API 연동 (Oracle TM_ITEMS 기준 보강)
 *
 * 초보자 가이드:
 * 1. **품목 목록**: GET /master/parts API로 실제 DB 데이터 조회
 * 2. **IQC 설정**: iqcYn=Y 품목에만 IQC 검사기준 설정 버튼 표시
 * 3. **CRUD**: 추가/수정/삭제 모두 API를 통해 DB에 반영
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, Package, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { createPartColumns, createUnitColumn } from "@/lib/table-utils";
import { Part, PART_TYPE_COLORS, PRODUCT_TYPE_OPTIONS } from "./types";
import { INSPECT_METHOD_COLORS } from "../iqc-item/types";
import PartFormPanel from "./components/PartFormPanel";

/** IQC 연결 정보 (API 응답) */
interface IqcLinkInfo {
  partId: string;
  group?: { groupCode: string; groupName: string; inspectMethod: string; sampleQty?: number | null };
  partner?: { partnerCode: string; partnerName: string } | null;
}

export default function PartPage() {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [iqcLinkMap, setIqcLinkMap] = useState<Record<string, IqcLinkInfo[]>>({});
  const [searchText, setSearchText] = useState("");
  const [partTypeFilter, setPartTypeFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const panelAnimateRef = useRef(true);

  /** DB에서 품목 목록 + IQC 연결 정보 조회 */
  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 5000 };
      if (partTypeFilter) params.partType = partTypeFilter;
      if (searchText) params.search = searchText;

      const [partsRes, linksRes] = await Promise.all([
        api.get("/master/parts", { params }),
        api.get("/master/iqc-part-links", { params: { limit: 5000 } }),
      ]);

      const partsBody = partsRes.data;
      if (partsBody.success) {
        setParts(partsBody.data || []);
        setTotal(partsBody.meta?.total || 0);
      }

      const linksBody = linksRes.data;
      if (linksBody.success) {
        const map: Record<string, IqcLinkInfo[]> = {};
        (linksBody.data || []).forEach((link: IqcLinkInfo & { part?: { id: string } }) => {
          const pid = link.partId || link.part?.id;
          if (pid) {
            if (!map[pid]) map[pid] = [];
            map[pid].push(link);
          }
        });
        setIqcLinkMap(map);
      }
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [partTypeFilter, searchText]);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  const handleSearch = (val: string) => { setSearchText(val); };
  const handleTypeFilter = (val: string) => { setPartTypeFilter(val); };

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/parts/${deleteTarget.id}`);
      fetchParts();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchParts]);

  const partTypeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "RAW", label: t("inventory.stock.raw", "원자재") },
    { value: "WIP", label: t("inventory.stock.wip", "반제품") },
    { value: "FG", label: t("inventory.stock.fg", "완제품") },
  ], [t]);

  const typeLabels = useMemo<Record<string, string>>(() => ({
    RAW: t("inventory.stock.raw", "원자재"),
    WIP: t("inventory.stock.wip", "반제품"),
    FG: t("inventory.stock.fg", "완제품"),
  }), [t]);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: t("master.part.iqc.methodFull", "전수"),
    SAMPLE: t("master.part.iqc.methodSample", "샘플"),
    SKIP: t("master.part.iqc.methodSkip", "무검사"),
  }), [t]);

  const productTypeLabels = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    PRODUCT_TYPE_OPTIONS.forEach(o => { if (o.value) map[o.value] = o.label; });
    return map;
  }, []);


  const columns = useMemo<ColumnDef<Part>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPart(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "partNo", header: t("master.part.partNo", "품번"), size: 120, meta: { filterType: "text" as const } },
    ...createPartColumns<Part>(t).map(col => ({ ...col, size: 140 })),
    {
      accessorKey: "partType", header: t("master.part.type"), size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as Part["partType"];
        const cfg = PART_TYPE_COLORS[v];
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cfg?.color || ""}`}>{typeLabels[v] || v}</span>;
      },
    },
    {
      accessorKey: "productType", header: t("master.part.productType", "제품유형"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className="text-xs">{productTypeLabels[v] || v || "-"}</span>;
      },
    },
    { accessorKey: "spec", header: t("master.part.spec"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "rev", header: t("master.part.rev", "Rev"), size: 45 },
    { accessorKey: "custPartNo", header: t("master.part.custPartNo", "고객품번"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "unit", header: t("master.part.unit"), size: 45 },
    { accessorKey: "boxQty", header: t("master.part.boxQty", "박스입수"), size: 70, meta: { filterType: "number" as const } },
    { accessorKey: "lotUnitQty", header: t("master.part.lotUnitQty", "LOT수량"), size: 75, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() ?? "-" },
    {
      accessorKey: "iqcYn", header: t("master.part.iqcFlag", "IQC"), size: 50,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{v}</span>;
      },
    },
    { accessorKey: "tactTime", header: t("master.part.tactTime", "택타임"), size: 65, meta: { filterType: "number" as const }, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? `${v}s` : "-"; } },
    { accessorKey: "expiryDate", header: t("master.part.expiryDate", "유효기간"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? `${v}일` : "-"; } },
    { accessorKey: "packUnit", header: t("master.part.packUnit", "포장단위"), size: 70, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "storageLocation", header: t("master.part.storageLocation", "적재위치"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "vendor", header: t("master.part.vendor"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "customer", header: t("master.part.customer"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      id: "iqcSetup", header: t("master.part.iqc.header", "IQC검사"), size: 100,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        if (row.original.iqcYn !== "Y") return <span className="text-xs text-text-muted">-</span>;
        const links = iqcLinkMap[row.original.id];
        if (!links || links.length === 0) return <span className="text-xs text-text-muted">{t("master.part.iqc.notLinked", "미연결")}</span>;
        const first = links[0];
        if (!first.group) return <span className="text-xs text-text-muted">-</span>;
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[first.group.inspectMethod] || ""}`}>
            {methodLabels[first.group.inspectMethod]}
            {first.group.inspectMethod === "SAMPLE" && first.group.sampleQty ? ` (${first.group.sampleQty})` : ""}
            {links.length > 1 ? ` +${links.length - 1}` : ""}
          </span>
        );
      },
    },
  ], [t, typeLabels, methodLabels, productTypeLabels, iqcLinkMap, isPanelOpen]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingPart(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchParts();
  }, [fetchParts]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" />{t("master.part.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.part.subtitle")} ({total}건)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchParts}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPart(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("master.part.addPart")}
            </Button>
          </div>
        </div>

        <Card><CardContent>
          <DataGrid
            data={parts}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            enableColumnPinning
            exportFileName={t("master.part.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingPart(row); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.part.searchPlaceholder")} value={searchText}
                    onChange={e => handleSearch(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={partTypeOptions} value={partTypeFilter} onChange={handleTypeFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent></Card>
      </div>

      {/* 우측: 품목 추가/수정 슬라이드 패널 */}
      {isPanelOpen && (
        <PartFormPanel
          editingPart={editingPart}
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
        message={`'${deleteTarget?.partCode || ""} (${deleteTarget?.partName || ""})'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
