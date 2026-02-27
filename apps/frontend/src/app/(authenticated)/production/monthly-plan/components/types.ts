/**
 * @file production/monthly-plan/components/types.ts
 * @description 월간생산계획 타입 정의
 *
 * 초보자 가이드:
 * 1. **ProdPlanItem**: 생산계획 단일 항목 인터페이스
 * 2. **part**: 품목 마스터 정보 (JOIN 조회 결과)
 * 3. **status**: DRAFT(초안) → CONFIRMED(확정) → CLOSED(마감)
 */

/** 생산계획 항목 */
export interface ProdPlanItem {
  id: number;
  planNo: string;
  planMonth: string;
  itemCode: string;
  itemType: 'FG' | 'WIP';
  planQty: number;
  orderQty: number;
  customer?: string | null;
  lineCode?: string | null;
  priority: number;
  status: string;
  remark?: string | null;
  createdAt?: string;
  updatedAt?: string;
  part?: {
    itemCode: string;
    itemName: string;
    unit: string;
    spec?: string;
  } | null;
}

/** 월간 집계 */
export interface ProdPlanSummary {
  total: number;
  draft: number;
  confirmed: number;
  closed: number;
  fgCount: number;
  wipCount: number;
  fgPlanQty: number;
  wipPlanQty: number;
  totalPlanQty: number;
  totalOrderQty: number;
}
