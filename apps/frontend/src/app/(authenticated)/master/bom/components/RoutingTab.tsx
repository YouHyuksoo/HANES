"use client";

/**
 * @file src/app/(authenticated)/master/bom/components/RoutingTab.tsx
 * @description 라우팅(공정순서) 탭 - 품목별 API 연동 (GET /master/routings?partId=xxx)
 *
 * 초보자 가이드:
 * 1. **routingTarget**: BOM에서 특정 아이템 클릭 시 해당 아이템의 partId로 조회
 * 2. **routingTarget 없으면**: 최상위 부모품목의 id로 조회
 * 3. **CRUD**: POST/PUT/DELETE /master/routings 로 공정순서 관리
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button, ConfirmModal, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import RoutingFormModal from "./RoutingFormModal";
import { ParentPart, RoutingItem, RoutingTarget } from "../types";

interface RoutingTabProps {
  selectedParent: ParentPart | null;
  routingTarget?: RoutingTarget | null;
  onClearTarget?: () => void;
}

export default function RoutingTab({ selectedParent, routingTarget, onClearTarget }: RoutingTabProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<RoutingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoutingItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<RoutingItem | null>(null);

  const partId = routingTarget?.partId || selectedParent?.id || "";
  const targetCode = routingTarget?.partCode || selectedParent?.partCode || "";
  const targetName = routingTarget?.partName || selectedParent?.partName || "";

  /** API에서 라우팅 데이터 조회 */
  const fetchRoutings = useCallback(async () => {
    if (!partId) { setData([]); return; }
    setLoading(true);
    try {
      const res = await api.get("/master/routings", { params: { partId, limit: 5000 } });
      setData(res.data?.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [partId]);

  useEffect(() => { fetchRoutings(); }, [fetchRoutings]);

  const handleDelete = useCallback(async () => {
    if (!deletingItem) return;
    try {
      await api.delete(`/master/routings/${deletingItem.id}`);
      setDeletingItem(null);
      fetchRoutings();
    } catch { /* API 에러는 인터셉터에서 처리 */ }
  }, [deletingItem, fetchRoutings]);

  const columns = useMemo<ColumnDef<RoutingItem>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-center">
          <button onClick={() => { setEditingItem(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeletingItem(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "seq", header: t("master.routing.seq"), size: 60, meta: { filterType: "number" as const } },
    { accessorKey: "processCode", header: t("master.routing.processCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "processName", header: t("master.routing.processName"), size: 140, meta: { filterType: "text" as const } },
    {
      accessorKey: "processType", header: t("master.routing.processType"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return val ? <ComCodeBadge groupCode="PROCESS_TYPE" code={val} /> : "-";
      },
    },
    { accessorKey: "equipType", header: t("master.routing.equipType"), size: 80, meta: { filterType: "text" as const } },
    { accessorKey: "stdTime", header: t("master.routing.stdTime"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-" },
    { accessorKey: "setupTime", header: t("master.routing.setupTime"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => getValue() != null ? `${getValue()}s` : "-" },
    {
      accessorKey: "useYn", header: t("master.routing.use"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />,
    },
  ], [t]);

  if (!selectedParent) {
    return <div className="flex items-center justify-center h-64 text-text-muted">{t("master.bom.selectParentPrompt")}</div>;
  }

  return (
    <>
      {routingTarget && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-purple-600 dark:text-purple-400 font-medium">{t("master.bom.routingViewTarget", "라우팅 조회 대상")}:</span>
            <span className="text-text-muted font-mono text-xs">{routingTarget.breadcrumb}</span>
          </div>
          <button onClick={onClearTarget}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-purple-100 dark:hover:bg-purple-800/50 text-purple-600 dark:text-purple-400 transition-colors">
            <ArrowLeft className="w-3 h-3" />
            {t("master.bom.viewAllRouting", "전체 라우팅 보기")}
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text">{targetCode}</p>
          <p className="text-sm text-text-muted">{targetName}</p>
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            {data.length}{t("master.routing.processCount", "공정")}
          </span>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />{t("master.routing.addRouting")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-text-muted">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-text-muted border border-dashed border-border rounded-lg">
          <AlertCircle className="w-8 h-8 mb-2 text-orange-400" />
          <p className="text-sm font-medium">{t("master.bom.noRoutingData", "라우팅 데이터가 없습니다")}</p>
        </div>
      ) : (
        <DataGrid data={data} columns={columns} enableColumnFilter enableExport exportFileName={`${targetCode}_routing`} />
      )}

      <RoutingFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={fetchRoutings}
        editingItem={editingItem} partId={partId} />

      <ConfirmModal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} onConfirm={handleDelete}
        title={t("common.delete")} message={t("master.routing.deleteConfirm")} variant="danger" />
    </>
  );
}
