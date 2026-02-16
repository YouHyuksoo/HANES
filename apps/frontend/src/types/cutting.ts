/**
 * @file src/pages/cutting/types.ts
 * @description 절단공정 페이지 공통 타입 정의
 *
 * 초보자 가이드:
 * 1. **절단공정**: 전선 릴에서 원하는 길이로 전선을 자르는 공정
 * 2. **탈피**: 전선 피복을 벗기는 작업 (Strip)
 * 3. **릴(Reel)**: 전선이 감겨있는 보빈 단위
 */

/** 절단 작업지시 상태 */
export type CuttingOrderStatus = 'WAITING' | 'RUNNING' | 'DONE';

/** 절단 작업지시 인터페이스 */
export interface CuttingOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  wireCode: string;
  wireName: string;
  wireSpec: string;      // 전선 규격 (ex: 0.5sq, 2.0sq)
  color: string;         // 전선 색상
  cutLength: number;     // 절단 길이 (mm)
  stripLengthA: number;  // A측 탈피 길이 (mm)
  stripLengthB: number;  // B측 탈피 길이 (mm)
  planQty: number;       // 계획 수량 (가닥)
  prodQty: number;       // 생산 수량
  equipCode: string;     // 절단기 코드
  status: CuttingOrderStatus;
  reelLotNo?: string;    // 투입 릴 LOT
  remark?: string;
}

/** 절단 작업실적 인터페이스 */
export interface CuttingResult {
  id: string;
  resultNo: string;
  orderNo: string;
  workDate: string;
  wireCode: string;
  wireName: string;
  cutLength: number;
  stripLengthA: number;
  stripLengthB: number;
  goodQty: number;
  defectQty: number;
  equipCode: string;
  workerName: string;
  reelLotNo: string;
  startAt: string;
  endAt: string;
}

/** 릴(전선 보빈) 인터페이스 */
export interface WireReel {
  id: string;
  lotNo: string;
  wireCode: string;
  wireName: string;
  wireSpec: string;
  color: string;
  totalLength: number;   // 총 길이 (m)
  usedLength: number;    // 사용 길이 (m)
  remainLength: number;  // 잔량 (m)
  receivedAt: string;
  supplier: string;
}

/** 상태별 스타일 매핑 */
export const statusStyles: Record<CuttingOrderStatus, { label: string; color: string }> = {
  WAITING: { label: '대기', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  RUNNING: { label: '진행중', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  DONE: { label: '완료', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
};
