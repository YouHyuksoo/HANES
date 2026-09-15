/**
 * @file components/material/issue-from-request/types.ts
 * @description 출고요청 출고 모달 하위 컴포넌트 공용 타입
 */
import type { AllocationSlice } from '@harness/shared';

/** 요청 상세의 품목 */
export interface RequestDetailItem {
  id: string;
  seq?: number;
  itemCode: string;
  itemName: string;
  unit: string;
  requestQty: number;
  issuedQty: number;
  /** 포장단위(최소 출고 단위) */
  minPackQty?: number;
  /** 출고 가능 재고(IQC 합격 또는 특채, 백엔드 집계) */
  issuableQty?: number;
  /** IQC 미검사(PENDING/HOLD) 재고(백엔드 집계) */
  pendingIqcQty?: number;
}

/** 출고 입력 행 */
export interface IssueRow extends RequestDetailItem {
  rowKey: string;
  seq: number;
  remainQty: number;
  /** 포장단위 올림 잔여 = 실출고수량(배분 목표) */
  packRemainQty: number;
}

export interface AvailableStock {
  id?: string;
  matUid: string;
  itemCode: string;
  warehouseCode: string;
  warehouseName?: string;
  availableQty?: number;
  qty?: number;
  unit?: string;
  /** 입고일 */
  recvDate?: string | null;
  /** 제조일자 */
  manufactureDate?: string | null;
  /**
   * 서버가 실제로 정렬에 쓴 FIFO 기준(sys-config FIFO_CRITERIA 정규화 값).
   * 출고 정책이 위반을 판정하는 기준과 같다 — 프론트가 추측하지 않도록 서버가 내려준다.
   */
  fifoCriteria?: 'RECEIVE_DATE' | 'MFG_DATE';
}

/** 요청 품목(rowKey) → 롯트 배분 조각 목록 */
export type AllocationMap = Record<string, AllocationSlice[]>;

/** 롯트의 가용 수량 — availableQty 우선, 없으면 qty */
export const stockAvailableQty = (stock: AvailableStock): number =>
  stock.availableQty ?? stock.qty ?? 0;

/** 배분 합계 */
export const sumSlices = (slices: AllocationSlice[] | undefined): number =>
  (slices ?? []).reduce((sum, slice) => sum + slice.qty, 0);

/** 날짜 표시용 포맷 (YYYY-MM-DD) */
export const fmtRecvDate = (v?: string | null) => (v ? String(v).slice(0, 10) : '-');

/**
 * 목록의 FIFO 기준 — 서버가 행마다 내려준 값을 그대로 쓴다.
 * 값이 없으면(행 없음) 규칙 단일 출처(normalizeFifoCriteria)의 기본과 같은 RECEIVE_DATE.
 */
export const fifoCriteriaOf = (stocks: AvailableStock[]): 'RECEIVE_DATE' | 'MFG_DATE' =>
  stocks.find((stock) => stock.fifoCriteria)?.fifoCriteria ?? 'RECEIVE_DATE';

/** 정렬 기준이 된 날짜 — 기준이 MFG_DATE 면 제조일자, 아니면 입고일 */
export const fifoDateOf = (
  stock: AvailableStock,
  criteria: 'RECEIVE_DATE' | 'MFG_DATE',
): string | null | undefined => (criteria === 'MFG_DATE' ? stock.manufactureDate : stock.recvDate);
