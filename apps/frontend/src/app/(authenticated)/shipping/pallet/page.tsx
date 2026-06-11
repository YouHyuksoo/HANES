"use client";

/**
 * @file src/app/(authenticated)/shipping/pallet/page.tsx
 * @description 팔레트적재 페이지 - 박스를 팔레트에 적재
 *
 * 초보자 가이드:
 * 1. **팔레트**: 여러 박스를 묶어 운송하는 물류 단위
 * 2. **상태 흐름**: OPEN -> CLOSED -> LOADED -> SHIPPED
 * 3. **박스 할당**: 마감(CLOSED) + OQC 합격 + 미할당 박스만 적재 가능
 * 4. API:
 *    - GET  /shipping/pallets (palletNo/status 필터)
 *    - POST /shipping/pallets (팔레트번호 자동 채번)
 *    - POST /shipping/pallets/:id/boxes { boxIds }
 *    - DELETE /shipping/pallets/:id/boxes { boxIds }
 *    - POST /shipping/pallets/:id/close | /:id/reopen
 *    - GET  /shipping/pallets/barcode/:palletNo/boxes (포함 박스)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers, Plus, Search, RefreshCw, Lock, LockOpen, Truck,
  Package, CheckCircle, ArrowRight, X,
} from "lucide-react";
import { Card, CardHeader, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { PalletStatusBadge } from "@/components/shipping";
import type { PalletStatus } from "@/components/shipping";
import api from "@/services/api";

/** 팔레트 포함 박스 (GET /shipping/pallets/barcode/:no/boxes 응답) */
interface PalletBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  status: string;
  oqcStatus: string | null;
}

/** 적재 후보 박스 (GET /shipping/boxes 응답) */
interface AvailableBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  oqcStatus: string | null;
}

interface Pallet {
  id: string;
  palletNo: string;
  boxCount: number;
  totalQty: number;
  status: PalletStatus;
  shipmentId: string | null;
  createdAt: string;
  closeAt: string | null;
}

export default function PalletPage() {
  const { t } = useTranslation();
  const comCodeOptions = useComCodeOptions("PALLET_STATUS");
  const statusOptions = useMemo(
    () => [{ value: "", label: t("common.allStatus") }, ...comCodeOptions],
    [t, comCodeOptions],
  );
  const [data, setData] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [palletBoxes, setPalletBoxes] = useState<PalletBox[]>([]);
  const [availableBoxes, setAvailableBoxes] = useState<AvailableBox[]>([]);
  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.palletNo = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/pallets", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 선택 팔레트의 포함 박스 조회 */
  const fetchPalletBoxes = useCallback(async (palletNo: string) => {
    try {
      const res = await api.get(`/shipping/pallets/barcode/${encodeURIComponent(palletNo)}/boxes`);
      setPalletBoxes(res.data?.data?.boxes ?? []);
    } catch {
      setPalletBoxes([]);
    }
  }, []);

  const selectPallet = useCallback((pallet: Pallet) => {
    setSelectedPallet(pallet);
    fetchPalletBoxes(pallet.palletNo);
  }, [fetchPalletBoxes]);

  /** 적재 후보: 마감(CLOSED) + OQC 합격 + 팔레트 미할당 박스 */
  const fetchAvailableBoxes = useCallback(async () => {
    try {
      const res = await api.get("/shipping/boxes", { params: { status: "CLOSED", unassigned: "true", limit: "5000" } });
      const boxes: AvailableBox[] = res.data?.data ?? [];
      setAvailableBoxes(boxes.filter((b) => b.oqcStatus === "PASS"));
    } catch {
      setAvailableBoxes([]);
    }
  }, []);

  const stats = useMemo(() => ({
    open: data.filter((p) => p.status === "OPEN").length,
    closed: data.filter((p) => p.status === "CLOSED").length,
    loaded: data.filter((p) => p.status === "LOADED").length,
    shipped: data.filter((p) => p.status === "SHIPPED").length,
  }), [data]);

  /** 액션 응답의 팔레트로 선택 상태를 동기화하고 목록·박스를 갱신 */
  const syncAfterAction = useCallback((pallet: Pallet | undefined) => {
    if (pallet) {
      setSelectedPallet(pallet);
      fetchPalletBoxes(pallet.palletNo);
    }
    fetchData();
  }, [fetchData, fetchPalletBoxes]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/shipping/pallets", {});
      setIsCreateModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setSaving(false);
    }
  }, [fetchData]);

  const handleAssignBoxes = useCallback(async () => {
    if (!selectedPallet || selectedBoxes.length === 0) return;
    setSaving(true);
    try {
      const res = await api.post(`/shipping/pallets/${selectedPallet.id}/boxes`, { boxIds: selectedBoxes });
      setSelectedBoxes([]);
      setIsAssignModalOpen(false);
      syncAfterAction(res.data?.data);
    } catch (e) {
      console.error("Assign failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedPallet, selectedBoxes, syncAfterAction]);

  const handleRemoveBox = useCallback(async (boxNo: string) => {
    if (!selectedPallet) return;
    setSaving(true);
    try {
      const res = await api.delete(`/shipping/pallets/${selectedPallet.id}/boxes`, { data: { boxIds: [boxNo] } });
      syncAfterAction(res.data?.data);
    } catch (e) {
      console.error("Remove box failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedPallet, syncAfterAction]);

  const handleClosePallet = useCallback(async (pallet: Pallet) => {
    try {
      const res = await api.post(`/shipping/pallets/${pallet.id}/close`);
      syncAfterAction(res.data?.data);
    } catch (e) {
      console.error("Close pallet failed:", e);
    }
  }, [syncAfterAction]);

  const handleReopenPallet = useCallback(async (pallet: Pallet) => {
    try {
      const res = await api.post(`/shipping/pallets/${pallet.id}/reopen`);
      syncAfterAction(res.data?.data);
    } catch (e) {
      console.error("Reopen pallet failed:", e);
    }
  }, [syncAfterAction]);

  const toggleBoxSelection = (boxNo: string) =>
    setSelectedBoxes((prev) => prev.includes(boxNo) ? prev.filter((b) => b !== boxNo) : [...prev, boxNo]);

  const columns = useMemo<ColumnDef<Pallet>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 120, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const pallet = row.original;
        const canReopen = pallet.status === "CLOSED" && !pallet.shipmentId;
        return (
          <div className="flex gap-1">
            <button className="p-1 hover:bg-surface rounded" title={t("shipping.pallet.assignBox")} disabled={pallet.status !== "OPEN"} onClick={() => { selectPallet(pallet); setIsAssignModalOpen(true); fetchAvailableBoxes(); }}>
              <Plus className={`w-4 h-4 ${pallet.status === "OPEN" ? "text-primary" : "text-text-muted opacity-50"}`} />
            </button>
            <button className="p-1 hover:bg-surface rounded" title={t("shipping.pallet.closePallet")} disabled={pallet.status !== "OPEN"} onClick={() => handleClosePallet(pallet)}>
              <Lock className={`w-4 h-4 ${pallet.status === "OPEN" ? "text-primary" : "text-text-muted opacity-50"}`} />
            </button>
            <button className="p-1 hover:bg-surface rounded" title={t("shipping.pallet.reopenPallet")} disabled={!canReopen} onClick={() => handleReopenPallet(pallet)}>
              <LockOpen className={`w-4 h-4 ${canReopen ? "text-primary" : "text-text-muted opacity-50"}`} />
            </button>
          </div>
        );
      },
    },
    { accessorKey: "palletNo", header: t("shipping.pallet.palletNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "boxCount", header: t("shipping.pallet.boxCount"), size: 80, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 100, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 100, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <PalletStatusBadge status={getValue() as PalletStatus} /> },
    { accessorKey: "shipmentId", header: t("shipping.confirm.shipmentNo"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span> },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 140, meta: { filterType: "date" as const } },
  ], [t, handleClosePallet, handleReopenPallet, fetchAvailableBoxes, selectPallet]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Layers className="w-7 h-7 text-primary" />{t("shipping.pallet.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.pallet.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> {t("shipping.pallet.createPallet")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("shipping.pallet.statOpen")} value={stats.open} icon={Layers} color="blue" />
        <StatCard label={t("shipping.pallet.statClosed")} value={stats.closed} icon={CheckCircle} color="green" />
        <StatCard label={t("shipping.pallet.statLoaded")} value={stats.loaded} icon={Truck} color="orange" />
        <StatCard label={t("shipping.pallet.statShipped")} value={stats.shipped} icon={Package} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-auto">
        <div className="lg:col-span-2">
          <Card><CardContent>
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("shipping.pallet.title")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("shipping.pallet.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                </div>
              }
              onRowClick={selectPallet}

            sqlQuery={`SELECT *\nFROM PALLET_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent></Card>
        </div>
        <Card>
          <CardHeader title={t("shipping.pallet.includedBoxes")} subtitle={selectedPallet ? selectedPallet.palletNo : t("shipping.pallet.selectPallet")} />
          <CardContent>
            {selectedPallet ? (
              palletBoxes.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {palletBoxes.map((box) => (
                    <div key={box.boxNo} className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div>
                        <p className="font-mono text-sm text-text">{box.boxNo}</p>
                        <p className="text-xs text-text-muted">{box.itemCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{box.qty}{t("common.count")}</span>
                        {selectedPallet.status === "OPEN" && (
                          <button className="p-1 hover:bg-surface rounded" title={t("shipping.pallet.removeBox")} disabled={saving} onClick={() => handleRemoveBox(box.boxNo)}>
                            <X className="w-4 h-4 text-danger" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-text-muted">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t("shipping.pallet.noBoxes")}</p>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-text-muted">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t("shipping.pallet.selectPalletHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t("shipping.pallet.createPallet")} size="lg">
        <div className="space-y-4">
          <p className="text-text-muted">{t("shipping.pallet.createConfirm")}</p>
          <p className="text-sm text-text-muted">{t("shipping.pallet.autoNumberHint")}</p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? t("common.saving") : t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={t("shipping.pallet.assignBox")} size="lg">
        <div className="space-y-4">
          {selectedPallet && (
            <div className="p-3 bg-background rounded-lg">
              <p className="text-sm text-text-muted">{t("shipping.pallet.pallet")}: <span className="font-medium text-text">{selectedPallet.palletNo}</span></p>
            </div>
          )}
          <p className="text-sm text-text-muted">{t("shipping.pallet.selectBoxHint")}</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableBoxes.length === 0 && (
              <div className="text-center py-6 text-text-muted text-sm">{t("shipping.pallet.noLoadableBoxes")}</div>
            )}
            {availableBoxes.map((box) => (
              <div key={box.boxNo} onClick={() => toggleBoxSelection(box.boxNo)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedBoxes.includes(box.boxNo) ? "bg-primary/10 border-2 border-primary" : "bg-background hover:bg-surface border-2 border-transparent"}`}>
                <div>
                  <p className="font-mono text-sm text-text">{box.boxNo}</p>
                  <p className="text-xs text-text-muted">{box.itemCode}</p>
                </div>
                <span className="text-sm font-medium text-text">{box.qty}{t("common.count")}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-sm text-text-muted">{t("common.selected")}: {selectedBoxes.length}{t("common.count")}</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleAssignBoxes} disabled={selectedBoxes.length === 0 || saving}>
                {saving ? t("common.saving") : <><ArrowRight className="w-4 h-4 mr-1" /> {t("shipping.pallet.assign")}</>}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
