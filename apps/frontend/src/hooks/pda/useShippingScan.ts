/**
 * @file src/hooks/pda/useShippingScan.ts
 * @description 출하등록 3-Phase 스캔 워크플로우 훅
 *
 * 초보자 가이드:
 * Phase 1 (SCAN_SHIPMENT_ORDER): 출하지시 바코드 → GET /shipping/orders/:code (status CONFIRMED만 허용)
 * Phase 2 (SCAN_WORKER): 작업자 QR → GET /master/workers/by-qr/:qr → Phase 3 전환
 * Phase 3 (SCAN_PRODUCT): 박스/팔레트 반복 스캔 — 박스 1건마다 즉시 출하 처리
 *   - PLT- 접두사: GET /shipping/pallets/barcode/:barcode/boxes → 하위 박스 일괄 처리
 *   - 박스마다 POST /shipping/orders/:shipOrderNo/ship-box { boxNo, workerId? }
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
  PalletBoxesResponse,
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

/** PLT- 접두사로 팔레트 여부 판단 */
const isPalletBarcode = (barcode: string) =>
  barcode.toUpperCase().startsWith("PLT-");

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
      const { data } = await api.get<WorkerQrResponse>(
        `/master/workers/by-qr/${encodeURIComponent(qr.trim())}`,
      );
      setWorker({ id: data.id, workerNo: data.workerNo, workerName: data.workerName });
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
        // 팔레트면 하위 박스 목록으로 확장, 아니면 박스 1건
        let boxes: Array<{ boxNo: string; fromPallet?: string }> = [];
        if (isPalletBarcode(code)) {
          const { data } = await api.get<PalletBoxesResponse>(
            `/shipping/pallets/barcode/${encodeURIComponent(code)}/boxes`,
          );
          boxes = (data.boxes ?? []).map((b) => ({
            boxNo: b.boxNo,
            fromPallet: data.palletNo,
          }));
        } else {
          boxes = [{ boxNo: code }];
        }

        // 박스마다 즉시 출하 처리
        for (const box of boxes) {
          if (scannedItems.some((i) => i.boxNo === box.boxNo)) {
            setError("DUPLICATE");
            continue;
          }
          const res = await api.post(
            `/shipping/orders/${encodeURIComponent(scannedOrder.shipOrderNo)}/ship-box`,
            {
              boxNo: box.boxNo,
              workerId: worker?.id != null ? String(worker.id) : undefined,
            },
          );
          const d = res.data?.data;
          if (!d) {
            setError("SHIP_FAILED");
            continue;
          }
          setScannedItems((prev) => [
            { boxNo: box.boxNo, itemCode: d.itemCode, qty: d.qty, fromPallet: box.fromPallet },
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
        }
      } catch (err) {
        setError(extractErrMsg(err, "SHIP_FAILED"));
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
    handleConfirmShip, handleReset,
  };
}
