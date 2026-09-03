/**
 * @file src/app/(authenticated)/monitoring/production-board/components/types.ts
 * @description 생산현황 보드 API 응답 타입 — GET /monitoring/boards/production
 *              작업지시 칸반 보드(job-order-board)도 이 타입을 재사용한다.
 */

export interface ProductionBoardOrder {
  orderNo: string;
  itemCode: string;
  itemName: string | null;
  processCode: string | null;
  equipCode: string | null;
  status: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  achieveRate: number;
  priority: number;
  /** ISO 문자열 (JSON 직렬화) — 작업 시작 시각 */
  startAt: string | null;
  /** 작업 완료 시각 */
  endAt: string | null;
  /** 마지막 상태 변경 시각 (HOLD 경과 계산용) */
  updatedAt: string | null;
  /** 이 지시의 마지막 실적 등록 시각 (정체 판정용) */
  lastResultAt: string | null;
}

export interface ProductionBoardKpi {
  planQty: number;
  goodQty: number;
  defectQty: number;
  achieveRate: number;
  runningCount: number;
  totalCount: number;
}

export interface HourlyPoint {
  hour: string;
  goodQty: number;
  defectQty: number;
}

export interface ProductionBoardData {
  kpi: ProductionBoardKpi;
  orders: ProductionBoardOrder[];
  hourly: HourlyPoint[];
}

/** 전광판 스킨 공통 props — page.tsx가 데이터/순환 상태를 내려준다 */
export interface BoardSkinProps {
  kpi?: ProductionBoardKpi;
  /** 전체 작업지시 (정렬: RUNNING 우선) */
  orders: ProductionBoardOrder[];
  /** 자동 순환된 현재 페이지 슬라이스 (목록형 스킨용) */
  pageItems: ProductionBoardOrder[];
  page: number;
  pageCount: number;
  /** 목록형 스킨의 페이지당 행 수 (순위 계산용) */
  pageSize: number;
  hourly: HourlyPoint[];
  /** 페이지/히어로 자동 전환 주기(초) */
  rollingSec: number;
  /** 마지막 데이터 갱신 시각 문자열 */
  updatedAt: string;
}
