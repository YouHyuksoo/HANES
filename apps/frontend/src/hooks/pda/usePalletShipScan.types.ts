/**
 * @file src/hooks/pda/usePalletShipScan.types.ts
 * @description PDA 팔레트 출하 스캔 워크플로우 타입
 */

export type PalletShipPhase = "SCAN_ORDER" | "SCAN_WORKER" | "BUILD_PALLET";

export interface PalletShipOrderLine {
  itemCode: string;
  itemName?: string;
  orderQty: number;
  shippedQty: number;
  remainingQty: number;
}

export interface PalletShipOrderData {
  shipOrderNo: string;
  customerName?: string;
  status: string;
  lines: PalletShipOrderLine[];
  orderQty: number;
  shippedQty: number;
}

export interface PalletWorkerInfo {
  workerCode: string;
  workerName?: string;
}

export interface PalletLoadedBox {
  boxNo: string;
  itemCode: string;
  qty: number;
}

export interface CurrentPallet {
  palletNo: string;
  status: string; // OPEN | CLOSED | LOADED | SHIPPED
  boxes: PalletLoadedBox[];
  boxCount: number;
  totalQty: number;
}

export interface PalletShipHistoryItem {
  shipOrderNo: string;
  palletNo: string;
  boxCount: number;
  totalQty: number;
  timestamp: string;
}

export interface UsePalletShipScanReturn {
  phase: PalletShipPhase;
  order: PalletShipOrderData | null;
  worker: PalletWorkerInfo | null;
  pallet: CurrentPallet | null;
  candidateCount: number;
  isScanning: boolean;
  isBusy: boolean;
  error: string | null;
  history: PalletShipHistoryItem[];
  handleScanOrder: (barcode: string) => Promise<void>;
  handleScanWorker: (qr: string) => Promise<void>;
  handleCreatePallet: () => Promise<void>;
  handleScanBox: (barcode: string) => Promise<void>;
  handleRemoveBox: (boxNo: string) => Promise<void>;
  handleClosePallet: () => Promise<void>;
  handleReset: () => void;
}
