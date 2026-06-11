"use client";

/**
 * @file components/IqcGroupTab.tsx
 * @description IQC 검사그룹 관리 탭 — 검사항목 묶음 CRUD (API 연동)
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/iqc-groups
 * 2. DataGrid로 그룹 목록 표시 + 모달로 등록/수정
 * 3. 검사구분(검사/무검사) 필터링 + 검색 지원
 * 4. 각 그룹에 포함된 검사항목 수 표시
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Layers } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { INSPECT_METHOD_COLORS } from "../types";
import IqcGroupModal from "./IqcGroupModal";
import { useComCodeMap } from "@/hooks/useComCode";
import api from "@/services/api";

interface IqcGroupRow {
  groupCode: string;
  groupName: string;
  inspectMethod: string;
  sampleQty?: number | null;
  useYn: string;
  items?: {
    inspItemCode: string;
    seq: number;
    inspItem?: { inspItemCode: string; inspItemName: string; judgeMethod: string };
  }[];
}

export default function IqcGroupTab() {
  const { t } = useTranslation();
  const iqcInspectMethodMap = useComCodeMap("IQC_INSPECT_METHOD");
  const [groups, setGroups] = useState<IqcGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<IqcGroupRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IqcGroupRow | null>(null);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: iqcInspectMethodMap.FULL?.codeName ?? t("master.iqcGroup.methodFull", "검사"),
    SKIP: iqcInspectMethodMap.SKIP?.codeName ?? t("master.iqcGroup.methodSkip", "무검사"),
  }), [t, iqcInspectMethodMap]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (methodFilter) params.inspectMethod = methodFilter;
      const res = await api.get("/master/iqc-groups", { params });
      if (res.data.success) setGroups(res.data.data || []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, methodFilter]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreate = useCallback(() => {
    setEditingGroup(null);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((group: IqcGroupRow) => {
    setEditingGroup(group);
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async (formData: {
    groupCode: string; groupName: string; inspectMethod: string;
    sampleQty: string; selectedItemCodes: string[];
  }) => {
    setSaving(true);
    try {
      const body = {
        groupCode: formData.groupCode,
        groupName: formData.groupName,
        inspectMethod: formData.inspectMethod,
        sampleQty: undefined,
        items: formData.selectedItemCodes.map((inspItemCode, idx) => ({
          itemId: inspItemCode, seq: idx + 1,
        })),
      };
      if (editingGroup) {
        await api.put(`/master/iqc-groups/${editingGroup.groupCode}`, body);
      } else {
        await api.post("/master/iqc-groups", body);
      }
      setIsModalOpen(false);
      fetchGroups();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editingGroup, fetchGroups]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/iqc-groups/${deleteTarget.groupCode}`);
      fetchGroups();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchGroups]);

  const columns = useMemo<ColumnDef<IqcGroupRow>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation(); openEdit(row.original); }}
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
    { accessorKey: "groupCode", header: t("master.iqcGroup.groupCode", "그룹코드"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "groupName", header: t("master.iqcGroup.groupName", "그룹명"), size: 160, meta: { filterType: "text" as const } },
    {
      id: "itemCount", header: t("master.iqcGroup.itemCount", "항목수"), size: 55,
      meta: { align: "center" as const, filterType: "number" as const },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-text-muted" />
          {row.original.items?.length ?? 0}
        </span>
      ),
    },
    {
      id: "itemCodes", header: t("master.iqcItem.inspItemCode", "항목코드"), size: 160,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const items = row.original.items ?? [];
        if (items.length === 0) return "-";
        return (
          <div className="flex flex-wrap gap-1">
            {items.sort((a, b) => a.seq - b.seq).map((gi) => (
              <span key={gi.inspItemCode} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface text-text-muted">
                {gi.inspItem?.inspItemCode ?? gi.inspItemCode}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "itemNames", header: t("master.iqcItem.inspItemName", "검사항목"), size: 200,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const items = row.original.items ?? [];
        if (items.length === 0) return "-";
        return (
          <div className="text-xs space-y-0.5">
            {items.sort((a, b) => a.seq - b.seq).map((gi) => (
              <div key={gi.inspItemCode} className="truncate">
                <span className="text-text-muted mr-1">{gi.seq}.</span>
                {gi.inspItem?.inspItemName ?? "-"}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "inspectMethod", header: t("master.iqcGroup.inspectMethod", "검사구분"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[v]}`}>
            {methodLabels[v] ?? v}
          </span>
        );
      },
    },
  ], [t, methodLabels, openEdit]);

  return (
    <>
      <Card>
        <CardContent>
          <DataGrid
            data={groups}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("master.iqcGroup.tabGroups", "검사그룹")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.iqcGroup.searchPlaceholder", "그룹코드/그룹명 검색...")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <ComCodeSelect groupCode="IQC_INSPECT_METHOD" labelPrefix={t("master.iqcGroup.inspectMethod", "검사구분")}
                    value={methodFilter} onChange={setMethodFilter} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchGroups} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
                </Button>
                <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                  <Plus className="w-4 h-4 mr-1" />{t("master.iqcGroup.addGroup", "그룹 추가")}
                </Button>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM IQC_GROUPS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent>
      </Card>

      <IqcGroupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        onSave={handleSave} editing={editingGroup} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.groupName || ""}'을(를) 삭제하시겠습니까?`}
      />
    </>
  );
}
