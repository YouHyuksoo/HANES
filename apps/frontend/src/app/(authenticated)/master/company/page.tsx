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
import { Plus, Search, RefreshCw, Building } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import CompanyFormPanel from "./components/CompanyForm";
import { createCompanyGridColumns } from "./companyColumns";
import { Company, getCompanyKey } from "./types";

function CompanyPage() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const panelAnimateRef = useRef(true);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

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
      await api.delete(`/master/companies/${getCompanyKey(deleteTarget)}`);
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

  const openEdit = useCallback((company: Company) => {
    guard(() => { panelAnimateRef.current = !isPanelOpen; setEditingCompany(company); setIsPanelOpen(true); });
  }, [guard, isPanelOpen]);

  const openCreate = useCallback(() => {
    guard(() => { panelAnimateRef.current = !isPanelOpen; setEditingCompany(null); setIsPanelOpen(true); });
  }, [guard, isPanelOpen]);

  const handlePanelSave = useCallback(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const columns = useMemo(() => createCompanyGridColumns({
    t,
    onEditCompany: openEdit,
    onDeleteCompany: setDeleteTarget,
  }), [t, isPanelOpen, openEdit]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
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
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("master.company.addCompany")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={companies}
            columns={columns}
            isLoading={loading}
            enableColumnPinning
            enableColumnFilter
            enableExport
            exportFileName={t("master.company.title")}
            onRowClick={(row) => { if (isPanelOpen) guard(() => setEditingCompany(row)); }}
            toolbarLeft={
              <Input placeholder={t("master.company.searchPlaceholder")}
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} />
            }
          
          sqlQuery={`SELECT *\nFROM COMPANY_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <CompanyFormPanel
          editingCompany={editingCompany}
          onClose={() => guard(handlePanelClose)}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
          onDirtyChange={markDirty}
        />
      )}

      <ConfirmModal {...guardModalProps} />

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
