/**
 * @file src/hooks/pda/useShippingScan.types.ts
 * @description 출하등록 스캔 훅 타입 정의
 *
 * 초보자 가이드:
 * - useShippingScan.ts에서 사용하는 모든 인터페이스/타입 모음
 * - 별도 파일로 분리하여 훅 파일의 가독성 향상
 */

/** 출하 워크플로우 단계 */
export type ShippingPhase =
  | "SCAN_SHIPMENT_ORDER"
  | "SCAN_WORKER"
  | "SCAN_PRODUCT";

/** 서버에서 받아오는 출하지시 데이터 */
export interface ShipOrderData {
  id: string;
  shipOrderNo: string;
  customerName: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
}

/** 스캔된 제품 항목 (박스 단위) */
export interface ScannedShipItem {
  /** 박스 번호 */
  boxNo: string;
  /** 품목 코드 */
  itemCode: string;
  /** 수량 */
  qty: number;
  /** 팔레트에서 일괄 추가된 경우 팔레트 번호 */
  fromPallet?: string;
}

/** 작업자 정보 */
export interface WorkerInfo {
  id: number;
  workerNo: string;
  workerName: string;
}

/** 출하 완료 이력 항목 */
export interface ShipHistoryItem {
  shipOrderNo: string;
  customerName: string;
  itemCode: string;
  scannedQty: number;
  workerName: string;
  timestamp: string;
}

/** 팔레트 박스 목록 API 응답 */
export interface PalletBoxesResponse {
  palletNo: string;
  status: string;
  boxes: Array<{
    boxNo: string;
    itemCode: string;
    qty: number;
    status: string;
  }>;
}

/** 박스 단건 API 응답 */
export interface BoxResponse {
  boxNo: string;
  itemCode: string;
  qty: number;
  status: string;
}

/** 작업자 QR API 응답 */
export interface WorkerQrResponse {
  id: number;
  workerNo: string;
  workerName: string;
}

/** useShippingScan 훅 반환 타입 */
export interface UseShippingScanReturn {
  phase: ShippingPhase;
  scannedOrder: ShipOrderData | null;
  worker: WorkerInfo | null;
  scannedItems: ScannedShipItem[];
  /** 스캔된 박스 수량 합계 */
  scannedQty: number;
  /** 진행률 0~1 */
  progress: number;
  isScanning: boolean;
  isConfirming: boolean;
  error: string | null;
  history: ShipHistoryItem[];
  handleScanShipOrder: (barcode: string) => Promise<void>;
  handleScanWorker: (qr: string) => Promise<void>;
  handleScanProduct: (barcode: string) => Promise<void>;
  handleConfirmShip: () => Promise<boolean>;
  handleReset: () => void;
}
