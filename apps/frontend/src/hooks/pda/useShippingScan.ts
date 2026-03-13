/**
 * @file src/hooks/pda/useShippingScan.ts
 * @description 출하등록 3-Phase 스캔 워크플로우 훅
 *
 * 초보자 가이드:
 * Phase 1 (SCAN_SHIPMENT_ORDER): 출하지시 바코드 → GET /shipping/orders/by-barcode/:barcode
 * Phase 2 (SCAN_WORKER): 작업자 QR → GET /master/workers/by-qr/:qr → Phase 3 전환
 * Phase 3 (SCAN_PRODUCT): 박스/팔레트 반복 스캔
 *   - PLT- 접두사: GET /shipping/pallets/barcode/:barcode/boxes → 하위 박스 일괄 추가
 *   - 일반 박스: GET /shipping/boxes/box-no/:barcode → 단건 추가
 *   - 품목 불일치(WRONG_ITEM), 수량 초과(OVER_QTY), 중복(DUPLICATE) → 차단
 * 출하확인: POST /shipping/register (부분출하 허용)
 *
 * 타입은 useShippingScan.types.ts 참조
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type {
  ShippingPhase,
  ShipOrderData,
  ScannedShipItem,
  WorkerInfo,
  ShipHistoryItem,
  PalletBoxesResponse,
  BoxResponse,
  WorkerQrResponse,
  UseShippingScanReturn,
} from "./useShippingScan.types";

export type {
  ShippingPhase,
  ShipOrderData,
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

  const scannedQty = scannedItems.reduce((sum, i) => sum + i.qty, 0);
  const orderQty = scannedOrder?.orderQty ?? 0;
  const progress = orderQty > 0 ? Math.min(scannedQty / orderQty, 1) : 0;

  // ── Phase 1 ───────────────────────────────────────────

  const handleScanShipOrder = useCallback(async (barcode: string): Promise<void> => {
    if (!barcode.trim()) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data } = await api.get<ShipOrderData>(
        `/shipping/orders/by-barcode/${encodeURIComponent(barcode.trim())}`,
      );
      setScannedOrder(data);
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
      if (!barcode.trim() || !scannedOrder) return;
      setIsScanning(true);
      setError(null);
      try {
        if (isPalletBarcode(barcode)) {
          // 팔레트 → 하위 박스 일괄 추가
          const { data } = await api.get<PalletBoxesResponse>(
            `/shipping/pallets/barcode/${encodeURIComponent(barcode.trim())}/boxes`,
          );
          const newItems: ScannedShipItem[] = [];
          for (const box of data.boxes) {
            if (box.itemCode !== scannedOrder.itemCode) { setError("WRONG_ITEM"); return; }
            if (!scannedItems.some((i) => i.boxNo === box.boxNo)) {
              newItems.push({ boxNo: box.boxNo, itemCode: box.itemCode, qty: box.qty, fromPallet: data.palletNo });
            }
          }
          if (newItems.length === 0) return;
          const afterQty = scannedQty + newItems.reduce((s, i) => s + i.qty, 0);
          if (afterQty > scannedOrder.orderQty) { setError("OVER_QTY"); return; }
          setScannedItems((prev) => [...newItems, ...prev]);
        } else {
          // 일반 박스
          if (scannedItems.some((i) => i.boxNo === barcode.trim())) { setError("DUPLICATE"); return; }
          const { data: box } = await api.get<BoxResponse>(
            `/shipping/boxes/box-no/${encodeURIComponent(barcode.trim())}`,
          );
          if (box.itemCode !== scannedOrder.itemCode) { setError("WRONG_ITEM"); return; }
          if (scannedQty + box.qty > scannedOrder.orderQty) { setError("OVER_QTY"); return; }
          setScannedItems((prev) => [{ boxNo: box.boxNo, itemCode: box.itemCode, qty: box.qty }, ...prev]);
        }
      } catch (err) {
        setError(extractErrMsg(err, "SCAN_FAILED"));
      } finally {
        setIsScanning(false);
      }
    },
    [scannedOrder, scannedItems, scannedQty],
  );

  // ── 출하 확인 ─────────────────────────────────────────

  const handleConfirmShip = useCallback(async (): Promise<boolean> => {
    if (!scannedOrder || scannedItems.length === 0) return false;
    setIsConfirming(true);
    setError(null);
    try {
      await api.post("/shipping/register", {
        shipOrderId: scannedOrder.id,
        workerId: worker?.id,
        items: scannedItems.map((i) => ({ boxNo: i.boxNo, qty: i.qty })),
      });
      setHistory((prev) => [
        {
          shipOrderNo: scannedOrder.shipOrderNo,
          customerName: scannedOrder.customerName,
          itemCode: scannedOrder.itemCode,
          scannedQty,
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
    } catch (err) {
      setError(extractErrMsg(err, "CONFIRM_FAILED"));
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [scannedOrder, scannedItems, scannedQty, worker]);

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
