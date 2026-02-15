"use client";

/**
 * @file src/app/(authenticated)/master/part/page.tsx
 * @description 품목 마스터 관리 페이지 - DB API 연동 (Oracle TM_ITEMS 기준 보강)
 *
 * 초보자 가이드:
 * 1. **품목 목록**: GET /master/parts API로 실제 DB 데이터 조회
 * 2. **IQC 설정**: iqcFlag=Y 품목에만 IQC 검사기준 설정 버튼 표시
 * 3. **CRUD**: 추가/수정/삭제 모두 API를 통해 DB에 반영
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Search, Download, Package, FlaskConical, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { Part, PartIqcLink, seedPartIqcLinks, PART_TYPE_COLORS, PRODUCT_TYPE_OPTIONS } from "./types";
import { INSPECT_METHOD_COLORS, seedIqcGroups } from "../iqc-item/types";
import IqcSettingModal from "./components/IqcSettingModal";
import PartFormModal from "./components/PartFormModal";

export default function PartPage() {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [iqcLinks, setIqcLinks] = useState<PartIqcLink[]>(seedPartIqcLinks);
  const [searchText, setSearchText] = useState("");
  const [partTypeFilter, setPartTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [iqcTarget, setIqcTarget] = useState<Part | null>(null);

  const PAGE_SIZE = 20;

  /** DB에서 품목 목록 조회 */
  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (partTypeFilter) params.partType = partTypeFilter;
      if (searchText) params.search = searchText;

      const res = await api.get("/master/parts", { params });
      const body = res.data;
      if (body.success) {
        setParts(body.data || []);
        setTotal(body.meta?.total || 0);
      }
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [page, partTypeFilter, searchText]);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  /** 검색 시 page를 1로 리셋 */
  const handleSearch = (val: string) => { setSearchText(val); setPage(1); };
  const handleTypeFilter = (val: string) => { setPartTypeFilter(val); setPage(1); };

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

  const getIqcLink = (partCode: string) => iqcLinks.find(l => l.partCode === partCode);

  const handleIqcSave = (link: PartIqcLink) => {
    setIqcLinks(prev => {
      const idx = prev.findIndex(l => l.partCode === link.partCode);
      if (idx >= 0) return prev.map((l, i) => i === idx ? link : l);
      return [...prev, link];
    });
  };

  const handleIqcUnlink = (partCode: string) => {
    setIqcLinks(prev => prev.filter(l => l.partCode !== partCode));
  };

  const columns = useMemo<ColumnDef<Part>[]>(() => [
    { accessorKey: "partNo", header: t("master.part.partCode"), size: 160 },
    { accessorKey: "partCode", header: "No.", size: 60 },
    { accessorKey: "partName", header: t("master.part.partName"), size: 150 },
    {
      accessorKey: "partType", header: t("master.part.type"), size: 70,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const cfg = PART_TYPE_COLORS[v];
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cfg?.color || ""}`}>{typeLabels[v] || v}</span>;
      },
    },
    {
      accessorKey: "productType", header: t("master.part.productType", "제품유형"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className="text-xs">{productTypeLabels[v] || v || "-"}</span>;
      },
    },
    { accessorKey: "spec", header: t("master.part.spec"), size: 130 },
    { accessorKey: "rev", header: t("master.part.rev", "Rev"), size: 45 },
    { accessorKey: "custPartNo", header: t("master.part.custPartNo", "고객품번"), size: 120, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "unit", header: t("master.part.unit"), size: 45 },
    { accessorKey: "boxQty", header: t("master.part.boxQty", "박스입수"), size: 70 },
    { accessorKey: "lotUnitQty", header: t("master.part.lotUnitQty", "LOT수량"), size: 75, cell: ({ getValue }) => getValue() ?? "-" },
    {
      accessorKey: "iqcFlag", header: t("master.part.iqcFlag", "IQC"), size: 50,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>{v}</span>;
      },
    },
    { accessorKey: "tactTime", header: t("master.part.tactTime", "택타임"), size: 65, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? `${v}s` : "-"; } },
    { accessorKey: "expiryDate", header: t("master.part.expiryDate", "유효기간"), size: 70, cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? `${v}일` : "-"; } },
    { accessorKey: "vendor", header: t("master.part.vendor"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "customer", header: t("master.part.customer"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    {
      id: "iqcSetup", header: t("master.part.iqc.header", "IQC설정"), size: 80,
      cell: ({ row }) => {
        if (row.original.iqcFlag !== "Y") return <span className="text-xs text-text-muted">-</span>;
        const link = getIqcLink(row.original.partCode);
        if (!link) return (
          <button onClick={() => setIqcTarget(row.original)} className="text-xs text-primary hover:underline">
            {t("master.part.iqc.setup", "설정")}
          </button>
        );
        const group = seedIqcGroups.find(g => g.groupCode === link.groupCode);
        if (!group) return <span className="text-xs text-text-muted">-</span>;
        return (
          <button onClick={() => setIqcTarget(row.original)} className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[group.inspectMethod]}`}>
            {methodLabels[group.inspectMethod]}{group.inspectMethod === "SAMPLE" && group.sampleQty ? `(${group.sampleQty})` : ""}
          </button>
        );
      },
    },
    {
      id: "actions", header: t("common.actions"), size: 70,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditingPart(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          {row.original.iqcFlag === "Y" && (
            <button onClick={() => setIqcTarget(row.original)} className="p-1 hover:bg-surface rounded" title="IQC">
              <FlaskConical className="w-4 h-4 text-purple-500" />
            </button>
          )}
        </div>
      ),
    },
  ], [t, typeLabels, methodLabels, productTypeLabels, iqcLinks]);

  return (
    <div className="space-y-6 animate-fade-in">
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
          <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t("common.excel")}</Button>
          <Button size="sm" onClick={() => { setEditingPart(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />{t("master.part.addPart")}
          </Button>
        </div>
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input placeholder={t("master.part.searchPlaceholder")} value={searchText}
              onChange={e => handleSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <div className="w-40">
            <Select options={partTypeOptions} value={partTypeFilter} onChange={handleTypeFilter} fullWidth />
          </div>
        </div>
        <DataGrid data={parts} columns={columns} pageSize={PAGE_SIZE} />
      </CardContent></Card>

      {/* 품목 추가/수정 모달 */}
      <PartFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        editingPart={editingPart} onSave={fetchParts} />

      {/* IQC 검사기준 설정 모달 */}
      {iqcTarget && (
        <IqcSettingModal isOpen={!!iqcTarget} onClose={() => setIqcTarget(null)} part={iqcTarget}
          currentLink={getIqcLink(iqcTarget.partCode)} onSave={handleIqcSave} onUnlink={handleIqcUnlink} />
      )}
    </div>
  );
}
