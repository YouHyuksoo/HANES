"use client";

/**
 * @file src/app/(authenticated)/consumables/master/page.tsx
 * @description 소모품 마스터 관리 페이지 — DB API 연동
 *
 * 초보자 가이드:
 * 1. **목록 조회**: GET /consumables (페이지네이션, 검색, 카테고리 필터)
 * 2. **통계 카드**: GET /consumables/summary (전체/경고/교체 건수)
 * 3. **등록/수정**: ConsumableMasterModal 컴포넌트에서 처리
 * 4. **삭제**: DELETE /consumables/:id (소프트 삭제)
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Edit2, RefreshCw, Search, Wrench, AlertTriangle, XCircle, Trash2,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import ConsumableMasterModal, {
  type ConsumableItem,
  type ConsumableFormValues,
} from "@/components/consumables/ConsumableMasterModal";

function ConsumableMasterPage() {
  const { t } = useTranslation();
  const categoryOptions = useComCodeOptions("CONSUMABLE_CATEGORY");

  const [data, setData] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stats, setStats] = useState({ total: 0, warning: 0, replace: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConsumableItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  /* 카테고리 필터 옵션 (전체 + 공통코드) */
  const filterOptions = useMemo(
    () => [{ value: "", label: t("consumables.master.allCategories") }, ...categoryOptions],
    [t, categoryOptions],
  );

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

  /* 통계 조회 */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get("/consumables/summary");
      if (res.data.success) setStats(res.data.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSummary();
  }, [fetchData, fetchSummary]);

  /* 등록/수정 */
  const handleSubmit = async (form: ConsumableFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/consumables/${editing.id}`, form);
      } else {
        await api.post("/consumables", form);
      }
      setModalOpen(false);
      fetchData();
      fetchSummary();
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
      fetchSummary();
    } catch {
      /* ignore */
    } finally {
      setDeleteTarget(null);
    }
  };

  /* 컬럼 정의 */
  const columns = useMemo<ColumnDef<ConsumableItem>[]>(
    () => [
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
        accessorKey: "currentCount",
        header: t("consumables.master.currentCount"),
        size: 100,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString(),
      },
      {
        accessorKey: "expectedLife",
        header: t("consumables.master.expectedLife"),
        size: 100,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString(),
      },
      {
        id: "lifePercentage",
        header: t("consumables.master.life"),
        size: 130,
        meta: { filterType: "none" as const },
        cell: ({ row }) => {
          const { currentCount, expectedLife } = row.original;
          if (!expectedLife) return "-";
          const pct = Math.round((currentCount / expectedLife) * 100);
          const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500";
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="text-xs text-text-muted w-10">{pct}%</span>
            </div>
          );
        },
      },
      { accessorKey: "location", header: t("consumables.master.location"), size: 110, meta: { filterType: "text" as const } },
      { accessorKey: "vendor", header: t("consumables.master.vendor"), size: 100, meta: { filterType: "text" as const } },
      {
        accessorKey: "status",
        header: t("common.status"),
        size: 90,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_STATUS" code={getValue() as string} />,
      },
      {
        id: "actions",
        header: t("common.manage"),
        size: 90,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => { setEditing(row.original); setModalOpen(true); }}
              className="p-1 hover:bg-surface rounded"
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button onClick={() => handleDelete(row.original.id)} className="p-1 hover:bg-surface rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Wrench className="w-7 h-7 text-primary" />
            {t("consumables.master.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("consumables.master.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { fetchData(); fetchSummary(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> {t("consumables.master.register")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("consumables.master.totalConsumables")} value={stats.total} icon={Wrench} color="blue" />
        <StatCard label={t("consumables.master.statusWarning")} value={stats.warning} icon={AlertTriangle} color="yellow" />
        <StatCard label={t("consumables.master.statusReplace")} value={stats.replace} icon={XCircle} color="red" />
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
            toolbarLeft={
              <div className="flex gap-2 items-center">
                <Input placeholder={t("consumables.master.searchPlaceholder")}
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} />
                <Select options={filterOptions} value={categoryFilter} onChange={setCategoryFilter} placeholder={t("consumables.master.category")} />
              </div>
            }
          />
        </CardContent>
      </Card>

      <ConsumableMasterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        item={editing}
        loading={saving}
      />

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
