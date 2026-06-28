"use client";

/**
 * @file src/app/(authenticated)/shipping/confirm/page.tsx
 * @description 박스별출하 - 출하지시 기준으로 박스를 스캔하여 박스 단위로 출하 확정
 *
 * 워크플로우:
 * 1. 좌측에서 미출하 출하지시(CONFIRMED, 잔여>0)를 선택한다.
 * 2. 중앙에 라인 진행률과 출하가능 박스(CLOSED+OQC PASS+팔레트 미적재)가 표시된다.
 * 3. "박스출하 스캔" → BoxScanShipModal에서 박스 바코드를 스캔해 박스 단위로 즉시 출하한다.
 *
 * 팔레트 출하는 별도 화면(/shipping/pallet, /shipping/pallet-ship)을 사용한다.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Truck, RefreshCw, Package, ScanLine, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { BoxScanShipModal } from "@/components/shipping";
import api from "@/services/api";
import { createShipConfirmGridColumns, type CandidateBox } from "./shipConfirmColumns";

interface ShipOrderLineSummary {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
}
interface ShipOrderSummary {
  shipOrderNo: string;
  customerName?: string | null;
  shipDate?: string | null;
  dueDate?: string | null;
  status: string;
  items: ShipOrderLineSummary[];
}
interface OrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
  remainingQty: number;
}
interface FulfillmentData {
  order: { shipOrderNo: string; customerName?: string | null; shipDate?: string | null; dueDate?: string | null };
  lines: OrderLine[];
  candidateBoxes: CandidateBox[];
}
interface BoxSerial {
  seq: number;
  fgBarcode: string;
  itemCode: string;
  itemName?: string | null;
  status?: string | null;
  inspectPassYn?: string | null;
  issuedAt?: string | null;
  receivedAt?: string | null;
}

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function BoxShipPage() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<ShipOrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentData | null>(null);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [selectedBox, setSelectedBox] = useState<CandidateBox | null>(null);
  const [serials, setSerials] = useState<BoxSerial[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [pageError, setPageError] = useState("");

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await api.get("/shipping/orders", { params: { status: "CONFIRMED", limit: "200" } });
      const list: ShipOrderSummary[] = res.data?.data ?? [];
      const unshipped = list.filter((o) => o.items?.some((it) => it.orderQty > it.shippedQty));
      setOrders(unshipped);
      setSelectedOrderNo((cur) => (cur && unshipped.some((o) => o.shipOrderNo === cur) ? cur : null));
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.confirm.loadOrdersFailed", "출하지시 목록을 불러오지 못했습니다.")));
    } finally {
      setOrdersLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchFulfillment = useCallback(async (orderNo: string) => {
    setFulfillmentLoading(true);
    setFulfillment(null);
    setSelectedBox(null);
    setSerials([]);
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(orderNo)}/fulfillment`);
      setFulfillment(res.data?.data ?? null);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.confirm.loadFulfillmentFailed", "출하정보를 불러오지 못했습니다.")));
    } finally {
      setFulfillmentLoading(false);
    }
  }, [t]);

  const selectOrder = useCallback((orderNo: string) => {
    setSelectedOrderNo(orderNo);
    fetchFulfillment(orderNo);
  }, [fetchFulfillment]);

  const fetchSerials = useCallback(async (box: CandidateBox) => {
    setSelectedBox(box);
    setSerialsLoading(true);
    setSerials([]);
    try {
      const res = await api.get(`/shipping/box-stock/${encodeURIComponent(box.boxNo)}/serials`);
      setSerials(res.data?.data ?? []);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.confirm.loadSerialsFailed", "박스 시리얼을 불러오지 못했습니다.")));
    } finally {
      setSerialsLoading(false);
    }
  }, [t]);

  const handleShipped = useCallback(() => {
    fetchOrders();
    if (selectedOrderNo) fetchFulfillment(selectedOrderNo);
  }, [fetchOrders, fetchFulfillment, selectedOrderNo]);

  const candidateColumns = useMemo(() => createShipConfirmGridColumns({ t }), [t]);

  const candidateBoxes = fulfillment?.candidateBoxes ?? [];
  const lines = fulfillment?.lines ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Truck className="w-7 h-7 text-primary" />{t("shipping.confirm.title", "박스별출하")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.confirm.description", "출하지시 기준으로 박스를 스캔하여 박스 단위로 출하합니다.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleShipped}>
            <RefreshCw className={`w-4 h-4 mr-1 ${ordersLoading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" disabled={!selectedOrderNo} onClick={() => setScanOpen(true)}>
            <ScanLine className="w-4 h-4 mr-1" />{t("shipping.confirm.boxScanShip", "박스출하 스캔")}
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
              <h2 className="text-sm font-semibold text-text">{t("shipping.confirm.shipOrderList", "출하지시 목록")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{ordersLoading ? t("common.loading", "로딩 중...") : `${orders.length}`}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {orders.length === 0 && !ordersLoading ? (
                <div className="text-center py-8 text-text-muted text-sm">{t("shipping.confirm.noUnshippedOrders", "미출하 출하지시가 없습니다.")}</div>
              ) : (
                <div className="space-y-1">
                  {orders.map((o) => {
                    const remaining = o.items.reduce((s, it) => s + Math.max(0, it.orderQty - it.shippedQty), 0);
                    return (
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
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-primary text-primary bg-primary/5">{o.status}</span>
                        </div>
                        {o.customerName && <p className="text-xs text-text-muted mt-0.5 truncate">{o.customerName}</p>}
                        {o.dueDate && <p className="text-xs text-text-muted mt-0.5">{String(o.dueDate).slice(0, 10)}</p>}
                        <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                          <Package className="w-3 h-3" />{t("shipping.confirm.qty", "수량")} {remaining.toLocaleString()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* center: line progress + candidate boxes */}
        <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3 flex flex-col gap-3">
          <div className="flex-shrink-0">
            <h2 className="text-sm font-semibold text-text">{t("shipping.confirm.candidateBoxes", "출하가능 박스")}</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {!selectedOrderNo ? t("shipping.confirm.selectOrder", "출하지시를 선택하세요") : fulfillmentLoading ? t("common.loading", "로딩 중...") : `${candidateBoxes.length}`}
            </p>
          </div>

          {/* line progress */}
          {selectedOrderNo && lines.length > 0 && (
            <div className="flex-shrink-0 rounded-lg border border-border p-2 space-y-1">
              <p className="text-xs font-semibold text-text-muted">{t("shipping.confirm.lineProgress", "품목 진행")}</p>
              {lines.map((l) => (
                <div key={l.itemCode} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-text truncate">{l.itemCode}{l.itemName ? ` (${l.itemName})` : ""}</span>
                  <span className={l.remainingQty === 0 ? "text-text-muted" : "text-primary font-medium"}>
                    {l.shippedQty.toLocaleString()} / {l.orderQty.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!selectedOrderNo ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <Package className="w-12 h-12 opacity-50" />
            </div>
          ) : fulfillmentLoading ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">{t("common.loading", "로딩 중...")}</div>
          ) : candidateBoxes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">{t("shipping.confirm.noCandidateBoxes", "출하가능한 박스가 없습니다.")}</div>
          ) : (
            <div className="flex-1 min-h-0">
              <DataGrid
                data={candidateBoxes}
                columns={candidateColumns}
                enableColumnFilter
                enableExport
                exportFileName={`박스출하_${selectedOrderNo}`}
                onRowClick={(row) => fetchSerials(row)}
              />
            </div>
          )}
        </CardContent></Card>

        {/* right: selected box serials */}
        <Card padding="none">
          <CardContent className="p-3 h-full flex flex-col min-h-0">
            <div className="mb-2 flex-shrink-0">
              <h2 className="text-sm font-semibold text-text">{t("shipping.confirm.boxDetail", "박스 상세")}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{selectedBox ? `${selectedBox.boxNo} · ${selectedBox.qty.toLocaleString()}` : ""}</p>
            </div>
            {!selectedBox ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                <Package className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm text-center">{t("shipping.confirm.selectBox", "박스를 선택하면 시리얼을 확인할 수 있습니다.")}</p>
              </div>
            ) : serialsLoading ? (
              <div className="flex-1 flex items-center justify-center text-text-muted">{t("common.loading", "로딩 중...")}</div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                {serials.map((s) => (
                  <div key={s.fgBarcode} className="flex items-center justify-between p-2 bg-background rounded text-sm">
                    <span className="font-mono text-xs text-text truncate">{s.fgBarcode}</span>
                    <span className="text-xs text-text-muted shrink-0">{s.status ?? "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* box scan ship modal (reused) */}
      <BoxScanShipModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onShipped={handleShipped}
        initialShipOrderNo={selectedOrderNo ?? undefined}
      />
    </div>
  );
}
