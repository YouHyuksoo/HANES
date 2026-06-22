/**
 * @file src/app/(authenticated)/material/arrival/components/types.ts
 * @description 입하관리 타입 정의
 *
 * 초보자 가이드:
 * 1. **ArrivalRecord**: 입하 이력 레코드 (MatArrivalTransaction 기반)
 * 2. **ReceivablePO**: 입하 가능 PO 목록 항목
 * 3. **PoItemForArrival**: PO 품목별 입하 정보
 */

/** 품목 정보 (API 응답 공통) */
export interface PartInfo {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
}

/** LOT 정보 (API 응답 공통) */
export interface LotInfo {
  id: string;
  matUid: string;
  poNo?: string | null;
  vendor: string;
}

/** 창고 정보 */
export interface WarehouseInfo {
  id: string;
  warehouseName: string;
}

/** 입하 이력 레코드 (MatArrivalTransaction 기반) */
export interface ArrivalRecord {
  id: string;
  transNo: string;
  transType: 'ARRIVAL_IN' | 'ARRIVAL_CANCEL';
  transDate: string;
  itemCode: string;
  qty: number;
  status: 'DONE' | 'CANCELED';
  remark?: string | null;
  refType?: string | null;
  refId?: string | null;
  part: PartInfo;
  lot?: LotInfo | null;
  toWarehouse?: WarehouseInfo | null;
}

/** PO 품목 (입하 가능 목록에서 사용) */
export interface PoItemForArrival {
  id: string;
  poId: string;
  itemCode: string;
  orderQty: number;
  receivedQty: number;
  remainingQty: number;
  part: PartInfo;
  remark?: string | null;
}

/** 입하 가능 PO */
export interface ReceivablePO {
  id: string;
  poNo: string;
  partnerCode?: string | null;
  partnerName?: string | null;
  orderDate?: string | null;
  dueDate?: string | null;
  status: string;
  items: PoItemForArrival[];
  totalOrderQty: number;
  totalReceivedQty: number;
  totalRemainingQty: number;
}

/** PO 입하 시 품목별 입력 데이터 */
export interface ArrivalItemInput {
  poItemId: string;
  itemCode: string;
  receivedQty: number;
  warehouseCode: string;
  supUid?: string;
  invoiceNo: string;
  manufactureDate?: string;
  remark?: string;
}

/** 입하 통계 */
export interface ArrivalStats {
  todayCount: number;
  todayQty: number;
  unrecevedPoCount: number;
  totalCount: number;
}

/* ──────────────────────────────────────────────────────────
 * IQC005 Phase A 타입
 * ────────────────────────────────────────────────────────── */

/** IQC005 메인 그리드 행 (PO 라인 단위) */
export interface PoLineRow {
  poNo: string;
  poSeq: number;
  lineNo: number;
  revNo: number;
  itemCode: string;
  itemName: string;
  orderQty: number;
  receivedQty: number;
  remainingQty: number;
  orderDate: string | null;
  partnerName: string;
  useType: string;
  lineStatus: 'OPEN' | 'PARTIAL' | 'CLOSE';
}

/** PO 라인 입하 등록 입력 (POST /material/arrivals/po-line) */
export interface PoLineReceiptInput {
  poNo: string;
  lineNo: number;
  revNo: number;
  receivedQty: number;
  mfgPartnerCode: string;
  receivedDate: string;
  warehouseCode: string;
  remark?: string;
}

/** PO 라인 입하 등록 응답 — 발급된 시리얼 목록 */
export interface PoLineReceiptResponse {
  arrivalNo: string;
  serials: Array<{
    matUid: string;
    initQty: number;
    arrivalSeq: number;
    itemCode: string;
  }>;
}
