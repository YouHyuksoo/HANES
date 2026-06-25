/**
 * @file src/hooks/pda/useShippingScan.ts
 * @description 출하등록 3-Phase 스캔 워크플로우 훅
 *
 * 초보자 가이드:
 * Phase 1 (SCAN_SHIPMENT_ORDER): 출하지시 바코드 → GET /shipping/orders/:code (status CONFIRMED만 허용)
 * Phase 2 (SCAN_WORKER): 작업자 QR → GET /master/workers/by-qr/:qr → Phase 3 전환
 * Phase 3 (SCAN_PRODUCT): 박스 반복 스캔 — 박스 1건마다 즉시 출하 처리
 *   - 박스마다 POST /shipping/orders/:shipOrderNo/ship-box { boxNo, workerId? } (웹과 동일 계약)
 *   - 취소는 POST /shipping/orders/:shipOrderNo/cancel-ship-box { boxNo, workerId? } (웹과 동일 계약)
 *   - 팔레트 바코드(PLT 접두사): 차단(PALLET_NOT_SUPPORTED) — 백엔드 shipBox()가
 *     팔레트 적재 박스를 이중 차감 방지로 거부하므로, 팔레트 단위 출하는
 *     PDA 팔레트 출하 화면(/pda/pallet-ship)을 사용해야 한다.
 *   - 중복(DUPLICATE) → 차단, 서버 검증 실패(SHIP_FAILED)
 * 출하확인: 스캔 단위로 즉시 출하되므로 배치 확인 없음 (handleConfirmShip은 호환용 no-op)
 *
 * 타입은 useShippingScan.types.ts 참조
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type {
  ShippingPhase,
  ShipOrderData,
  ShipOrderLine,
  ScannedShipItem,
  WorkerInfo,
  ShipHistoryItem,
  WorkerQrResponse,
  UseShippingScanReturn,
} from "./useShippingScan.types";

export type {
  ShippingPhase,
  ShipOrderData,
  ShipOrderLine,
  ScannedShipItem,
  WorkerInfo,
  ShipHistoryItem,
} from "./useShippingScan.types";

// ── 내부 헬퍼 ─────────────────────────────────────────

/** PLT 접두사로 팔레트 여부 판단 (PLT-, PLT2606... 등 변형 포함) */
const isPalletBarcode = (barcode: string) =>
  barcode.toUpperCase().startsWith("PLT");

/** API 에러 메시지 추출 */
const extractErrMsg = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

// ── 훅 구현 ───────────────────────────────────────────

/**
 * 출하등록 3-Phase 스캔 훅
 *
 * SCAN_SHIPMENT_ORDER → SCAN_WORKER → SCAN_PRODUCT → 출하확인 → 리셋
 */
export function useShippingScan(): UseShippingScanReturn {
  const [phase, setPhase] = useState<ShippingPhase>("SCAN_SHIPMENT_ORDER");
  const [scannedOrder, setScannedOrder] = useState<ShipOrderData | null>(null);
  const [worker, setWorker] = useState<WorkerInfo | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedShipItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ShipHistoryItem[]>([]);

  const scannedQty = scannedOrder?.shippedQty ?? 0;
  const orderQty = scannedOrder?.orderQty ?? 0;
  const progress = orderQty > 0 ? Math.min(scannedQty / orderQty, 1) : 0;

  // ── Phase 1 ───────────────────────────────────────────

  const handleScanShipOrder = useCallback(async (barcode: string): Promise<void> => {
    const code = barcode.trim();
    if (!code) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/shipping/orders/${encodeURIComponent(code)}`,
      );
      const o = data?.data;
      if (!o) {
        setError("ORDER_NOT_FOUND");
        return;
      }
      if (o.status !== "CONFIRMED") {
        setError("NOT_CONFIRMED");
        return;
      }
      const items: ShipOrderLine[] = (o.items ?? []).map(
        (it: {
          itemCode: string;
          itemName?: string;
          orderQty: number;
          shippedQty?: number;
        }) => ({
          itemCode: it.itemCode,
          itemName: it.itemName,
          orderQty: it.orderQty,
          shippedQty: it.shippedQty ?? 0,
        }),
      );
      const orderQty = items.reduce((s, it) => s + it.orderQty, 0);
      const shippedQty = items.reduce((s, it) => s + it.shippedQty, 0);
      setScannedOrder({
        shipOrderNo: o.shipOrderNo,
        customerName: o.customerName,
        status: o.status,
        items,
        orderQty,
        shippedQty,
      });
      setPhase("SCAN_WORKER");
    } catch (err) {
      setError(extractErrMsg(err, "ORDER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ── Phase 2 ───────────────────────────────────────────

  const handleScanWorker = useCallback(async (qr: string): Promise<void> => {
    if (!qr.trim()) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/master/workers/by-qr/${encodeURIComponent(qr.trim())}`,
      );
      const w = (data?.data ?? data) as WorkerQrResponse;
      if (!w?.workerCode) {
        setError("WORKER_NOT_FOUND");
        return;
      }
      setWorker({ workerCode: w.workerCode, workerName: w.workerName });
      setPhase("SCAN_PRODUCT");
    } catch (err) {
      setError(extractErrMsg(err, "WORKER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ── Phase 3 ───────────────────────────────────────────

  const handleScanProduct = useCallback(
    async (barcode: string): Promise<void> => {
      const code = barcode.trim();
      if (!code || !scannedOrder) return;
      setIsScanning(true);
      setError(null);
      try {
        // 팔레트 적재 박스는 ship-box가 이중 차감을 막기 위해 거부한다.
        // 팔레트는 별도 PDA 팔레트 출하 화면에서 ship-pallets 계약으로 처리한다.
        if (isPalletBarcode(code)) {
          setError("PALLET_NOT_SUPPORTED");
          return;
        }

        const boxNo = code;
        if (scannedItems.some((i) => i.boxNo === boxNo)) {
          setError("DUPLICATE");
          return;
        }

        // 박스 즉시 출하 처리 (웹과 동일 계약: POST /shipping/orders/:id/ship-box)
        const res = await api.post(
          `/shipping/orders/${encodeURIComponent(scannedOrder.shipOrderNo)}/ship-box`,
          {
            boxNo,
            workerId: worker?.workerCode || undefined,
          },
        );
        const d = res.data?.data;
        if (!d) {
          setError("SHIP_FAILED");
          return;
        }
        setScannedItems((prev) => [
          { boxNo, itemCode: d.itemCode, qty: d.qty },
          ...prev,
        ]);
        setScannedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: d.orderStatus,
                items: prev.items.map((it) =>
                  it.itemCode === d.itemCode
                    ? { ...it, shippedQty: d.lineShippedQty }
                    : it,
                ),
                shippedQty: prev.shippedQty + d.qty,
              }
            : prev,
        );
      } catch (err) {
        setError(extractErrMsg(err, "SHIP_FAILED"));
      } finally {
        setIsScanning(false);
      }
    },
    [scannedOrder, scannedItems, worker],
  );

  const handleCancelBox = useCallback(
    async (boxNo: string): Promise<void> => {
      if (!boxNo || !scannedOrder) return;
      const item = scannedItems.find((i) => i.boxNo === boxNo);
      if (!item) return;
      setIsScanning(true);
      setError(null);
      try {
        const res = await api.post(
          `/shipping/orders/${encodeURIComponent(scannedOrder.shipOrderNo)}/cancel-ship-box`,
          {
            boxNo,
            workerId: worker?.workerCode || undefined,
          },
        );
        const d = res.data?.data;
        setScannedItems((prev) => prev.filter((i) => i.boxNo !== boxNo));
        setScannedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: d?.orderStatus ?? prev.status,
                items: prev.items.map((it) =>
                  it.itemCode === item.itemCode
                    ? { ...it, shippedQty: d?.lineShippedQty ?? Math.max(0, it.shippedQty - item.qty) }
                    : it,
                ),
                shippedQty: Math.max(0, prev.shippedQty - item.qty),
              }
            : prev,
        );
      } catch (err) {
        setError(extractErrMsg(err, "CANCEL_FAILED"));
      } finally {
        setIsScanning(false);
      }
    },
    [scannedOrder, scannedItems, worker],
  );

  // ── 출하 확인 ─────────────────────────────────────────

  // 박스 스캔 시점에 즉시 출하되므로 배치 확인은 더 이상 필요 없다.
  // 호환성을 위해 시그니처는 유지하되, 출하지시를 이력에 기록하고 초기화만 수행한다.
  const handleConfirmShip = useCallback(async (): Promise<boolean> => {
    if (!scannedOrder || scannedItems.length === 0) return true;
    setHistory((prev) => [
      {
        shipOrderNo: scannedOrder.shipOrderNo,
        customerName: scannedOrder.customerName,
        itemCode: scannedOrder.items[0]?.itemCode ?? "-",
        scannedQty: scannedOrder.shippedQty,
        workerName: worker?.workerName ?? "-",
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
    setPhase("SCAN_SHIPMENT_ORDER");
    setScannedOrder(null);
    setWorker(null);
    setScannedItems([]);
    return true;
  }, [scannedOrder, scannedItems, worker]);

  // ── 초기화 ────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPhase("SCAN_SHIPMENT_ORDER");
    setScannedOrder(null);
    setWorker(null);
    setScannedItems([]);
    setError(null);
  }, []);

  return {
    phase, scannedOrder, worker, scannedItems, scannedQty, progress,
    isScanning, isConfirming, error, history,
    handleScanShipOrder, handleScanWorker, handleScanProduct,
    handleCancelBox, handleConfirmShip, handleReset,
  };
}
