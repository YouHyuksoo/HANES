/**
 * @file src/app/(authenticated)/master/company/page.tsx
 * @description 회사마스터 관리 페이지 — DataGrid + Modal CRUD
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 회사 목록 표시 (페이지네이션, 검색)
 * 2. **Modal**: CompanyForm으로 추가/수정
 * 3. **패턴**: 기존 partner 페이지와 동일 구조
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Building } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import CompanyForm from "./components/CompanyForm";
import { Company } from "./types";

function CompanyPage() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<Partial<Company>>({});
  const [saving, setSaving] = useState(false);

  /** API에서 회사 목록 조회 */
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
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

  const openCreateModal = useCallback(() => {
    setEditingCompany(null);
    setFormData({ useYn: "Y" });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((company: Company) => {
    setEditingCompany(company);
    setFormData({ ...company });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.companyCode || !formData.companyName) return;
    setSaving(true);
    try {
      if (editingCompany) {
        await api.put(`/master/companies/${editingCompany.id}`, formData);
      } else {
        await api.post("/master/companies", formData);
      }
      setIsModalOpen(false);
      fetchCompanies();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingCompany, fetchCompanies]);

  const handleDelete = useCallback(async (company: Company) => {
    try {
      await api.delete(`/master/companies/${company.id}`);
      fetchCompanies();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, [fetchCompanies]);

  const columns = useMemo<ColumnDef<Company>[]>(() => [
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
    {
      id: "actions", header: t("common.actions"), size: 80,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEditModal(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, openEditModal, handleDelete]);

  return (
    <div className="space-y-6 animate-fade-in">
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
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />{t("master.company.addCompany")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder={t("master.company.searchPlaceholder")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
            </div>
          </div>
          <DataGrid data={companies} columns={columns} pageSize={10} isLoading={loading} />
        </CardContent>
      </Card>

      <CompanyForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingCompany={editingCompany}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export default CompanyPage;
