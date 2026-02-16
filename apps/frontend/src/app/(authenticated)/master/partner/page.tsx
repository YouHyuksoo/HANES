"use client";

/**
 * @file src/app/(authenticated)/master/partner/page.tsx
 * @description 거래처 마스터 관리 페이지 - DB API 연동
 *
 * 초보자 가이드:
 * 1. **거래처 유형**: SUPPLIER(공급상) / CUSTOMER(고객)
 * 2. **검색/필터**: 유형별 필터 + 텍스트 검색 (API 서버측 처리)
 * 3. **CRUD**: 추가/수정은 Modal, 삭제는 소프트삭제
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Download, Building2 } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface Partner {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: string;
  bizNo?: string;
  ceoName?: string;
  address?: string;
  tel?: string;
  fax?: string;
  email?: string;
  contactPerson?: string;
  remark?: string;
  useYn: string;
}

function PartnerPage() {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<Partial<Partner>>({});
  const [saving, setSaving] = useState(false);

  const partnerTypeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "SUPPLIER", label: t("master.partner.supplier") },
    { value: "CUSTOMER", label: t("master.partner.customer") },
  ], [t]);

  const partnerTypeFormOptions = useMemo(() => [
    { value: "SUPPLIER", label: t("master.partner.supplier") },
    { value: "CUSTOMER", label: t("master.partner.customer") },
  ], [t]);

  /** API에서 거래처 목록 조회 */
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.partnerType = typeFilter;
      const res = await api.get("/master/partners", { params });
      if (res.data.success) setPartners(res.data.data || []);
    } catch {
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const openCreateModal = useCallback(() => {
    setEditingPartner(null);
    setFormData({ partnerType: "SUPPLIER", useYn: "Y" });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((partner: Partner) => {
    setEditingPartner(partner);
    setFormData({ ...partner });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.partnerCode || !formData.partnerName || !formData.partnerType) return;
    setSaving(true);
    try {
      if (editingPartner) {
        await api.put(`/master/partners/${editingPartner.id}`, formData);
      } else {
        await api.post("/master/partners", formData);
      }
      setIsModalOpen(false);
      fetchPartners();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingPartner, fetchPartners]);

  const handleDelete = useCallback(async (partner: Partner) => {
    try {
      await api.delete(`/master/partners/${partner.id}`);
      fetchPartners();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, [fetchPartners]);

  const columns = useMemo<ColumnDef<Partner>[]>(() => [
    { accessorKey: "partnerCode", header: t("master.partner.partnerCode"), size: 120 },
    { accessorKey: "partnerName", header: t("master.partner.partnerName"), size: 200 },
    {
      accessorKey: "partnerType", header: t("master.partner.partnerType"), size: 80,
      cell: ({ getValue }) => <ComCodeBadge groupCode="PARTNER_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "bizNo", header: t("master.partner.bizNo"), size: 130 },
    { accessorKey: "ceoName", header: t("master.partner.ceoName"), size: 90 },
    { accessorKey: "tel", header: t("master.partner.tel"), size: 130 },
    { accessorKey: "contactPerson", header: t("master.partner.contactPerson"), size: 90 },
    { accessorKey: "email", header: t("master.partner.email"), size: 180 },
    {
      accessorKey: "useYn", header: t("master.partner.useYn"), size: 60,
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
            <Building2 className="w-7 h-7 text-primary" />{t("master.partner.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.partner.subtitle")} ({partners.length}건)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchPartners}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />{t("master.partner.addPartner")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input placeholder={t("master.partner.searchPlaceholder")} value={searchText}
                onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <div className="w-40">
              <Select options={partnerTypeOptions} value={typeFilter} onChange={setTypeFilter}
                placeholder={t("master.partner.partnerType")} fullWidth />
            </div>
          </div>

          <DataGrid data={partners} columns={columns} pageSize={10} isLoading={loading} />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingPartner ? t("master.partner.editPartner") : t("master.partner.addPartner")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.partner.partnerCode")} placeholder="101001"
            value={formData.partnerCode || ""} onChange={(e) => setFormData((p) => ({ ...p, partnerCode: e.target.value }))}
            disabled={!!editingPartner} fullWidth />
          <Select label={t("master.partner.partnerType")} options={partnerTypeFormOptions}
            value={formData.partnerType || "SUPPLIER"} onChange={(v) => setFormData((p) => ({ ...p, partnerType: v }))} fullWidth />
          <div className="col-span-2">
            <Input label={t("master.partner.partnerName")} placeholder={t("master.partner.partnerName")}
              value={formData.partnerName || ""} onChange={(e) => setFormData((p) => ({ ...p, partnerName: e.target.value }))} fullWidth />
          </div>
          <Input label={t("master.partner.bizNo")} placeholder="123-45-67890"
            value={formData.bizNo || ""} onChange={(e) => setFormData((p) => ({ ...p, bizNo: e.target.value }))} fullWidth />
          <Input label={t("master.partner.ceoName")} placeholder={t("master.partner.ceoName")}
            value={formData.ceoName || ""} onChange={(e) => setFormData((p) => ({ ...p, ceoName: e.target.value }))} fullWidth />
          <div className="col-span-2">
            <Input label={t("master.partner.address")} placeholder={t("master.partner.address")}
              value={formData.address || ""} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} fullWidth />
          </div>
          <Input label={t("master.partner.tel")} placeholder="02-1234-5678"
            value={formData.tel || ""} onChange={(e) => setFormData((p) => ({ ...p, tel: e.target.value }))} fullWidth />
          <Input label={t("master.partner.fax")} placeholder="02-1234-5679"
            value={formData.fax || ""} onChange={(e) => setFormData((p) => ({ ...p, fax: e.target.value }))} fullWidth />
          <Input label={t("master.partner.email")} placeholder="contact@company.com"
            value={formData.email || ""} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} fullWidth />
          <Input label={t("master.partner.contactPerson")} placeholder={t("master.partner.contactPerson")}
            value={formData.contactPerson || ""} onChange={(e) => setFormData((p) => ({ ...p, contactPerson: e.target.value }))} fullWidth />
          <div className="col-span-2">
            <Input label={t("master.partner.remark")} placeholder={t("master.partner.remark")}
              value={formData.remark || ""} onChange={(e) => setFormData((p) => ({ ...p, remark: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : editingPartner ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default PartnerPage;
