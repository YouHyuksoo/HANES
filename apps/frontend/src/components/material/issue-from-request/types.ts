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
  /** 입고일(FIFO 선입선출 기준) */
  recvDate?: string | null;
}

/** 요청 품목(rowKey) → 롯트 배분 조각 목록 */
export type AllocationMap = Record<string, AllocationSlice[]>;

/** 롯트의 가용 수량 — availableQty 우선, 없으면 qty */
export const stockAvailableQty = (stock: AvailableStock): number =>
  stock.availableQty ?? stock.qty ?? 0;

/** 배분 합계 */
export const sumSlices = (slices: AllocationSlice[] | undefined): number =>
  (slices ?? []).reduce((sum, slice) => sum + slice.qty, 0);

/** 입고일 표시용 포맷 (YYYY-MM-DD) */
export const fmtRecvDate = (v?: string | null) => (v ? String(v).slice(0, 10) : '-');
