"use client";

/**
 * @file components/IqcGroupTab.tsx
 * @description IQC 검사그룹 관리 탭 — 검사항목 묶음 CRUD (API 연동)
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/iqc-groups
 * 2. DataGrid로 그룹 목록 표시 + 모달로 등록/수정
 * 3. 검사형태(전수/샘플/무검사) 필터링 + 검색 지원
 * 4. 각 그룹에 포함된 검사항목 수 표시
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Layers } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { INSPECT_METHOD_COLORS } from "../types";
import IqcGroupModal from "./IqcGroupModal";
import api from "@/services/api";

interface IqcGroupRow {
  id: string;
  groupCode: string;
  groupName: string;
  inspectMethod: string;
  sampleQty?: number | null;
  useYn: string;
  items?: { itemId: string; seq: number }[];
}

export default function IqcGroupTab() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<IqcGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<IqcGroupRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IqcGroupRow | null>(null);

  const methodOptions = useMemo(() => [
    { value: "", label: t("master.iqcGroup.inspectMethod", "검사형태") },
    { value: "FULL", label: t("master.iqcGroup.methodFull", "전수검사") },
    { value: "SAMPLE", label: t("master.iqcGroup.methodSample", "샘플검사") },
    { value: "SKIP", label: t("master.iqcGroup.methodSkip", "무검사") },
  ], [t]);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: t("master.iqcGroup.methodFull", "전수검사"),
    SAMPLE: t("master.iqcGroup.methodSample", "샘플검사"),
    SKIP: t("master.iqcGroup.methodSkip", "무검사"),
  }), [t]);

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
    sampleQty: string; selectedItemIds: string[];
  }) => {
    setSaving(true);
    try {
      const body = {
        groupCode: formData.groupCode,
        groupName: formData.groupName,
        inspectMethod: formData.inspectMethod,
        sampleQty: formData.inspectMethod === "SAMPLE" && formData.sampleQty
          ? parseInt(formData.sampleQty) : undefined,
        items: formData.selectedItemIds.map((itemId, idx) => ({
          itemId, seq: idx + 1,
        })),
      };
      if (editingGroup) {
        await api.put(`/master/iqc-groups/${editingGroup.id}`, body);
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
      await api.delete(`/master/iqc-groups/${deleteTarget.id}`);
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
    { accessorKey: "groupName", header: t("master.iqcGroup.groupName", "그룹명"), size: 180, meta: { filterType: "text" as const } },
    {
      accessorKey: "inspectMethod", header: t("master.iqcGroup.inspectMethod", "검사형태"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[v]}`}>
            {methodLabels[v]}
          </span>
        );
      },
    },
    {
      accessorKey: "sampleQty", header: t("master.iqcGroup.sampleQty", "샘플수량"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ row }) => row.original.inspectMethod === "SAMPLE" && row.original.sampleQty
        ? `${row.original.sampleQty}${t("common.ea", "개")}` : "-",
    },
    {
      id: "itemCount", header: t("master.iqcGroup.itemCount", "항목수"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-text-muted" />
          {row.original.items?.length ?? 0}
        </span>
      ),
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
                  <Select options={methodOptions} value={methodFilter} onChange={setMethodFilter} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchGroups} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
                </Button>
                <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                  <Plus className="w-4 h-4 mr-1" />{t("master.iqcGroup.addGroup", "그룹 추가")}
                </Button>
              </div>
            }
          />
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
