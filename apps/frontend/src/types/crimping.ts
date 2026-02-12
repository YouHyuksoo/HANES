/**
 * @file src/pages/crimping/types.ts
 * @description 압착공정 페이지 공통 타입 정의
 *
 * 초보자 가이드:
 * 1. **압착공정**: 전선 끝에 터미널(단자)을 압착하는 공정
 * 2. **금형(Applicator)**: 터미널 압착에 사용되는 금형
 * 3. **C/H(Crimp Height)**: 압착 높이 - 품질 기준치
 */

/** 압착 작업지시 상태 */
export type CrimpingOrderStatus = 'WAITING' | 'RUNNING' | 'DONE';

/** C/H 승인 상태 */
export type CHApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** 압착 작업지시 인터페이스 */
export interface CrimpingOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  wireCode: string;
  wireName: string;
  terminalCode: string;
  terminalName: string;
  moldCode: string;           // 사용 금형
  moldName: string;
  crimpHeightStd: number;     // 압착높이 기준 (mm)
  crimpHeightTol: number;     // 허용공차 (+/- mm)
  planQty: number;
  prodQty: number;
  equipCode: string;
  status: CrimpingOrderStatus;
  remark?: string;
}

/** 압착 작업실적 인터페이스 */
export interface CrimpingResult {
  id: string;
  resultNo: string;
  orderNo: string;
  workDate: string;
  wireCode: string;
  wireName: string;
  terminalCode: string;
  terminalName: string;
  moldCode: string;
  goodQty: number;
  defectQty: number;
  equipCode: string;
  workerName: string;
  crimpHeightActual: number;   // 실측 C/H
  chApprovalStatus: CHApprovalStatus;
  chApprovedBy?: string;
  startTime: string;
  endTime: string;
}

/** 금형 인터페이스 */
export interface Mold {
  id: string;
  moldCode: string;
  moldName: string;
  terminalCode: string;
  terminalName: string;
  currentShots: number;
  expectedLife: number;
  status: MoldStatus;
  lastMaintDate: string;
  nextMaintDate: string;
  location: string;
  remark?: string;
}

/** 금형 상태 */
export type MoldStatus = 'OK' | 'WARNING' | 'REPLACE' | 'MAINT';

/** 상태별 스타일 매핑 */
export const orderStatusStyles: Record<CrimpingOrderStatus, { label: string; color: string }> = {
  WAITING: { label: '대기', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  RUNNING: { label: '진행중', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  DONE: { label: '완료', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
};

export const chApprovalStyles: Record<CHApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: '대기', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  APPROVED: { label: '승인', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  REJECTED: { label: '반려', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

export const moldStatusStyles: Record<MoldStatus, { label: string; color: string; bgColor: string }> = {
  OK: { label: '정상', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', bgColor: 'bg-green-50 dark:bg-green-900/10' },
  WARNING: { label: '경고', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', bgColor: 'bg-yellow-50 dark:bg-yellow-900/10' },
  REPLACE: { label: '교체필요', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/10' },
  MAINT: { label: '정비중', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', bgColor: 'bg-purple-50 dark:bg-purple-900/10' },
};
