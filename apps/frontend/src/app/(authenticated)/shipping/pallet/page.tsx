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
 *    - POST /shipping/pallets/:palletNo/boxes { boxIds }
 *    - POST /shipping/pallets/:palletNo/boxes/remove { boxIds }
 *    - POST /shipping/pallets/:palletNo/close | /:palletNo/reopen
 *    - GET  /shipping/pallets/barcode/:palletNo/boxes (포함 박스)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers, Plus, Search, RefreshCw, Lock, LockOpen, Truck,
  Package, CheckCircle, ArrowRight, X, ScanLine, Printer,
} from "lucide-react";
import { Card, CardHeader, CardContent, Button, ConfirmModal, Input, Modal, Select, StatCard } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { PalletStatusBadge } from "@/components/shipping";
import type { PalletStatus } from "@/components/shipping";
import api from "@/services/api";
import toast from "react-hot-toast";
import PalletLabelModal from "./components/PalletLabelModal";
import type { PalletLabelInfo } from "./components/PalletLabelModal";

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

/** palletNo가 PK이므로 별도 id 불필요 */
interface Pallet {
  palletNo: string;
  boxCount: number;
  totalQty: number;
  status: PalletStatus;
  shipmentId: string | null;
  createdAt: string;
  closeAt: string | null;
  shipOrderNo?: string | null;
  shippedAt?: string | null;
}

interface ShipOrderLineSummary {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}

interface ShipOrderSummary {
  shipOrderNo: string;
  customerName?: string;
  shipDate?: string;
  dueDate?: string;
  status: string;
  items: ShipOrderLineSummary[];
}

export default function PalletPage() {
  const { t } = useTranslation();
  const comCodeOptions = useComCodeOptions("PALLET_STATUS");
  const statusOptions = useMemo(
    () => [{ value: "", label: t("common.allStatus") }, ...comCodeOptions],
    [t, comCodeOptions],
  );
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [scanText, setScanText] = useState("");
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [shipOrders, setShipOrders] = useState<ShipOrderSummary[]>([]);
  const [selectedShipOrderNo, setSelectedShipOrderNo] = useState("");
  const [loadingShipOrders, setLoadingShipOrders] = useState(false);
  const [palletBoxes, setPalletBoxes] = useState<PalletBox[]>([]);
  const [availableBoxes, setAvailableBoxes] = useState<AvailableBox[]>([]);
  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([]);
  const [removeBoxTarget, setRemoveBoxTarget] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [scanBoxInput, setScanBoxInput] = useState("");
  const scanBoxRef = useRef<HTMLInputElement>(null);
  const [labelPallet, setLabelPallet] = useState<PalletLabelInfo | null>(null);
  const [labelAutoPrint, setLabelAutoPrint] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
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

  const fetchShipOrders = useCallback(async () => {
    setLoadingShipOrders(true);
    try {
      const res = await api.get("/shipping/orders", { params: { status: "CONFIRMED", limit: "5000" } });
      const list: ShipOrderSummary[] = res.data?.data ?? [];
      const unshipped = list.filter((order) =>
        order.items?.some((item) => item.orderQty > item.shippedQty),
      );
      setShipOrders(unshipped);
      setSelectedShipOrderNo((current) =>
        current && unshipped.some((order) => order.shipOrderNo === current) ? current : "",
      );
    } catch {
      setShipOrders([]);
      setSelectedShipOrderNo("");
    } finally {
      setLoadingShipOrders(false);
    }
  }, []);

  useEffect(() => { fetchShipOrders(); }, [fetchShipOrders]);

  const handleRefresh = useCallback(() => {
    fetchData();
    fetchShipOrders();
  }, [fetchData, fetchShipOrders]);

  const shipOrderOptions = useMemo(() => [
    { value: "", label: t("shipping.pallet.selectShipOrder", "출하지시를 선택하세요") },
    ...shipOrders.map((order) => ({
      value: order.shipOrderNo,
      label: `${order.shipOrderNo} · ${order.customerName ?? "-"} · ${order.shipDate ?? order.dueDate ?? "-"}`,
    })),
  ], [shipOrders, t]);

  /** 선택 팔레트의 포함 박스 조회 */
  const fetchPalletBoxes = useCallback(async (palletNo: string) => {
    setBoxesLoading(true);
    try {
      const res = await api.get(`/shipping/pallets/barcode/${encodeURIComponent(palletNo)}/boxes`);
      setPalletBoxes(res.data?.data?.boxes ?? []);
    } catch (e) {
      setPalletBoxes([]);
      toast.error(t("common.loadError", "조회 중 오류가 발생했습니다."));
    } finally {
      setBoxesLoading(false);
    }
  }, [t]);

  const selectPallet = useCallback((pallet: Pallet) => {
    setSelectedPallet(pallet);
    fetchPalletBoxes(pallet.palletNo);
  }, [fetchPalletBoxes]);

  /** 바코드 스캔 처리 */
  const handleBarcodeScan = useCallback(() => {
    const val = scanText.trim();
    if (!val) return;
    setSearchText(val);
    setScanText("");
    scanInputRef.current?.focus();
  }, [scanText]);

  /** 적재 후보: 마감(CLOSED) + OQC 합격(PASS) + 팔레트 미할당 박스 */
  const fetchAvailableBoxes = useCallback(async () => {
    try {
      const res = await api.get("/shipping/boxes", {
        params: { status: "CLOSED", unassigned: "true", oqcStatus: "PASS" },
      });
      setAvailableBoxes(res.data?.data ?? []);
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
    if (!selectedShipOrderNo) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시를 먼저 선택하세요."));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(selectedShipOrderNo)}/pallets`, {});
      setIsCreateModalOpen(false);
      setSelectedShipOrderNo("");
      fetchData();
      fetchShipOrders();
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setSaving(false);
    }
  }, [fetchData, fetchShipOrders, selectedShipOrderNo, t]);

  /** 박스번호 스캔 → 유효성 검증 후 선택 목록에 추가 */
  const handleScanBox = useCallback(async () => {
    const boxNo = scanBoxInput.trim();
    if (!boxNo || !selectedPallet) return;
    if (!selectedPallet.shipOrderNo) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시가 없는 팔레트는 구성할 수 없습니다."));
      return;
    }
    try {
      const res = await api.get("/shipping/boxes", {
        params: { boxNo, status: "CLOSED", oqcStatus: "PASS", unassigned: "true" },
      });
      const boxes: AvailableBox[] = res.data?.data ?? [];
      if (boxes.length === 0) {
        toast.error(t("shipping.pallet.boxNotFound", "적재 가능한 박스를 찾을 수 없습니다."));
      } else {
        const box = boxes[0];
        setSelectedBoxes((prev) => prev.includes(box.boxNo) ? prev : [...prev, box.boxNo]);
        toast.success(`✓ ${box.boxNo}`, { duration: 1000 });
      }
    } catch {
      toast.error(t("shipping.pallet.boxScanError", "박스 조회에 실패했습니다."));
    }
    setScanBoxInput("");
    scanBoxRef.current?.focus();
  }, [scanBoxInput, selectedPallet, t]);

  const handleAssignBoxes = useCallback(async () => {
    if (!selectedPallet || selectedBoxes.length === 0) return;
    if (!selectedPallet.shipOrderNo) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시가 없는 팔레트는 구성할 수 없습니다."));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(selectedPallet.shipOrderNo)}/pallets/${selectedPallet.palletNo}/boxes`, { boxIds: selectedBoxes });
      setSelectedBoxes([]);
      setIsAssignModalOpen(false);
      const refreshed = await api.get(`/shipping/pallets/pallet-no/${encodeURIComponent(selectedPallet.palletNo)}`);
      syncAfterAction(refreshed.data?.data);
    } catch (e) {
      console.error("Assign failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedPallet, selectedBoxes, syncAfterAction, t]);

  const handleRemoveBox = useCallback(async () => {
    if (!selectedPallet || !removeBoxTarget) return;
    if (!selectedPallet.shipOrderNo) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시가 없는 팔레트는 구성할 수 없습니다."));
      return;
    }
    setSaving(true);
    try {
      await api.delete(`/shipping/orders/${encodeURIComponent(selectedPallet.shipOrderNo)}/pallets/${selectedPallet.palletNo}/boxes`, { data: { boxIds: [removeBoxTarget] } });
      setRemoveBoxTarget(null);
      const refreshed = await api.get(`/shipping/pallets/pallet-no/${encodeURIComponent(selectedPallet.palletNo)}`);
      syncAfterAction(refreshed.data?.data);
    } catch (e) {
      console.error("Remove box failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedPallet, removeBoxTarget, syncAfterAction, t]);

  const handleClosePallet = useCallback(async (pallet: Pallet) => {
    if (!pallet.shipOrderNo) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시가 없는 팔레트는 마감할 수 없습니다."));
      return;
    }
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(pallet.shipOrderNo)}/pallets/${pallet.palletNo}/close`);
      const refreshed = await api.get(`/shipping/pallets/pallet-no/${encodeURIComponent(pallet.palletNo)}`);
      syncAfterAction(refreshed.data?.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t("common.error"));
    }
  }, [syncAfterAction, t]);

  /** 라벨 출력 */
  const handleOpenLabel = useCallback(async (pallet: Pallet) => {
    setLabelAutoPrint(false);
    // 포함 박스 정보도 함께 조회
    let boxes: PalletBox[] = [];
    try {
      const res = await api.get(`/shipping/pallets/barcode/${encodeURIComponent(pallet.palletNo)}/boxes`);
      boxes = res.data?.data?.boxes ?? [];
    } catch { /* 박스 목록은 옵셔널 */ }
    setLabelPallet({
      palletNo: pallet.palletNo,
      boxCount: pallet.boxCount,
      totalQty: pallet.totalQty,
      status: pallet.status,
      shipOrderNo: pallet.shipOrderNo,
      createdAt: pallet.createdAt,
      boxes,
    });
  }, []);

  const handleReopenPallet = useCallback(async (pallet: Pallet) => {
    try {
      const res = await api.post(`/shipping/pallets/${pallet.palletNo}/reopen`);
      syncAfterAction(res.data?.data);
    } catch (e) {
      console.error("Reopen pallet failed:", e);
    }
  }, [syncAfterAction]);

  const toggleBoxSelection = (boxNo: string) =>
    setSelectedBoxes((prev) => prev.includes(boxNo) ? prev.filter((b) => b !== boxNo) : [...prev, boxNo]);

  const columns = useMemo<ColumnDef<Pallet>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 130, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const pallet = row.original;
        const isOpen = pallet.status === "OPEN";
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" title={t("shipping.pallet.assignBox")} disabled={!isOpen || !pallet.shipOrderNo} onClick={() => { selectPallet(pallet); setIsAssignModalOpen(true); fetchAvailableBoxes(); }}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.closePallet")} disabled={!isOpen || !pallet.shipOrderNo} onClick={() => handleClosePallet(pallet)}>
              <Lock className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.reopenPallet")} disabled={pallet.status !== "CLOSED"} onClick={() => handleReopenPallet(pallet)}>
              <LockOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" title={t("shipping.pallet.printLabel", "라벨 출력")} onClick={() => handleOpenLabel(pallet)}>
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
    { accessorKey: "shipOrderNo", header: t("shipping.pallet.shipOrderNo", "출하지시번호"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span> },
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
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => { fetchShipOrders(); setIsCreateModalOpen(true); }}><Plus className="w-4 h-4 mr-1" /> {t("shipping.pallet.createPallet")}</Button>
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
                  <div className="w-48 flex-shrink-0">
                    <Input
                      ref={scanInputRef}
                      placeholder={t("shipping.pallet.barcodePlaceholder", "바코드 스캔")}
                      value={scanText}
                      onChange={(e) => setScanText(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeScan(); } }}
                      leftIcon={<ScanLine className="w-4 h-4" />}
                      fullWidth
                    />
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
              boxesLoading ? (
                <div className="flex items-center justify-center py-8 text-text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  <span>{t("common.loading", "로딩 중")}</span>
                </div>
              ) : palletBoxes.length > 0 ? (
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
                          <button className="p-1 hover:bg-surface rounded" title={t("shipping.pallet.removeBox")} disabled={saving} onClick={() => setRemoveBoxTarget(box.boxNo)}>
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
          <p className="text-text-muted">{t("shipping.pallet.createConfirm", "출하지시 기준으로 팔레트를 생성합니다.")}</p>
          <Select
            label={t("shipping.pallet.shipOrderNo", "출하지시번호")}
            options={shipOrderOptions}
            value={selectedShipOrderNo}
            onChange={setSelectedShipOrderNo}
            disabled={loadingShipOrders}
            required
            fullWidth
          />
          <p className="text-sm text-text-muted">{t("shipping.pallet.autoNumberHint", "팔레트번호는 자동으로 채번됩니다.")}</p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving || !selectedShipOrderNo}>
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
          <Input
            ref={scanBoxRef}
            placeholder={t("shipping.pallet.scanBoxPlaceholder", "박스번호 스캔")}
            value={scanBoxInput}
            onChange={(e) => setScanBoxInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); handleScanBox(); } }}
            leftIcon={<ScanLine className="w-4 h-4" />}
            fullWidth
          />
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
      <PalletLabelModal
        isOpen={!!labelPallet}
        pallet={labelPallet}
        autoPrint={labelAutoPrint}
        onClose={() => { setLabelPallet(null); setLabelAutoPrint(false); }}
      />
      <ConfirmModal
        isOpen={!!removeBoxTarget}
        onClose={() => setRemoveBoxTarget(null)}
        onConfirm={handleRemoveBox}
        title={t("common.deleteConfirm", "삭제 확인")}
        message={`${removeBoxTarget ?? ""} ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        variant="danger"
      />
    </div>
  );
}
