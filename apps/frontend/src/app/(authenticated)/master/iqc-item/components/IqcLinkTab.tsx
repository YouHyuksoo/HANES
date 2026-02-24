"use client";

/**
 * @file components/IqcLinkTab.tsx
 * @description IQC 연결관리 탭 — 품목+거래처 → 검사그룹 매핑 CRUD (API 연동)
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/iqc-part-links
 * 2. DataGrid: 품목코드 | 품목명 | 거래처 | 검사그룹 | 검사형태 | 비고
 * 3. 같은 품목이라도 거래처별로 다른 검사그룹 적용 가능
 * 4. 거래처 미지정 = 기본 검사그룹 (모든 거래처에 적용)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Link2 } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { INSPECT_METHOD_COLORS } from "../types";
import IqcLinkModal from "./IqcLinkModal";
import api from "@/services/api";

interface IqcPartLinkRow {
  id: string;
  partId: string;
  partnerId?: string | null;
  groupId: string;
  remark?: string | null;
  useYn: string;
  part?: { partCode: string; partName: string };
  partner?: { partnerCode: string; partnerName: string } | null;
  group?: { groupCode: string; groupName: string; inspectMethod: string; sampleQty?: number | null };
}

export default function IqcLinkTab() {
  const { t } = useTranslation();
  const [links, setLinks] = useState<IqcPartLinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<IqcPartLinkRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IqcPartLinkRow | null>(null);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    FULL: t("master.iqcGroup.methodFull", "전수검사"),
    SAMPLE: t("master.iqcGroup.methodSample", "샘플검사"),
    SKIP: t("master.iqcGroup.methodSkip", "무검사"),
  }), [t]);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/master/iqc-part-links", { params });
      if (res.data.success) setLinks(res.data.data || []);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const openCreate = useCallback(() => {
    setEditingLink(null);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((link: IqcPartLinkRow) => {
    setEditingLink(link);
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async (formData: {
    partId: string; partnerId: string; groupId: string; remark: string;
  }) => {
    try {
      const body = {
        partId: formData.partId,
        partnerId: formData.partnerId || undefined,
        groupId: formData.groupId,
        remark: formData.remark || undefined,
      };
      if (editingLink) {
        await api.put(`/master/iqc-part-links/${editingLink.id}`, body);
      } else {
        await api.post("/master/iqc-part-links", body);
      }
      setIsModalOpen(false);
      fetchLinks();
    } catch (e: any) {
      console.error("Save failed:", e);
    }
  }, [editingLink, fetchLinks]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/iqc-part-links/${deleteTarget.id}`);
      fetchLinks();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchLinks]);

  const columns = useMemo<ColumnDef<IqcPartLinkRow>[]>(() => [
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
    {
      id: "partCode", header: t("master.iqcLink.partCode", "품목코드"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.part?.partCode ?? "-"}</span>
      ),
    },
    {
      id: "partName", header: t("master.iqcLink.partName", "품목명"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.partName ?? "-",
    },
    {
      id: "partnerName", header: t("master.iqcLink.partner", "거래처(공급상)"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const p = row.original.partner;
        if (!p) return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {t("master.iqcLink.defaultLabel", "기본(전체)")}
          </span>
        );
        return `${p.partnerCode} - ${p.partnerName}`;
      },
    },
    {
      id: "groupName", header: t("master.iqcLink.group", "검사그룹"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const g = row.original.group;
        if (!g) return "-";
        return `${g.groupCode} - ${g.groupName}`;
      },
    },
    {
      id: "inspectMethod", header: t("master.iqcGroup.inspectMethod", "검사형태"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ row }) => {
        const g = row.original.group;
        if (!g) return "-";
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_METHOD_COLORS[g.inspectMethod]}`}>
            {methodLabels[g.inspectMethod]}
            {g.inspectMethod === "SAMPLE" && g.sampleQty ? ` (${g.sampleQty})` : ""}
          </span>
        );
      },
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t, methodLabels, openEdit]);

  return (
    <>
      <Card>
        <CardContent>
          <DataGrid
            data={links}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("master.iqcLink.tabLinks", "연결관리")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.iqcLink.searchPlaceholder", "품목코드/품목명/거래처명 검색...")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchLinks} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
                </Button>
                <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                  <Plus className="w-4 h-4 mr-1" />{t("master.iqcLink.addLink", "연결 추가")}
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      <IqcLinkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        onSave={handleSave} editing={editingLink} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.part?.partCode || ""}'을(를) 삭제하시겠습니까?`}
      />
    </>
  );
}
