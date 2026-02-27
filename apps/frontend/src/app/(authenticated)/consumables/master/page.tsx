"use client";

/**
 * @file src/app/(authenticated)/consumables/master/page.tsx
 * @description 소모품 마스터 관리 페이지 — DB API 연동
 *
 * 초보자 가이드:
 * 1. **목록 조회**: GET /consumables (페이지네이션, 검색, 카테고리 필터)
 * 2. **통계 카드**: GET /consumables/summary (전체/경고/교체 건수)
 * 3. **등록/수정**: 우측 슬라이드 패널(ConsumableFormPanel)에서 처리
 * 4. **삭제**: DELETE /consumables/:id (소프트 삭제)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Edit2, RefreshCw, Search, Wrench, Package, Trash2,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import ConsumableFormPanel, {
  type ConsumableItem,
  type ConsumableFormValues,
} from "./components/ConsumableFormPanel";

function ConsumableMasterPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ConsumableItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const panelAnimateRef = useRef(true);

  /* 목록 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100, useYn: "Y" };
      if (categoryFilter) params.category = categoryFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get("/consumables", { params });
      if (res.data.success) setData(res.data.data || []);
    } catch {
      /* 에러는 api 인터셉터에서 처리 */
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchTerm]);

  /* 통계: 데이터에서 카테고리별 집계 */
  const computedStats = useMemo(() => ({
    total: data.length,
    mold: data.filter(d => d.category === "MOLD").length,
    jig: data.filter(d => d.category === "JIG").length,
    tool: data.filter(d => d.category === "TOOL").length,
  }), [data]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* 등록/수정 */
  const handleSubmit = async (form: ConsumableFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/consumables/${editing.id}`, form);
      } else {
        await api.post("/consumables", form);
      }
      setIsPanelOpen(false);
      setEditing(null);
      fetchData();
    } catch {
      /* 에러는 인터셉터 처리 */
    } finally {
      setSaving(false);
    }
  };

  /* 삭제 */
  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/consumables/${deleteTarget}`);
      fetchData();
    } catch {
      /* ignore */
    } finally {
      setDeleteTarget(null);
    }
  };

  /* 패널 닫기 */
  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditing(null);
    panelAnimateRef.current = true;
  }, []);

  /* 컬럼 정의 */
  const columns = useMemo<ColumnDef<ConsumableItem>[]>(
    () => [
      {
        id: "actions",
        header: t("common.manage"),
        size: 90,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditing(row.original); setIsPanelOpen(true); }}
              className="p-1 hover:bg-surface rounded"
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id); }} className="p-1 hover:bg-surface rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
      {
        id: "image",
        header: t("consumables.master.sectionImage", "이미지"),
        size: 60,
        meta: { filterType: "none" as const, align: "center" as const },
        cell: ({ row }) => row.original.imageUrl ? (
          <img src={row.original.imageUrl} alt="" className="w-8 h-8 object-cover rounded border border-border" />
        ) : (
          <span className="text-text-muted text-xs">-</span>
        ),
      },
      { accessorKey: "consumableCode", header: t("consumables.master.code"), size: 120, meta: { filterType: "text" as const } },
      { accessorKey: "consumableName", header: t("consumables.master.name"), size: 170, meta: { filterType: "text" as const } },
      {
        accessorKey: "category",
        header: t("consumables.master.category"),
        size: 80,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} />,
      },
      {
        accessorKey: "expectedLife",
        header: t("consumables.master.expectedLife"),
        size: 100,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return v ? v.toLocaleString() : "-";
        },
      },
      {
        accessorKey: "safetyStock",
        header: t("consumables.master.safetyStock", "안전재고"),
        size: 80,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString(),
      },
      { accessorKey: "location", header: t("consumables.master.location"), size: 110, meta: { filterType: "text" as const } },
      { accessorKey: "vendor", header: t("consumables.master.vendor"), size: 100, meta: { filterType: "text" as const } },
      {
        accessorKey: "unitPrice",
        header: t("consumables.master.unitPrice", "단가"),
        size: 100,
        meta: { filterType: "number" as const, align: "right" as const },
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return v ? `${v.toLocaleString()}` : "-";
        },
      },
    ],
    [t, isPanelOpen],
  );

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Wrench className="w-7 h-7 text-primary" />
              {t("consumables.master.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("consumables.master.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditing(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> {t("consumables.master.register")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <StatCard label={t("consumables.master.totalConsumables")} value={computedStats.total} icon={Wrench} color="blue" />
          <StatCard label={t("consumables.master.mold")} value={computedStats.mold} icon={Package} color="purple" />
          <StatCard label={t("consumables.master.jig")} value={computedStats.jig} icon={Package} color="green" />
          <StatCard label={t("consumables.master.tool")} value={computedStats.tool} icon={Package} color="yellow" />
        </div>

        <Card>
          <CardContent>
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("consumables.master.title")}
              onRowClick={(row) => { if (isPanelOpen) { panelAnimateRef.current = false; setEditing(row); } }}
              toolbarLeft={
                <div className="flex gap-2 items-center">
                  <Input placeholder={t("consumables.master.searchPlaceholder")}
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} />
                  <ComCodeSelect groupCode="CONSUMABLE_CATEGORY" value={categoryFilter} onChange={setCategoryFilter} placeholder={t("consumables.master.category")} />
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* 우측: 소모품 등록/수정 슬라이드 패널 */}
      {isPanelOpen && (
        <ConsumableFormPanel
          item={editing}
          onClose={handlePanelClose}
          onSubmit={handleSubmit}
          loading={saving}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("common.delete")}
        message={t("common.confirmDelete", "삭제하시겠습니까?")}
      />
    </div>
  );
}

export default ConsumableMasterPage;
