"use client";

/**
 * @file src/app/(authenticated)/shipping/return/page.tsx
 * @description 출하취소 - 출하지시 단위로 출하분(박스+팔레트)을 조회하고 출하를 취소
 *
 * 워크플로우:
 * 1. 좌측에서 출하분이 있는 출하지시(통합 이력) 선택. (출하이력 ↔ 취소이력 토글)
 * 2. 우측에 팔레트(+박스) / 박스출하(팔레트번호 '*') 상세 표시.
 * 3. "출하취소" → 사유 입력 후 선택 지시의 모든 출하분을 단일 트랜잭션으로 취소(재고복원).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Undo2, RefreshCw, Package, AlertTriangle, XCircle, Boxes, Layers } from "lucide-react";
import { Card, CardContent, Button, Modal, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";
import {
  createShipReturnHistoryGridColumns,
  createShipReturnOrderGridColumns,
} from "./shipReturnColumns";
import type { ReturnRow, ShippedDetail, ShippedOrder, ShipType } from "./types";

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function ShipCancelPage() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  const [view, setView] = useState<"history" | "cancel">("history");
  const [orders, setOrders] = useState<ShippedOrder[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShippedDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setPageError("");
    setSuccessMsg("");
    try {
      const res = await api.get("/shipping/orders/shipped");
      setOrders(res.data?.data ?? []);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.loadHistoryFailed", "출하이력을 불러오지 못했습니다.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setPageError("");
    setSuccessMsg("");
    try {
      const res = await api.get("/shipping/returns", { params: { limit: "5000" } });
      setReturns(res.data?.data ?? []);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.loadHistoryFailed", "출하이력을 불러오지 못했습니다.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (view === "history") fetchOrders();
    else fetchReturns();
  }, [view, fetchOrders, fetchReturns]);

  const fetchDetail = useCallback(async (orderNo: string) => {
    setSelectedOrderNo(orderNo);
    setDetailLoading(true);
    setDetail(null);
    setPageError("");
    setSuccessMsg("");
    try {
      const res = await api.get(`/shipping/orders/${encodeURIComponent(orderNo)}/shipped-detail`);
      setDetail(res.data?.data ?? null);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.loadDetailFailed", "출하 상세를 불러오지 못했습니다.")));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.shipOrderNo === selectedOrderNo) ?? null,
    [orders, selectedOrderNo],
  );

  const doCancel = useCallback(async () => {
    if (!selectedOrderNo || !cancelReason.trim()) return;
    setCanceling(true);
    setPageError("");
    try {
      const res = await api.post(`/shipping/orders/${encodeURIComponent(selectedOrderNo)}/cancel-shipment`, {
        reason: cancelReason.trim(),
        workerId: userId,
      });
      const d = res.data?.data;
      setCancelOpen(false);
      setCancelReason("");
      setSelectedOrderNo(null);
      setDetail(null);
      fetchOrders();
      setSuccessMsg(`${t("shipping.return.cancelSuccess", "출하가 취소되었습니다.")} (${d?.returnNo ?? ""} · ${(d?.restoredQty ?? 0).toLocaleString()})`);
    } catch (e: unknown) {
      setPageError(errMsg(e, t("shipping.return.cancelFailed", "출하취소에 실패했습니다.")));
    } finally {
      setCanceling(false);
    }
  }, [selectedOrderNo, cancelReason, userId, fetchOrders, t]);

  const typeLabel = useCallback((tp: ShipType) =>
    tp === "MIXED" ? t("shipping.return.typeMixed", "혼합")
    : tp === "PALLET" ? t("shipping.return.typePallet", "팔레트")
    : t("shipping.return.typeBox", "박스"), [t]);

  const orderColumns = useMemo(() => createShipReturnOrderGridColumns(t, typeLabel), [t, typeLabel]);

  const returnColumns = useMemo(() => createShipReturnHistoryGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Undo2 className="w-7 h-7 text-primary" />{t("shipping.return.title", "출하취소")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.return.subtitle", "출하지시 단위로 출하분을 조회하고 출하를 취소합니다.")}</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => setView("history")} className={`px-3 py-1.5 text-sm ${view === "history" ? "bg-primary text-white" : "text-text-muted hover:bg-surface"}`}>{t("shipping.return.shipHistory", "출하이력")}</button>
            <button type="button" onClick={() => setView("cancel")} className={`px-3 py-1.5 text-sm ${view === "cancel" ? "bg-primary text-white" : "text-text-muted hover:bg-surface"}`}>{t("shipping.return.cancelHistory", "취소이력")}</button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => (view === "history" ? fetchOrders() : fetchReturns())}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /><span className="flex-1">{pageError}</span>
          <button onClick={() => setPageError("")}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary text-primary text-sm flex-shrink-0">
          <Undo2 className="w-4 h-4 shrink-0" /><span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg("")}><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {view === "cancel" ? (
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={returns} columns={returnColumns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("shipping.return.cancelHistory", "취소이력")} />
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1 min-h-0 overflow-hidden">
          {/* left: shipped orders */}
          <Card className="min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3 flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text flex-shrink-0">{t("shipping.return.shipHistory", "출하이력")} <span className="text-text-muted font-normal">({orders.length})</span></h2>
            <div className="flex-1 min-h-0">
              <DataGrid data={orders} columns={orderColumns} isLoading={loading} enableColumnFilter enableExport
                exportFileName={t("shipping.return.shipHistory", "출하이력")}
                emptyMessage={t("shipping.return.noShippedOrders", "출하분이 있는 출하지시가 없습니다.")}
                selectedRowId={selectedOrderNo ?? undefined}
                getRowId={(row) => row.shipOrderNo}
                onRowClick={(row) => fetchDetail(row.shipOrderNo)} />
            </div>
          </CardContent></Card>

          {/* right: detail + cancel */}
          <Card padding="none"><CardContent className="p-3 h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-text">{t("shipping.return.shipDetail", "출하 상세")}</h2>
                <p className="text-xs text-text-muted mt-0.5">{selectedOrderNo ?? t("shipping.return.selectOrder", "출하지시를 선택하세요")}</p>
              </div>
              <Button size="sm" variant="danger"
                disabled={!detail || detailLoading || !!selectedOrder?.hasErpSynced}
                onClick={() => { setCancelReason(""); setCancelOpen(true); }}>
                <Undo2 className="w-4 h-4 mr-1" />{t("shipping.return.cancelShip", "출하취소")}
              </Button>
            </div>
            {selectedOrder?.hasErpSynced && (
              <div className="mb-2 px-2 py-1 rounded border border-amber-500 text-amber-600 text-xs flex-shrink-0">{t("shipping.return.erpBlocked", "ERP 연동이 완료된 출하가 포함되어 취소할 수 없습니다.")}</div>
            )}
            {!selectedOrderNo ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted"><Package className="w-12 h-12 mb-2 opacity-50" /><p className="text-sm">{t("shipping.return.selectOrder", "출하지시를 선택하세요")}</p></div>
            ) : detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-text-muted">{t("common.loading", "로딩 중...")}</div>
            ) : detail ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
                {/* pallets */}
                <div>
                  <p className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1"><Layers className="w-3.5 h-3.5" />{t("shipping.return.palletSection", "팔레트")} ({detail.pallets.length})</p>
                  {detail.pallets.length === 0 ? <p className="text-xs text-text-muted pl-1">-</p> : detail.pallets.map((p) => (
                    <div key={p.palletNo} className="p-2 bg-background rounded mb-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono font-medium">{p.palletNo}</span>
                        <span className="text-xs text-text-muted">{p.boxCount.toLocaleString()}box · {p.totalQty.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* box shipments (palletNo = *) */}
                <div>
                  <p className="text-xs font-semibold text-text-muted flex items-center gap-1 mb-1"><Boxes className="w-3.5 h-3.5" />{t("shipping.return.boxShippedSection", "박스출하")} ({detail.boxShipped.length})</p>
                  {detail.boxShipped.length === 0 ? <p className="text-xs text-text-muted pl-1">-</p> : detail.boxShipped.map((b) => (
                    <div key={b.boxNo} className="flex items-center justify-between p-2 bg-background rounded mb-1 text-sm">
                      <span className="font-mono">{b.boxNo}</span>
                      <span className="text-xs text-text-muted">{t("shipping.return.palletNo", "팔레트번호")}: <span className="font-mono">{b.palletNo}</span> · {b.qty.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent></Card>
        </div>
      )}

      {/* cancel confirm modal */}
      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title={t("shipping.return.cancelShip", "출하취소")} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-400">
            {t("shipping.return.cancelConfirm", "선택한 출하지시의 모든 출하분을 취소하고 재고를 복원합니다. 진행할까요?")}
          </div>
          <Input label={t("shipping.return.cancelReason", "취소 사유")} placeholder={t("shipping.return.cancelReasonPlaceholder", "취소 사유를 입력하세요")}
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} fullWidth />
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={doCancel} disabled={!cancelReason.trim() || canceling}>
              {canceling ? t("common.processing", "처리 중...") : t("shipping.return.cancelShip", "출하취소")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
