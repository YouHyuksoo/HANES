/**
 * @file src/hooks/pda/usePalletShipByScan.ts
 * @description PDA 팔레트 출하 — 마감된 팔레트를 스캔해 출하지시 단위로 출하
 *   (팔레트 구성은 /pda/shipping-pallet, 본 훅은 스캔→출하 전용)
 *
 * SCAN_PALLET(마감 팔레트) → SCAN_WORKER(작업자 QR) → READY([출하])
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

export type PalletShipByScanPhase = "SCAN_PALLET" | "SCAN_WORKER" | "READY";

export interface ShipPalletInfo {
  palletNo: string;
  status: string;
  shipOrderNo: string;
  boxCount: number;
  totalQty: number;
}
export interface ShipWorker {
  workerCode: string;
  workerName?: string;
}
export interface PalletShipScanHistory {
  palletNo: string;
  shipOrderNo: string;
  timestamp: string;
}

const extractErrMsg = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

export function usePalletShipByScan() {
  const [phase, setPhase] = useState<PalletShipByScanPhase>("SCAN_PALLET");
  const [pallet, setPallet] = useState<ShipPalletInfo | null>(null);
  const [worker, setWorker] = useState<ShipWorker | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PalletShipScanHistory[]>([]);

  const handleScanPallet = useCallback(async (barcode: string): Promise<void> => {
    const no = barcode.trim();
    if (!no) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data } = await api.get(`/shipping/pallets/pallet-no/${encodeURIComponent(no)}`);
      const p = data?.data as
        | { palletNo: string; status: string; shipOrderNo?: string | null; boxCount?: number; totalQty?: number }
        | null;
      if (!p) {
        setError("PALLET_NOT_FOUND");
        return;
      }
      if (p.status !== "CLOSED") {
        setError("NOT_CLOSED");
        return;
      }
      if (!p.shipOrderNo) {
        setError("NO_ORDER");
        return;
      }
      setPallet({
        palletNo: p.palletNo,
        status: p.status,
        shipOrderNo: p.shipOrderNo,
        boxCount: p.boxCount ?? 0,
        totalQty: p.totalQty ?? 0,
      });
      setPhase("SCAN_WORKER");
    } catch (err) {
      setError(extractErrMsg(err, "PALLET_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, []);

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
      setPhase("READY");
    } catch (err) {
      setError(extractErrMsg(err, "WORKER_NOT_FOUND"));
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleShip = useCallback(async (): Promise<boolean> => {
    if (!pallet) return false;
    setIsBusy(true);
    setError(null);
    try {
      await api.post(`/shipping/orders/${encodeURIComponent(pallet.shipOrderNo)}/ship-pallets`, {
        palletNos: [pallet.palletNo],
        workerId: worker?.workerCode || undefined,
      });
      setHistory((prev) => [
        { palletNo: pallet.palletNo, shipOrderNo: pallet.shipOrderNo, timestamp: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      setPhase("SCAN_PALLET");
      setPallet(null);
      setWorker(null);
      return true;
    } catch (err) {
      setError(extractErrMsg(err, "SHIP_FAILED"));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [pallet, worker]);

  const handleReset = useCallback(() => {
    setPhase("SCAN_PALLET");
    setPallet(null);
    setWorker(null);
    setError(null);
  }, []);

  return {
    phase, pallet, worker, isScanning, isBusy, error, history,
    handleScanPallet, handleScanWorker, handleShip, handleReset,
  };
}
