"use client";

/**
 * @file src/app/(authenticated)/shipping/pallet/page.tsx
 * @description 팔레트적재 페이지 - 박스를 팔레트에 적재
 *
 * 초보자 가이드:
 * 1. **팔레트**: 여러 박스를 묶어 운송하는 물류 단위
 * 2. **상태 흐름**: OPEN -> CLOSED -> LOADED -> SHIPPED
 * 3. **박스 할당**: 마감(CLOSED) + OQC 사용 시 합격 + 미할당 박스만 적재 가능
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
  Layers, Plus, Search, RefreshCw,
  Package, ArrowRight, X, ScanLine,
} from "lucide-react";
import { Card, CardContent, Button, ConfirmModal, Input, Modal, Select } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import OpenIncludedNotice from "@/components/shared/OpenIncludedNotice";
import { getTodayLocal } from "@/utils/date";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import toast from "react-hot-toast";
import PalletLabelModal from "./components/PalletLabelModal";
import type { PalletLabelInfo } from "./components/PalletLabelModal";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import { createPalletGridColumns } from "./palletColumns";
import type { Pallet } from "./palletColumns";

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
  palletCount?: number;
  boxCount?: number;
  items: ShipOrderLineSummary[];
}

export default function PalletPage() {
  const { t } = useTranslation();
  const sysConfigLoaded = useSysConfigStore((state) => state.isLoaded);
  const sysConfigOqcEnabled = useSysConfigStore((state) => state.isEnabled("OQC_ENABLED"));
  const fetchConfigs = useSysConfigStore((state) => state.fetchConfigs);
  const oqcEnabled = !sysConfigLoaded || sysConfigOqcEnabled;
  const comCodeOptions = useComCodeOptions("PALLET_STATUS");
  const statusOptions = useMemo(
    () => [{ value: "", label: t("common.allStatus") }, ...comCodeOptions],
    [t, comCodeOptions],
  );
  const scanInputRef = useRef<HTMLInputElement>(null);
  const shipOrderScanInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  // 작업 대상 목록 기본 필터: 당일 생성분 + 미완료(OPEN/CLOSED/LOADED)는 기간 무관 항상 노출
  const [createdFrom, setCreatedFrom] = useState(getTodayLocal());
  const [createdTo, setCreatedTo] = useState(getTodayLocal());
  const [scanText, setScanText] = useState("");
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [shipOrders, setShipOrders] = useState<ShipOrderSummary[]>([]);
  const [selectedShipOrderNo, setSelectedShipOrderNo] = useState("");
  const [shipOrderScanText, setShipOrderScanText] = useState("");
  const [loadingShipOrders, setLoadingShipOrders] = useState(false);
  const [palletBoxes, setPalletBoxes] = useState<PalletBox[]>([]);
  const [availableBoxes, setAvailableBoxes] = useState<AvailableBox[]>([]);
  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([]);
  const [removeBoxTarget, setRemoveBoxTarget] = useState<string | null>(null);
  const [deletePalletTarget, setDeletePalletTarget] = useState<Pallet | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [scanBoxInput, setScanBoxInput] = useState("");
  const scanBoxRef = useRef<HTMLInputElement>(null);
  const [labelPallet, setLabelPallet] = useState<PalletLabelInfo | null>(null);
  const [labelAutoPrint, setLabelAutoPrint] = useState(false);

  useEffect(() => {
    if (!sysConfigLoaded) void fetchConfigs();
  }, [fetchConfigs, sysConfigLoaded]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.palletNo = searchText;
      if (statusFilter) params.status = statusFilter;
      if (createdFrom) params.createdFrom = createdFrom;
      if (createdTo) params.createdTo = createdTo;
      // 상태 미지정 시 기간 밖이어도 미완료(작업 중) 팔레트는 항상 노출
      if (!statusFilter) params.includeOpen = "true";
      const res = await api.get("/shipping/pallets", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, createdFrom, createdTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchShipOrders = useCallback(async () => {
    setLoadingShipOrders(true);
    try {
      const res = await api.get("/shipping/orders", { params: { status: "CONFIRMED", limit: "5000" } });
      const list: ShipOrderSummary[] = res.data?.data ?? [];
      const unshipped = list.filter((order) =>
        order.palletCount === 0 &&
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

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const timer = window.setTimeout(() => shipOrderScanInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isCreateModalOpen]);

  const selectedShipOrder = useMemo(
    () => shipOrders.find((order) => order.shipOrderNo === selectedShipOrderNo) ?? null,
    [selectedShipOrderNo, shipOrders],
  );

  const selectShipOrderForCreate = useCallback((shipOrderNo: string) => {
    setSelectedShipOrderNo(shipOrderNo);
    setShipOrderScanText(shipOrderNo);
    shipOrderScanInputRef.current?.focus();
  }, []);

  const handleShipOrderScan = useCallback((rawShipOrderNo?: string) => {
    const scanned = (rawShipOrderNo ?? shipOrderScanText).replace(/\r?\n|\r/g, "").trim();
    if (!scanned) return;
    const found = shipOrders.find((order) => order.shipOrderNo === scanned);
    if (!found) {
      setSelectedShipOrderNo("");
      toast.error(t("shipping.pallet.shipOrderNotWaiting", "팔레트 생성 대기중인 출하지시가 아닙니다."));
      shipOrderScanInputRef.current?.focus();
      return;
    }
    setSelectedShipOrderNo(found.shipOrderNo);
    setShipOrderScanText(found.shipOrderNo);
  }, [shipOrderScanText, shipOrders, t]);

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
  const handleBarcodeScan = useCallback((rawBarcode?: string) => {
    const val = (rawBarcode ?? scanText).replace(/\r?\n|\r/g, "").trim();
    if (!val) return;
    setSearchText(val);
    setScanText("");
    scanInputRef.current?.focus();
  }, [scanText]);

  const buildAvailableBoxParams = useCallback((extra: Record<string, string> = {}) => {
    const params: Record<string, string> = { status: "CLOSED", unassigned: "true", ...extra };
    if (oqcEnabled) params.oqcStatus = "PASS";
    return params;
  }, [oqcEnabled]);

  /** 적재 후보: 마감(CLOSED) + OQC 사용 시 합격(PASS) + 팔레트 미할당 박스 */
  const fetchAvailableBoxes = useCallback(async () => {
    try {
      const res = await api.get("/shipping/boxes", {
        params: buildAvailableBoxParams(),
      });
      setAvailableBoxes(res.data?.data ?? []);
    } catch {
      setAvailableBoxes([]);
    }
  }, [buildAvailableBoxParams]);

  /** 액션 응답의 팔레트로 선택 상태를 동기화하고 목록·박스를 갱신 */
  const syncAfterAction = useCallback((pallet: Pallet | undefined) => {
    if (pallet) {
      setSelectedPallet(pallet);
      fetchPalletBoxes(pallet.palletNo);
    }
    fetchData();
  }, [fetchData, fetchPalletBoxes]);

  const canDeleteEmptyPallet = useCallback((pallet: Pallet) => (
    pallet.status === "OPEN" && pallet.boxCount === 0 && !pallet.shipmentId
  ), []);

  const handleCreate = useCallback(async () => {
    const scanned = shipOrderScanText.trim();
    const targetShipOrderNo = selectedShipOrderNo || scanned;
    const found = shipOrders.find((order) => order.shipOrderNo === targetShipOrderNo);
    if (!targetShipOrderNo || !found) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시를 먼저 선택하세요."));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(targetShipOrderNo)}/pallets`, {});
      setIsCreateModalOpen(false);
      setSelectedShipOrderNo("");
      setShipOrderScanText("");
      fetchData();
      fetchShipOrders();
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setSaving(false);
    }
  }, [fetchData, fetchShipOrders, selectedShipOrderNo, shipOrderScanText, shipOrders, t]);

  /** 박스번호 스캔 → 유효성 검증 후 선택 목록에 추가 */
  const handleScanBox = useCallback(async (rawBoxNo?: string) => {
    const boxNo = (rawBoxNo ?? scanBoxInput).replace(/\r?\n|\r/g, "").trim();
    if (!boxNo || !selectedPallet) return;
    if (!selectedPallet.shipOrderNo) {
      toast.error(t("shipping.pallet.shipOrderRequired", "출하지시가 없는 팔레트는 구성할 수 없습니다."));
      return;
    }
    try {
      const res = await api.get("/shipping/boxes", {
        params: buildAvailableBoxParams({ boxNo }),
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
  }, [buildAvailableBoxParams, scanBoxInput, selectedPallet, t]);

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

  const handleDeletePallet = useCallback(async () => {
    if (!deletePalletTarget) return;
    if (!canDeleteEmptyPallet(deletePalletTarget)) {
      setDeletePalletTarget(null);
      return;
    }
    setSaving(true);
    try {
      await api.delete(`/shipping/pallets/${deletePalletTarget.palletNo}`);
      if (selectedPallet?.palletNo === deletePalletTarget.palletNo) {
        setSelectedPallet(null);
        setPalletBoxes([]);
      }
      setDeletePalletTarget(null);
      fetchData();
      fetchShipOrders();
    } catch (e) {
      console.error("Delete pallet failed:", e);
    } finally {
      setSaving(false);
    }
  }, [canDeleteEmptyPallet, deletePalletTarget, fetchData, fetchShipOrders, selectedPallet]);

  const toggleBoxSelection = (boxNo: string) =>
    setSelectedBoxes((prev) => prev.includes(boxNo) ? prev.filter((b) => b !== boxNo) : [...prev, boxNo]);

  // 기간(생성일) 밖이지만 미완료(SHIPPED 아님)라 includeOpen으로 포함된 행
  const outOfRangeNos = useMemo(() => {
    const set = new Set<string>();
    if (statusFilter) return set; // 상태 명시 시 includeOpen 미적용
    for (const p of data) {
      const d = (p.createdAt || "").slice(0, 10);
      const inRange = !!d && !!createdFrom && !!createdTo && d >= createdFrom && d <= createdTo;
      if (!inRange && p.status !== "SHIPPED") set.add(p.palletNo);
    }
    return set;
  }, [data, statusFilter, createdFrom, createdTo]);

  const columns = useMemo(() => createPalletGridColumns({
    t,
    saving,
    selectPallet,
    setIsAssignModalOpen,
    fetchAvailableBoxes,
    handleClosePallet,
    handleReopenPallet,
    handleOpenLabel,
    canDeleteEmptyPallet,
    setDeletePalletTarget,
  }), [t, handleClosePallet, handleReopenPallet, fetchAvailableBoxes, selectPallet, canDeleteEmptyPallet, saving]);

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
          <Button size="sm" onClick={() => { fetchShipOrders(); setSelectedShipOrderNo(""); setShipOrderScanText(""); setIsCreateModalOpen(true); }}><Plus className="w-4 h-4 mr-1" /> {t("shipping.pallet.createPallet")}</Button>
        </div>
      </div>

      <OpenIncludedNotice count={outOfRangeNos.size} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_20rem] gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="min-h-0">
          <Card className="h-full flex flex-col overflow-hidden" padding="none"><CardContent className="h-full p-4 flex flex-col min-h-0">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("shipping.pallet.title")}
              rowClassName={(row) => outOfRangeNos.has(row.palletNo) ? "border-l-2 border-l-amber-500" : ""}
              toolbarLeft={
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 lg:grid-cols-[auto_minmax(7rem,1fr)_7rem_8rem] lg:items-center">
                  <DateRangeFilter
                    from={createdFrom}
                    to={createdTo}
                    onFromChange={setCreatedFrom}
                    onToChange={setCreatedTo}
                    label={t("common.createdAt")}
                    presets={false}
                    className="[&_input]:w-28"
                  />
                  <div className="min-w-0">
                    <Input placeholder={t("shipping.pallet.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-28">
                    <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                  <div className="w-32">
                    <BarcodeScanInput
                      ref={scanInputRef}
                      placeholder={t("shipping.pallet.barcodePlaceholder", "바코드 스캔")}
                      value={scanText}
                      onChange={setScanText}
                      onScan={handleBarcodeScan}
                      fullWidth
                    />
                  </div>
                </div>
              }
              onRowClick={selectPallet}
            sqlQuery={`SELECT *\nFROM PALLET_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent></Card>
        </div>
        <Card className="min-h-0 overflow-hidden flex flex-col" padding="none">
          <CardContent className="h-full p-4 flex flex-col min-h-0 overflow-y-auto">
            <div className="mb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-text">{t("shipping.pallet.includedBoxes")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{selectedPallet ? selectedPallet.palletNo : t("shipping.pallet.selectPallet")}</p>
            </div>
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
                        <span className="text-sm font-medium text-text">{box.qty.toLocaleString()}{t("common.count")}</span>
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

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t("shipping.pallet.createPallet")} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4">
          <section className="min-h-[320px] rounded-lg border border-border bg-background/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text">{t("shipping.pallet.waitingShipOrders", "팔레트 대기중인 출하지시")}</h3>
              <p className="mt-0.5 text-xs text-text-muted">{t("shipping.pallet.waitingShipOrdersHint", "팔레트가 아직 생성되지 않은 확정 출하지시만 표시됩니다.")}</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {loadingShipOrders ? (
                <div className="flex items-center justify-center py-10 text-sm text-text-muted">
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t("common.loading", "로딩 중")}
                </div>
              ) : shipOrders.length === 0 ? (
                <div className="py-10 text-center text-sm text-text-muted">
                  {t("shipping.pallet.noWaitingShipOrders", "팔레트 생성 대기중인 출하지시가 없습니다.")}
                </div>
              ) : (
                <div className="space-y-2">
                  {shipOrders.map((order) => (
                    <button
                      key={order.shipOrderNo}
                      type="button"
                      onClick={() => selectShipOrderForCreate(order.shipOrderNo)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        selectedShipOrderNo === order.shipOrderNo
                          ? "border-primary bg-primary/10"
                          : "border-border bg-surface hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-text">{order.shipOrderNo}</span>
                        <span className="text-xs text-text-muted">{order.shipDate ?? order.dueDate ?? "-"}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-muted">
                        <span className="truncate">{order.customerName ?? "-"}</span>
                        <span>{order.items?.length ?? 0}{t("common.count")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-sm text-text-muted">{t("shipping.pallet.createConfirm", "출하지시번호를 스캔하거나 좌측 대기 목록에서 선택해 팔레트를 생성합니다.")}</p>
            <BarcodeScanInput
              ref={shipOrderScanInputRef}
              label={t("shipping.pallet.shipOrderNo", "출하지시번호")}
              placeholder={t("shipping.pallet.scanShipOrderPlaceholder", "출하지시번호 스캔")}
              value={shipOrderScanText}
              onChange={(value) => { setShipOrderScanText(value); setSelectedShipOrderNo(""); }}
              onScan={handleShipOrderScan}
              required
              fullWidth
            />
            <div className="rounded-lg border border-border bg-background p-3 min-h-[96px]">
              <p className="text-xs text-text-muted">{t("shipping.pallet.selectedShipOrder", "선택된 출하지시")}</p>
              {selectedShipOrder ? (
                <div className="mt-2 space-y-1">
                  <p className="font-mono text-base font-semibold text-text">{selectedShipOrder.shipOrderNo}</p>
                  <p className="text-sm text-text-muted">{selectedShipOrder.customerName ?? "-"}</p>
                  <p className="text-xs text-text-muted">{selectedShipOrder.shipDate ?? selectedShipOrder.dueDate ?? "-"}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-text-muted">{t("shipping.pallet.scanShipOrderHint", "스캔 후 Enter를 누르면 대기 목록과 대조합니다.")}</p>
              )}
            </div>
            <p className="text-sm text-text-muted">{t("shipping.pallet.autoNumberHint", "팔레트번호는 자동으로 채번됩니다.")}</p>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCreate} disabled={saving || (!selectedShipOrderNo && !shipOrderScanText.trim())}>
                {saving ? t("common.saving") : t("common.create")}
              </Button>
            </div>
          </section>
        </div>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={t("shipping.pallet.assignBox")} size="lg">
        <div className="space-y-4">
          {selectedPallet && (
            <div className="p-3 bg-background rounded-lg">
              <p className="text-sm text-text-muted">{t("shipping.pallet.pallet")}: <span className="font-medium text-text">{selectedPallet.palletNo}</span></p>
            </div>
          )}
          <BarcodeScanInput
            ref={scanBoxRef}
            placeholder={t("shipping.pallet.scanBoxPlaceholder", "박스번호 스캔")}
            value={scanBoxInput}
            onChange={setScanBoxInput}
            onScan={handleScanBox}
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
                <span className="text-sm font-medium text-text">{box.qty.toLocaleString()}{t("common.count")}</span>
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
      <ConfirmModal
        isOpen={!!deletePalletTarget}
        onClose={() => setDeletePalletTarget(null)}
        onConfirm={handleDeletePallet}
        title={t("common.deleteConfirm", "삭제 확인")}
        message={`${deletePalletTarget?.palletNo ?? ""} ${t("shipping.pallet.deleteEmptyPalletMessage", "빈 팔레트를 삭제하시겠습니까?")}`}
        variant="danger"
      />
    </div>
  );
}
