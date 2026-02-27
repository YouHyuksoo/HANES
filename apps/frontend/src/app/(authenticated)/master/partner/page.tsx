"use client";

/**
 * @file src/app/(authenticated)/master/partner/page.tsx
 * @description 거래처 마스터 관리 페이지 - DB API 연동
 *
 * 초보자 가이드:
 * 1. **거래처 유형**: SUPPLIER(공급상) / CUSTOMER(고객)
 * 2. **검색/필터**: 유형별 필터 + 텍스트 검색 (API 서버측 처리)
 * 3. **CRUD**: 추가/수정은 우측 슬라이드 패널, 삭제는 소프트삭제
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, Building2 } from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import PartnerFormPanel, { type Partner } from "./components/PartnerFormPanel";

function PartnerPage() {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const panelAnimateRef = useRef(true);

  /** API에서 거래처 목록 조회 */
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
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

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/partners/${deleteTarget.id}`);
      fetchPartners();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchPartners]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingPartner(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchPartners();
  }, [fetchPartners]);

  const columns = useMemo<ColumnDef<Partner>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingPartner(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
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
  ], [t, isPanelOpen]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
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
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPartner(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("master.partner.addPartner")}
            </Button>
          </div>
        </div>

        <Card><CardContent>
          <DataGrid
            data={partners}
            columns={columns}
            isLoading={loading}
            enableColumnPinning
            enableExport
            exportFileName={t("master.partner.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingPartner(row); }}
            toolbarLeft={
              <div className="flex gap-2 items-center">
                <Input placeholder={t("master.partner.searchPlaceholder")} value={searchText}
                  onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} />
                <div className="w-40 flex-shrink-0">
                  <ComCodeSelect groupCode="PARTNER_TYPE" value={typeFilter} onChange={setTypeFilter}
                    placeholder={t("master.partner.partnerType")} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <PartnerFormPanel
          editingPartner={editingPartner}
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
        message={`'${deleteTarget?.partnerName || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}

export default PartnerPage;
