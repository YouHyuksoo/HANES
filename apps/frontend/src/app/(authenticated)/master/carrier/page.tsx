"use client";

/**
 * @file src/app/(authenticated)/master/carrier/page.tsx
 * @description 대차 마스터(대차/트레이/매거진) 페이지 — 레이아웃·상태 배선만 담당
 *
 * 초보자 가이드:
 * 1. 좌: DataGrid(서버 페이징) — 컬럼은 carrierColumns.tsx
 * 2. 우: CarrierFormPanel — 행 클릭 시 데이터 교체 + useUnsavedGuard
 * 3. QR 라벨은 CarrierLabelModal — 인쇄 시 QR 값은 carrierNo 그대로
 * 4. API: /master/carriers (GET/POST), /:carrierNo (PUT/DELETE)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { createCarrierGridColumns, type CarrierRow } from "./carrierColumns";
import CarrierFormPanel, { emptyCarrierForm, validateCarrierForm, type CarrierForm } from "./CarrierFormPanel";
import CarrierLabelModal from "./CarrierLabelModal";

const PAGE_SIZE = 50;

export default function CarrierPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CarrierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("Y");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<CarrierRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<CarrierRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CarrierRow | null>(null);
  const [labelTarget, setLabelTarget] = useState<CarrierRow | null>(null);
  const [form, setForm] = useState<CarrierForm>(() => emptyCarrierForm());
  const initialFormRef = useRef<CarrierForm>(emptyCarrierForm());
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const search = searchText.trim();
      const res = await api.get("/master/carriers", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(search && { search }),
          ...(typeFilter && { carrierType: typeFilter }),
          ...(useYnFilter && { useYn: useYnFilter }),
        },
      });
      setRows(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, typeFilter, useYnFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [searchText, typeFilter, useYnFilter]);

  const setField = useCallback((key: keyof CarrierForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const openCreate = () => {
    setEditing(null);
    const blank = emptyCarrierForm();
    setForm(blank);
    initialFormRef.current = blank;
    setPanelOpen(true);
  };

  const openEdit = (row: CarrierRow) => {
    const next: CarrierForm = {
      carrierNo: row.carrierNo,
      carrierType: row.carrierType,
      carrierName: row.carrierName ?? "",
      capacity: row.capacity == null ? "" : String(row.capacity),
      useYn: row.useYn || "Y",
      remark: row.remark ?? "",
    };
    setForm(next);
    initialFormRef.current = next;
    setEditing(row);
    setSelectedRow(row);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
  };

  const dirty = panelOpen && JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleSave = async () => {
    if (!validateCarrierForm(form)) return;
    setSaving(true);
    const payload = {
      carrierNo: form.carrierNo.trim().toUpperCase(),
      carrierType: form.carrierType,
      carrierName: form.carrierName.trim() || null,
      capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
      useYn: form.useYn,
      remark: form.remark.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/master/carriers/${encodeURIComponent(editing.carrierNo)}`, payload);
      } else {
        await api.post("/master/carriers", payload);
      }
      await fetchData();
      closePanel();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/carriers/${encodeURIComponent(deleteTarget.carrierNo)}`);
      if (editing?.carrierNo === deleteTarget.carrierNo) closePanel();
      await fetchData();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(() => createCarrierGridColumns({
    t,
    onEdit: (row) => guard(() => openEdit(row)),
    onDelete: setDeleteTarget,
    onPrintLabel: setLabelTarget,
  }), [t, guard]);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-primary" />
              {t("master.carrier.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.carrier.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => fetchData()}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => guard(openCreate)}>
              <Plus className="w-4 h-4 mr-1" />{t("common.add")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={rows} columns={columns} isLoading={loading} pageSize={PAGE_SIZE}
              enableColumnFilter enableExport
              exportFileName={t("master.carrier.title")}
              getRowId={(row) => (row as CarrierRow).carrierNo}
              selectedRowId={selectedRow?.carrierNo}
              onRowClick={(row) => {
                const carrier = row as CarrierRow;
                if (panelOpen) guard(() => openEdit(carrier));
                else setSelectedRow(carrier);
              }}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="w-64">
                    <Input placeholder={t("master.carrier.searchPlaceholder")} value={searchText}
                      onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <ComCodeSelect groupCode="CARRIER_TYPE" value={typeFilter} onChange={setTypeFilter}
                    labelPrefix={t("master.carrier.carrierType")} />
                  <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} />
                  <ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={loading} className="flex-shrink-0 ml-auto" />
                </div>
              }
              sqlQuery={`SELECT *\nFROM CARRIER_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CARRIER_TYPE, CARRIER_NO`} />
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <CarrierFormPanel
          t={t}
          editing={!!editing}
          saving={saving}
          form={form}
          onChange={setField}
          onSave={handleSave}
          onCancel={() => guard(closePanel)}
        />
      )}

      <CarrierLabelModal isOpen={!!labelTarget} carrier={labelTarget} onClose={() => setLabelTarget(null)} />

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        variant="danger" title={t("common.delete")}
        message={`'${deleteTarget?.carrierNo ?? ""}'${t("common.deleteConfirm")}`} />
    </div>
  );
}
