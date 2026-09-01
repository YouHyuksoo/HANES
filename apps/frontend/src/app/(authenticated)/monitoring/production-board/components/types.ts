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
