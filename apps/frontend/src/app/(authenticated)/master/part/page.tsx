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
import { Plus, Edit2, Trash2, Search, Package, RefreshCw, ImageIcon, Download } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";
import { useComCodeMap, useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { createPartColumns, createUnitColumn } from "@/lib/table-utils";
import { Part, PART_TYPE_COLORS } from "./types";

import PartFormPanel from "./components/PartFormPanel";

/** 품목 썸네일 — 이미지 로드 실패 시 placeholder 아이콘으로 fallback */
function PartImageThumb({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <ImageIcon className="w-4 h-4 text-text-muted mx-auto" />;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className="w-8 h-8 object-cover rounded border border-border bg-surface mx-auto"
    />
  );
}

export default function PartPage() {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [partTypeFilter, setPartTypeFilter] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("");

  const [erpSyncing, setErpSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const panelAnimateRef = useRef(true);

  /** 검색어 디바운스 (300ms) */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);


  /** DB에서 품목 목록 조회 */
  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 5000 };
      if (partTypeFilter) params.itemType = partTypeFilter;
      if (useYnFilter) params.useYn = useYnFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const partsRes = await api.get("/master/parts", { params });
      const partsBody = partsRes.data;
      if (partsBody.success) {
        setParts(partsBody.data || []);
        setTotal(partsBody.meta?.total || 0);
      }
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [partTypeFilter, useYnFilter, debouncedSearch]);

  /** 초기 로드 */
  useEffect(() => { fetchParts(); }, [fetchParts]);

  const handleSearch = (val: string) => { setSearchText(val); };
  const handleTypeFilter = (val: string) => { setPartTypeFilter(val); };

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/parts/${deleteTarget.itemCode}`);
      fetchParts();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchParts]);

  const typeLabels = useMemo<Record<string, string>>(() => ({
    RAW_MATERIAL: t("inventory.stock.raw", "원자재"),
    SEMI_PRODUCT: t("inventory.stock.wip", "반제품"),
    FINISHED: t("inventory.stock.fg", "완제품"),
    CONSUMABLE: t("inventory.stock.consumable", "소모품"),
  }), [t]);

  // 제품유형: 코드마스터(PRODUCT_TYPE) 기반 — 화면 하드코딩 금지
  const productTypeOptions = useComCodeOptions("PRODUCT_TYPE");
  const productTypeLabels = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    productTypeOptions.forEach((o) => { map[o.value] = o.label; });
    return map;
  }, [productTypeOptions]);

  // 단위 공통코드 맵 (예: EA→개) — 단위 컬럼에 "코드 - 명칭" 표시용
  const unitMap = useComCodeMap("UNIT_TYPE");
  const iqcInspectMethodMap = useComCodeMap("IQC_INSPECT_METHOD");


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
    { accessorKey: "itemNo", header: t("master.part.partNo", "품번"), size: 120, meta: { filterType: "text" as const } },
    {
      accessorKey: "imageUrl", header: t("master.part.image", "사진"), size: 55,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ getValue, row }) => {
        const imageUrl = getValue() as string | null | undefined;
        return imageUrl ? (
          <PartImageThumb src={imageUrl} alt={row.original.itemName} />
        ) : (
          <ImageIcon className="w-4 h-4 text-text-muted mx-auto" />
        );
      },
    },
    ...createPartColumns<Part>(t).map(col => ({ ...col, size: 140 })),
    {
      accessorKey: "itemType", header: t("master.part.type"), size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as Part["itemType"];
        const cfg = PART_TYPE_COLORS[v];
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cfg?.color || ""}`}>{typeLabels[v] || v}</span>;
      },
    },
    {
      accessorKey: "productType", header: t("master.part.productType", "품목그룹"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className="text-xs">{productTypeLabels[v] || v || "-"}</span>;
      },
    },
    { accessorKey: "modelName", header: t("master.part.modelName", "차종"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "spec", header: t("master.part.spec"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "rev", header: t("master.part.rev", "Rev"), size: 45 },
    { accessorKey: "markingText", header: t("master.part.markingText", "마킹문구"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "custPartNo", header: t("master.part.custPartNo", "고객품번"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "unit", header: t("master.part.unit"), size: 90,
      cell: ({ getValue }) => {
        const code = getValue() as string;
        if (!code) return "-";
        const name = unitMap[code]?.codeName;
        return name ? `${code} - ${name}` : code;
      },
    },
    { accessorKey: "color", header: t("master.part.color", "색상"), size: 80, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "boxQty", header: t("master.part.boxQty", "박스장입수량"), size: 90, meta: { filterType: "number" as const } },
    { accessorKey: "minPackQty", header: t("master.part.minPackQty", "최소불출단위수량(자재)"), size: 135, meta: { filterType: "number" as const }, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? v.toLocaleString() : "-"; } },
    { accessorKey: "lotUnitQty", header: t("master.part.lotUnitQty", "묶음단위수량(생산공정품)"), size: 150, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() ?? "-" },
    {
      accessorKey: "inspectMethod", header: t("master.part.inspectMethod", "검사구분"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (!v) return <span className="text-xs text-text-muted">-</span>;
        const colors: Record<string, string> = {
          FULL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
          SKIP: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
        };
        const labels: Record<string, string> = {
          FULL: iqcInspectMethodMap.FULL?.codeName ?? t("master.part.iqc.methodFull", "검사"),
          SKIP: iqcInspectMethodMap.SKIP?.codeName ?? t("master.part.inspectSkip", "무검사"),
        };
        return <span className={`px-2 py-0.5 text-xs rounded-full ${colors[v] || ""}`}>{labels[v] || v}</span>;
      },
    },
    { accessorKey: "sampleQty", header: t("master.part.basicSampleQty", "기본시료수"), size: 80, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() ?? "-" },
    { accessorKey: "iqcAqlPolicyCode", header: t("master.part.iqcAqlPolicyCode", "AQL 정책"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "expiryDate", header: t("master.part.expiryDate", "유효기간"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? `${v}일` : "-"; } },
    { accessorKey: "expiryExtDays", header: t("master.part.expiryExtDays", "연장기간"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? `${v}일` : "-"; } },
    { accessorKey: "packUnit", header: t("master.part.palletUnit", "팔레트구성단위"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "storageLocation", header: t("master.part.storageLocation", "품목고정 적재로케이션"), size: 130, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "useYn", header: t("common.useYn", "사용여부"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y" 
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
            {v === "Y" ? "Y" : "N"}
          </span>
        );
      },
    },
  ], [t, typeLabels, productTypeLabels, unitMap, iqcInspectMethodMap, isPanelOpen]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingPart(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchParts();
  }, [fetchParts]);

  const handleErpSync = useCallback(async () => {
    setErpSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post("/interface/inbound/item-master");
      const { insert, update } = res.data.data ?? {};
      setSyncResult({ ok: true, msg: `동기화 완료 — 신규 ${insert ?? 0}건, 변경 ${update ?? 0}건` });
      fetchParts();
    } catch (e: any) {
      setSyncResult({ ok: false, msg: `동기화 실패: ${e?.response?.data?.message ?? e.message}` });
    } finally {
      setErpSyncing(false);
    }
  }, [fetchParts]);

  return (
    <div className="flex h-full animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" />{t("master.part.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.part.subtitle")} ({total}건)</p>
          </div>
          <div className="flex gap-2 items-center">
            {syncResult && (
              <span className={`text-xs px-3 py-1.5 rounded border ${syncResult.ok ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" : "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"}`}>
                {syncResult.msg}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={handleErpSync} disabled={erpSyncing}>
              <Download className={`w-4 h-4 mr-1 ${erpSyncing ? "animate-bounce" : ""}`} />ERP 동기화
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { fetchParts(); }}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPart(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("master.part.addPart")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={parts}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            enableColumnPinning
            exportFileName={t("master.part.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingPart(row); }}
            rowClassName={(row) => row.useYn === "N" ? "!text-red-500 dark:!text-red-400" : ""}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.part.searchPlaceholder")} value={searchText}
                    onChange={e => handleSearch(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <ComCodeSelect groupCode="ITEM_TYPE" value={partTypeFilter} onChange={handleTypeFilter} labelPrefix={t("master.part.type")} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} fullWidth />
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM ITEM_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>


      {/* 우측: 품목 추가/수정 슬라이드 패널 */}
      {isPanelOpen && (
        <PartFormPanel
          key={editingPart?.itemCode ?? "__new__"}
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
        message={`'${deleteTarget?.itemCode || ""} (${deleteTarget?.itemName || ""})'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
