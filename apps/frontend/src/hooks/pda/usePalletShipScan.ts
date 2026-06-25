/**
 * @file src/hooks/pda/usePalletShipScan.ts
 * @description PDA 팔레트 출하 워크플로우 훅
 *
 * 흐름: SCAN_ORDER(출하지시,CONFIRMED) → SCAN_WORKER(작업자 QR)
 *      → BUILD_PALLET(팔레트 생성/이어서 + 박스 스캔 적재 + 마감)
 * 지시별 상태는 GET /shipping/orders/:no/fulfillment 단일 응답으로 동기화.
 * 비즈니스 검증은 모두 서버(데스크톱과 동일 엔드포인트)에서 수행.
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type {
  PalletShipPhase,
  PalletShipOrderData,
  PalletShipOrderLine,
  PalletWorkerInfo,
  CurrentPallet,
  PalletLoadedBox,
  PalletShipHistoryItem,
  UsePalletShipScanReturn,
} from "./usePalletShipScan.types";

export type {
  PalletShipPhase,
  PalletShipOrderData,
  PalletShipHistoryItem,
} from "./usePalletShipScan.types";

interface FulfillmentBox {
  boxNo: string;
  itemCode: string;
  qty: number;
}
interface FulfillmentPallet {
  palletNo: string;
  status: string;
  boxCount?: number;
  totalQty?: number;
  boxes?: FulfillmentBox[];
}
interface FulfillmentResponse {
  order: { shipOrderNo: string; customerName?: string; status: string };
  lines: PalletShipOrderLine[];
  candidateBoxes: FulfillmentBox[];
  pallets: FulfillmentPallet[];
}

const extractErrMsg = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** fulfillment 응답에서 진행 중(미출하) 팔레트 1개 선택 */
function pickActivePallet(pallets: FulfillmentPallet[]): CurrentPallet | null {
  const active = pallets.find((p) => p.status === "OPEN" || p.status === "CLOSED");
  if (!active) return null;
  const boxes: PalletLoadedBox[] = (active.boxes ?? []).map((b) => ({
    boxNo: b.boxNo,
    itemCode: b.itemCode,
    qty: b.qty,
  }));
  return {
    palletNo: active.palletNo,
    status: active.status,
    boxes,
    boxCount: boxes.length,
    totalQty: boxes.reduce((s, b) => s + b.qty, 0),
  };
}

export function usePalletShipScan(): UsePalletShipScanReturn {
  const [phase, setPhase] = useState<PalletShipPhase>("SCAN_ORDER");
  const [order, setOrder] = useState<PalletShipOrderData | null>(null);
  const [worker, setWorker] = useState<PalletWorkerInfo | null>(null);
  const [pallet, setPallet] = useState<CurrentPallet | null>(null);
  const [candidateBoxNos, setCandidateBoxNos] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PalletShipHistoryItem[]>([]);

  /** fulfillment 조회 → order/pallet/candidate 동기화. 반환: 응답 데이터 */
  const refresh = useCallback(async (shipOrderNo: string): Promise<FulfillmentResponse | null> => {
    const { data } = await api.get(`/shipping/orders/${encodeURIComponent(shipOrderNo)}/fulfillment`);
    const f = (data?.data ?? null) as FulfillmentResponse | null;
    if (!f) return null;
    const orderQty = f.lines.reduce((s, l) => s + l.orderQty, 0);
    const shippedQty = f.lines.reduce((s, l) => s + l.shippedQty, 0);
    setOrder({
      shipOrderNo: f.order.shipOrderNo,
      customerName: f.order.customerName,
      status: f.order.status,
      lines: f.lines,
      orderQty,
      shippedQty,
    });
    setPallet(pickActivePallet(f.pallets));
    setCandidateBoxNos(new Set(f.candidateBoxes.map((b) => b.boxNo)));
    return f;
  }, []);

  // ── Phase 1: 출하지시 스캔 ───────────────────────────
  const handleScanOrder = useCallback(async (barcode: string): Promise<void> => {
    const code = barcode.trim();
    if (!code) return;
    setIsScanning(true);
    setError(null);
    try {
      const f = await refresh(code);
      if (!f) {
        setError("ORDER_NOT_FOUND");
        return;
      }
      if (f.order.status !== "CONFIRMED") {
        setError("NOT_CONFIRMED");
        setOrder(null);
        setPallet(null);
        return;
      }
      setPhase("SCAN_WORKER");
    } catch (err) {
      setError(extractErrMsg(err, "ORDER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, [refresh]);

  // ── Phase 2: 작업자 스캔 ─────────────────────────────
  const handleScanWorker = useCallback(async (qr: string): Promise<void> => {
    if (!qr.trim()) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data } = await api.get(`/master/workers/by-qr/${encodeURIComponent(qr.trim())}`);
      const w = (data?.data ?? data) as { workerCode?: string; workerName?: string };
      if (!w?.workerCode) {
        setError("WORKER_NOT_FOUND");
        return;
      }
      setWorker({ workerCode: w.workerCode, workerName: w.workerName });
      setPhase("BUILD_PALLET");
    } catch (err) {
      setError(extractErrMsg(err, "WORKER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ── Phase 3: 팔레트 생성 ─────────────────────────────
  const handleCreatePallet = useCallback(async (): Promise<void> => {
    if (!order) return;
    setIsBusy(true);
    setError(null);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets`, {});
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "PALLET_CREATE_FAILED"));
    } finally {
      setIsBusy(false);
    }
  }, [order, refresh]);

  // ── Phase 3: 박스 스캔 적재 ──────────────────────────
  const handleScanBox = useCallback(async (barcode: string): Promise<void> => {
    const boxNo = barcode.trim();
    if (!boxNo || !order || !pallet) return;
    if (pallet.status !== "OPEN") {
      setError("PALLET_NOT_OPEN");
      return;
    }
    if (pallet.boxes.some((b) => b.boxNo === boxNo)) {
      setError("DUPLICATE");
      return;
    }
    if (!candidateBoxNos.has(boxNo)) {
      setError("BOX_NOT_LOADABLE");
      return;
    }
    setIsScanning(true);
    setError(null);
    try {
      await api.post(
        `/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets/${encodeURIComponent(pallet.palletNo)}/boxes`,
        { boxIds: [boxNo] },
      );
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "BOX_ADD_FAILED"));
    } finally {
      setIsScanning(false);
    }
  }, [order, pallet, candidateBoxNos, refresh]);

  // ── Phase 3: 박스 제거 ───────────────────────────────
  const handleRemoveBox = useCallback(async (boxNo: string): Promise<void> => {
    if (!order || !pallet) return;
    setIsBusy(true);
    setError(null);
    try {
      await api.delete(
        `/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets/${encodeURIComponent(pallet.palletNo)}/boxes`,
        { data: { boxIds: [boxNo] } },
      );
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "BOX_REMOVE_FAILED"));
    } finally {
      setIsBusy(false);
    }
  }, [order, pallet, refresh]);

  // ── Phase 3: 팔레트 마감 ─────────────────────────────
  const handleClosePallet = useCallback(async (): Promise<void> => {
    if (!order || !pallet) return;
    if (pallet.boxes.length === 0) {
      setError("EMPTY_PALLET");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await api.post(
        `/shipping/orders/${encodeURIComponent(order.shipOrderNo)}/pallets/${encodeURIComponent(pallet.palletNo)}/close`,
      );
      setHistory((prev) => [
        {
          shipOrderNo: order.shipOrderNo,
          palletNo: pallet.palletNo,
          boxCount: pallet.boxCount,
          totalQty: pallet.totalQty,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      await refresh(order.shipOrderNo);
    } catch (err) {
      setError(extractErrMsg(err, "CLOSE_FAILED"));
    } finally {
      setIsBusy(false);
    }
  }, [order, pallet, refresh]);

  const handleReset = useCallback(() => {
    setPhase("SCAN_ORDER");
    setOrder(null);
    setWorker(null);
    setPallet(null);
    setCandidateBoxNos(new Set());
    setError(null);
  }, []);

  return {
    phase, order, worker, pallet,
    candidateCount: candidateBoxNos.size,
    isScanning, isBusy, error, history,
    handleScanOrder, handleScanWorker, handleCreatePallet,
    handleScanBox, handleRemoveBox, handleClosePallet, handleReset,
  };
}
