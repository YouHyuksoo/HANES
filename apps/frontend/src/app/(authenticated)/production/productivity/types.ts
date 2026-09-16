/**
 * @file src/app/(authenticated)/production/productivity/types.ts
 * @description 생산성분석 화면 데이터 타입 (GET /production/prod-results/summary/productivity 응답)
 */
export interface ProductivityRow {
  itemCode: string;
  itemName: string;
  itemType: string;
  processCode: string;
  processName: string;
  lineCode: string;
  /** 작업지시 계획수량 합계 */
  planQty: number;
  /** 총생산수량 (양품 + 불량) */
  totalQty: number;
  goodQty: number;
  defectQty: number;
  yieldRate: number;
  defectRate: number;
  /** 실작업시간(H). 산정 근거는 workTimeSource 참조 */
  workHours: number;
  /** RESULT=실적 시작~종료, JOB_ORDER=작업지시 착수~완료, NONE=산정 부가 */
  workTimeSource: "RESULT" | "JOB_ORDER" | "NONE";
  /** 작업시간 산정에 사용된 완료된 작업지시 수 */
  closedOrderCount: number;
  /** 투입공수(M/H) = 작업시간 x 투입인원 */
  manHours: number;
  workerCnt: number;
  equipCnt: number;
  workDays: number;
  actualUph: number;
  stdUph: number;
  uphAchieveRate: number;
  actualTactTime: number;
  stdTactTime: number;
  /** 인당생산성 (EA / 인·H) */
  perManUph: number;
  /** 능률(%) = 표준공수 / 실적공수 */
  efficiencyRate: number;
  operationRate: number;
  oee: number;
  orderCount: number;
  resultCount: number;
  /** PROCESS_CAPAS 표준 등록 여부 */
  hasStandard: boolean;
}
