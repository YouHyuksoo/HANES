/**
 * @file src/app/(authenticated)/master/company/page.tsx
 * @description 회사마스터 관리 페이지 — DataGrid + 우측 패널 CRUD
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 회사 목록 표시 (페이지네이션, 검색)
 * 2. **우측 패널**: 추가/수정 폼은 우측 슬라이드 패널에서 처리
 */
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Building } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import CompanyFormPanel from "./components/CompanyForm";
import { Company } from "./types";

function CompanyPage() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const panelAnimateRef = useRef(true);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/master/companies", { params });
      if (res.data.success) setCompanies(res.data.data || []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/companies/${deleteTarget.id}`);
      fetchCompanies();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchCompanies]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingCompany(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const columns = useMemo<ColumnDef<Company>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingCompany(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "companyCode", header: t("master.company.companyCode"), size: 120 },
    { accessorKey: "companyName", header: t("master.company.companyName"), size: 200 },
    { accessorKey: "bizNo", header: t("master.company.bizNo"), size: 140 },
    { accessorKey: "ceoName", header: t("master.company.ceoName"), size: 100 },
    { accessorKey: "address", header: t("master.company.address"), size: 250 },
    { accessorKey: "tel", header: t("master.company.tel"), size: 140 },
    { accessorKey: "email", header: t("master.company.email"), size: 180 },
    {
      accessorKey: "useYn", header: t("common.active"), size: 60,
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
  ], [t, isPanelOpen]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Building className="w-7 h-7 text-primary" />{t("master.company.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.company.subtitle")} ({companies.length}건)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchCompanies}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingCompany(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("master.company.addCompany")}
            </Button>
          </div>
        </div>

        <Card><CardContent>
          <DataGrid
            data={companies}
            columns={columns}
            isLoading={loading}
            enableColumnPinning
            enableExport
            exportFileName={t("master.company.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingCompany(row); }}
            toolbarLeft={
              <Input placeholder={t("master.company.searchPlaceholder")}
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} />
            }
          />
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <CompanyFormPanel
          editingCompany={editingCompany}
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
        message={t("master.company.deleteConfirm", {
          name: deleteTarget?.companyName || "",
          defaultValue: `'${deleteTarget?.companyName || ""}'을(를) 삭제하시겠습니까?`,
        })}
      />
    </div>
  );
}

export default CompanyPage;
