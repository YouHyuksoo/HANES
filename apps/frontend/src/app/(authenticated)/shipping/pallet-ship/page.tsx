"use client";

/**
 * @file apps/frontend/src/app/(authenticated)/shipping/pallet-ship/page.tsx
 * @description 팔레트출하 관리
 *
 * 워크플로우:
 * 1. 출하지시를 선택하면 해당 지시의 팔레트 목록이 표시된다.
 * 2. "팔레트출하 스캔" 버튼 → 스캔 모달에서 팔레트 바코드를 스캔한다.
 * 3. 스캔한 팔레트를 "출하확정"하면 해당 팔레트 + 박스 + 제품이 모두 SHIPPED 처리된다.
 *
 * API: /shipping/orders/{id}/ship-pallets (CLOSED → SHIPPED)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Package, Truck, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, ScanLine, QrCode, Layers,
} from "lucide-react";
import { Card, CardContent, Button, Modal } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";
import api from "@/services/api";
import {
  createPalletShipGridColumns,
  canShip,
  type OrderPallet,
  type OrderPalletRow,
} from "./palletShipColumns";

/* ─── interfaces ─── */

/** 출하지시 요약 (좌측 목록) */
interface ShipOrderSummary {
  shipOrderNo: string;
  customerName: string | null;
  dueDate: string | null;
  shipDate: string | null;
  status: string;
  palletCount: number;
  boxCount: number;
}

/** Fulfillment API 응답 중 라인 */
interface OrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
  remainingQty: number;
}

/** Fulfillment API 응답 */
interface FulfillmentData {
  order: {
    shipOrderNo: string;
    customerName?: string | null;
    shipDate?: string | null;
    dueDate?: string | null;
  };
  lines: OrderLine[];
  pallets: OrderPallet[];
  candidateBoxes: Array<{ boxNo: string; itemCode: string; qty: number; oqcStatus?: string | null }>;
  shipments: Array<{ shipNo: string; status: string }>;
}

/* ─── helpers ─── */

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

/* ─── component ─── */

export default function PalletShipPage() {
  const { t } = useTranslation();

  /* state */
  const [orders, setOrders] = useState<ShipOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentData | null>(null);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);

  const [selectedPallet, setSelectedPallet] = useState<OrderPalletRow | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scannedPallets, setScannedPallets] = useState<string[]>([]);
  const [scanError, setScanError] = useState("");

  const [shipLoading, setShipLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  /* fetch orders */
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await api.get("/shipping/orders", { params: { status: "CONFIRMED", limit: "200" } });
      setOrders(res.data?.data ?? []);
    } catch (e) {
      setPageError(errMsg(e, "출하지시 목록을 불러오지 못했습니다."));
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* fetch fulfillment on order select */
  const fetchFulfillment = useCallback(async (orderNo: string) => {
    setFulfillmentLoading(true);
    setFulfillment(null);
    try {
      const res = await api.get(`/shipping/orders/${orderNo}/fulfillment`);
      setFulfillment(res.data?.data ?? null);
    } catch (e) {
      setPageError(errMsg(e, "출하정보를 불러오지 못했습니다."));
    } finally {
      setFulfillmentLoading(false);
    }
  }, []);

  const selectOrder = useCallback((orderNo: string) => {
    setSelectedOrderNo(orderNo);
    setSelectedPallet(null);
    setScannedPallets([]);
    fetchFulfillment(orderNo);
  }, [fetchFulfillment]);

  /* scan modal */
  const openScanModal = useCallback(() => {
    setScanInput("");
    setScannedPallets([]);
    setScanError("");
    setScanModalOpen(true);
  }, []);

  const addScannedPallet = useCallback((input: string) => {
    const palletNo = input.replace(/[\r\n]+/g, "").trim();
    if (!palletNo) return;
    setScanError("");

    if (scannedPallets.includes(palletNo)) {
      setScanError("이미 등록된 팔레트입니다.");
      return;
    }

    const pallet = fulfillment?.pallets.find((p) => p.palletNo === palletNo);
    if (!pallet) {
      setScanError("해당 출하지시에 없는 팔레트입니다.");
      return;
    }
    if (!canShip(pallet)) {
      setScanError(`출하 가능한 상태가 아닙니다. (현재: ${pallet.status})`);
      return;
    }

    setScannedPallets((prev) => [...prev, palletNo]);
    setScanInput("");
  }, [scannedPallets, fulfillment]);

  const removeScannedPallet = useCallback((palletNo: string) => {
    setScannedPallets((prev) => prev.filter((p) => p !== palletNo));
  }, []);

  /* confirm shipping */
  const confirmShip = useCallback(async () => {
    if (!selectedOrderNo || scannedPallets.length === 0) return;
    setShipLoading(true);
    setScanError("");
    try {
      await api.post(`/shipping/orders/${selectedOrderNo}/ship-pallets`, { palletNos: scannedPallets });
      setScanModalOpen(false);
      setScannedPallets([]);
      fetchFulfillment(selectedOrderNo);
    } catch (e) {
      setScanError(errMsg(e, "출하 처리에 실패했습니다."));
    } finally {
      setShipLoading(false);
    }
  }, [selectedOrderNo, scannedPallets, fetchFulfillment]);

  /* columns for pallet grid */
  const palletColumns = useMemo(() => createPalletShipGridColumns(), []);

  const palletRows = useMemo<OrderPalletRow[]>(() => {
    const fallbackShipmentNo = fulfillment?.shipments.length === 1 ? fulfillment.shipments[0]?.shipNo ?? null : null;
    return (fulfillment?.pallets ?? []).map((p) => ({
      ...p,
      shipmentNo: p.shipmentId ?? fallbackShipmentNo,
      shipmentNoText: p.shipmentId ?? fallbackShipmentNo ?? (p.status === "SHIPPED" ? "확인필요" : "출하 전"),
    }));
  }, [fulfillment]);

  const shippableCount = useMemo(
    () => palletRows.filter(canShip).length,
    [palletRows],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />팔레트출하 관리</h1>
          <p className="text-text-muted mt-1">출하지시별 팔레트를 스캔하여 일괄 출하 처리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { fetchOrders(); if (selectedOrderNo) fetchFulfillment(selectedOrderNo); }}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
          <Button size="sm" disabled={!selectedOrderNo || shippableCount === 0} onClick={openScanModal}>
            <ScanLine className="w-4 h-4 mr-1" />팔레트출하 스캔
          </Button>
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /><span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError("")}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* body: three-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-6 flex-1 min-h-0 overflow-hidden">
        {/* left: order list */}
        <Card className="overflow-hidden flex flex-col min-h-0" padding="none">
          <CardContent className="h-full p-3 flex flex-col overflow-hidden">
            <div className="mb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-text">출하지시 목록</h2>
              <p className="mt-0.5 text-xs text-text-muted">{ordersLoading ? "로딩 중..." : `${orders.length}건`}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
            {orders.length === 0 && !ordersLoading ? (
              <div className="text-center py-8 text-text-muted text-sm">출하 대기 중인 지시가 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {orders.map((o) => (
                  <button
                    key={o.shipOrderNo}
                    type="button"
                    onClick={() => selectOrder(o.shipOrderNo)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedOrderNo === o.shipOrderNo
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-text text-sm truncate">{o.shipOrderNo}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${o.status === "CONFIRMED" ? "border-primary text-primary bg-primary/5" : "border-border text-text-muted"}`}>{o.status}</span>
                    </div>
                    {o.customerName && <p className="text-xs text-text-muted mt-0.5 truncate">{o.customerName}</p>}
                    {o.dueDate && <p className="text-xs text-text-muted mt-0.5">납기: {String(o.dueDate).slice(0, 10)}</p>}
                    <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" />팔레트 {(o.palletCount ?? 0).toLocaleString()}</span>
                      <span className="text-border">·</span>
                      <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" />박스 {(o.boxCount ?? 0).toLocaleString()}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        {/* center: pallet grid */}
        <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3 flex flex-col gap-3">
          {/* header row */}
          <div className="flex flex-wrap items-start justify-between gap-2 flex-shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-text">팔레트 목록</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {!selectedOrderNo ? "출하지시를 선택하세요" : fulfillmentLoading ? "로딩 중..." : fulfillment ? `${palletRows.length}개` : ""}
              </p>
            </div>
            {fulfillment && (
              <span className="text-xs text-text-muted">
                <CheckCircle2 className="w-3 h-3 inline mr-0.5 text-green-500" />
                {shippableCount}개 출하 가능
              </span>
            )}
          </div>

          {!selectedOrderNo ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <Package className="w-12 h-12 opacity-50" />
            </div>
          ) : fulfillmentLoading ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">로딩 중...</div>
          ) : fulfillment ? (
            <DataGrid
              data={palletRows}
              columns={palletColumns}
              enableColumnFilter
              enableExport
              exportFileName={`팔레트출하_${selectedOrderNo}`}
              rowClassName={(row) => !canShip(row) ? "opacity-50" : ""}
              onRowClick={(row) => setSelectedPallet(row)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-red-500 text-sm">불러오기 실패</div>
          )}
        </CardContent></Card>

        {/* right: selected pallet's box detail */}
        <Card padding="none">
          <CardContent className="p-3">
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-text">박스 구성</h2>
              <p className="mt-0.5 text-xs text-text-muted">{selectedPallet ? `${selectedPallet.boxCount.toLocaleString()}박스 · ${selectedPallet.totalQty.toLocaleString()}개` : "팔레트를 선택하세요"}</p>
            </div>
            {!selectedPallet ? (
              <div className="text-center py-8 text-text-muted">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">팔레트를 선택하면<br />박스 구성을 확인할 수 있습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-mono font-semibold text-text">{selectedPallet.palletNo}</p>
                    <p className="text-xs text-text-muted mt-0.5"><BoxStatusBadge status={selectedPallet.status as BoxStatus} /></p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text">{selectedPallet.boxCount.toLocaleString()}박스</p>
                    <p className="text-xs text-text-muted">{selectedPallet.totalQty.toLocaleString()}개</p>
                  </div>
                </div>
                {(!selectedPallet.boxes || selectedPallet.boxes.length === 0) ? (
                  <div className="text-center py-8 text-text-muted text-sm">구성된 박스가 없습니다.</div>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {selectedPallet.boxes.map((box, idx) => (
                      <div key={box.boxNo} className="flex items-center justify-between p-3 bg-background rounded-lg">
                        <div>
                          <p className="font-mono text-sm text-text">{box.boxNo}</p>
                          <p className="text-xs text-text-muted">{box.itemCode}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium text-text">{box.qty.toLocaleString()}개</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* scan modal */}
      <Modal isOpen={scanModalOpen} onClose={() => setScanModalOpen(false)} title="팔레트 바코드 스캔" size="lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <BarcodeScanInput
              placeholder="팔레트 바코드를 스캔하거나 입력하세요"
              value={scanInput}
              onChange={setScanInput}
              onScan={addScannedPallet}
              disabled={shipLoading}
              fullWidth
            />
            <Button onClick={() => addScannedPallet(scanInput)} disabled={!scanInput.trim() || shipLoading}>
              <QrCode className="w-4 h-4 mr-1" />추가
            </Button>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /><span>{scanError}</span>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-text-muted mb-2">
              스캔된 팔레트 ({scannedPallets.length}개)
            </p>
            {scannedPallets.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-sm border border-dashed border-border rounded-lg">
                팔레트를 스캔하여 목록에 추가하세요.
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {scannedPallets.map((palletNo) => {
                  const pallet = fulfillment?.pallets.find((p) => p.palletNo === palletNo);
                  return (
                    <div key={palletNo} className="flex items-center justify-between py-2 px-3 bg-background rounded text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="font-mono font-medium text-text">{palletNo}</span>
                        {pallet && (
                          <span className="text-text-muted text-xs">
                            {pallet.boxCount.toLocaleString()}박스 / {pallet.totalQty.toLocaleString()}개
                          </span>
                        )}
                      </div>
                      <button onClick={() => removeScannedPallet(palletNo)} disabled={shipLoading}>
                        <XCircle className="w-4 h-4 text-text-muted hover:text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-xs text-text-muted">
              <Truck className="w-3 h-3 inline mr-1" />
              {selectedOrderNo} — {scannedPallets.length}개 팔레트 출하
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setScanModalOpen(false)}>취소</Button>
              <Button onClick={confirmShip} disabled={scannedPallets.length === 0 || shipLoading}>
                {shipLoading ? "처리 중..." : `출하확정 (${scannedPallets.length}개)`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
