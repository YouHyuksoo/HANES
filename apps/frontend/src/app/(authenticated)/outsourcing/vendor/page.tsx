"use client";

/**
 * @file src/app/(authenticated)/outsourcing/vendor/page.tsx
 * @description 외주처 관리 페이지
 *
 * 초보자 가이드:
 * 1. **외주처**: 가공/제조를 의뢰하는 협력업체 관리
 * 2. **유형**: SUBCON(외주가공), SUPPLIER(자재공급)
 * 3. API: GET/POST/PUT /outsourcing/vendors
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, RefreshCw, Search, Building2 } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  bizNo: string;
  ceoName: string;
  tel: string;
  email: string;
  contactPerson: string;
  vendorType: string;
  address: string;
  useYn: string;
}

export default function VendorPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const vendorTypeLabels: Record<string, string> = useMemo(() => ({
    SUBCON: t("outsourcing.vendor.typeSubcon"),
    SUPPLIER: t("outsourcing.vendor.typeSupplier"),
  }), [t]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ vendorCode: "", vendorName: "", vendorType: "SUBCON", bizNo: "", ceoName: "", tel: "", email: "", contactPerson: "", address: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      const res = await api.get("/outsourcing/vendors", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = useCallback((item: Vendor) => {
    setSelectedItem(item);
    setForm({ vendorCode: item.vendorCode, vendorName: item.vendorName, vendorType: item.vendorType, bizNo: item.bizNo, ceoName: item.ceoName, tel: item.tel, email: item.email, contactPerson: item.contactPerson, address: item.address });
    setIsModalOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setSelectedItem(null);
    setForm({ vendorCode: "", vendorName: "", vendorType: "SUBCON", bizNo: "", ceoName: "", tel: "", email: "", contactPerson: "", address: "" });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (selectedItem) {
        await api.put(`/outsourcing/vendors/${selectedItem.id}`, form);
      } else {
        await api.post("/outsourcing/vendors", form);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedItem, form, fetchData]);

  const columns = useMemo<ColumnDef<Vendor>[]>(() => [
    { accessorKey: "vendorCode", header: t("outsourcing.vendor.vendorCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "vendorName", header: t("outsourcing.vendor.vendorName"), size: 150, meta: { filterType: "text" as const } },
    {
      accessorKey: "vendorType", header: t("outsourcing.vendor.type"), size: 70,
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return <span className={`px-2 py-1 text-xs rounded-full ${type === "SUBCON" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"}`}>{vendorTypeLabels[type]}</span>;
      },
    },
    { accessorKey: "bizNo", header: t("outsourcing.vendor.bizNo"), size: 120 },
    { accessorKey: "ceoName", header: t("outsourcing.vendor.ceoName"), size: 80 },
    { accessorKey: "contactPerson", header: t("outsourcing.vendor.contactPerson"), size: 80 },
    { accessorKey: "tel", header: t("outsourcing.vendor.tel"), size: 120 },
    { accessorKey: "address", header: t("outsourcing.vendor.address"), size: 180 },
    {
      accessorKey: "useYn", header: t("outsourcing.vendor.useYn"), size: 60,
      cell: ({ getValue }) => <span className={getValue() === "Y" ? "text-green-600" : "text-gray-400"}>{getValue() === "Y" ? "●" : "○"}</span>,
    },
    {
      id: "actions", header: t("common.manage"), size: 70,
      cell: ({ row }) => (
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
      ),
    },
  ], [t, vendorTypeLabels, openEdit]);

  const stats = useMemo(() => ({
    total: data.length,
    subcon: data.filter((d) => d.vendorType === "SUBCON").length,
    supplier: data.filter((d) => d.vendorType === "SUPPLIER").length,
  }), [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Building2 className="w-7 h-7 text-primary" />{t("outsourcing.vendor.title")}</h1>
          <p className="text-text-muted mt-1">{t("outsourcing.vendor.description")}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> {t("outsourcing.vendor.register")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("outsourcing.vendor.totalVendors")} value={stats.total} icon={Building2} color="blue" />
        <StatCard label={t("outsourcing.vendor.typeSubcon")} value={stats.subcon} icon={Building2} color="blue" />
        <StatCard label={t("outsourcing.vendor.typeSupplier")} value={stats.supplier} icon={Building2} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("outsourcing.vendor.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("outsourcing.vendor.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedItem ? t("outsourcing.vendor.editVendor") : t("outsourcing.vendor.register")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("outsourcing.vendor.vendorCode")} placeholder="VND-001" value={form.vendorCode} onChange={(e) => setForm((p) => ({ ...p, vendorCode: e.target.value }))} fullWidth />
          <Select label={t("outsourcing.vendor.type")} options={[{ value: "SUBCON", label: t("outsourcing.vendor.typeSubcon") }, { value: "SUPPLIER", label: t("outsourcing.vendor.typeSupplier") }]} value={form.vendorType} onChange={(v) => setForm((p) => ({ ...p, vendorType: v }))} fullWidth />
          <Input label={t("outsourcing.vendor.vendorName")} placeholder="" value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} fullWidth className="col-span-2" />
          <Input label={t("outsourcing.vendor.bizNo")} placeholder="123-45-67890" value={form.bizNo} onChange={(e) => setForm((p) => ({ ...p, bizNo: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.vendor.ceoName")} value={form.ceoName} onChange={(e) => setForm((p) => ({ ...p, ceoName: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.vendor.tel")} placeholder="02-1234-5678" value={form.tel} onChange={(e) => setForm((p) => ({ ...p, tel: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.vendor.email")} placeholder="contact@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.vendor.contactPerson")} value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.vendor.address")} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} fullWidth className="col-span-2" />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : selectedItem ? t("common.edit") : t("common.register")}</Button>
        </div>
      </Modal>
    </div>
  );
}
