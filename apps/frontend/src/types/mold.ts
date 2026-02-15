/**
 * @file src/types/mold.ts
 * @description 금형(Applicator) 관련 타입 정의
 *
 * 초보자 가이드:
 * 1. **금형(Applicator)**: 터미널 압착에 사용되는 금형 도구
 * 2. **타수(Shot)**: 금형 사용 횟수, 수명 관리의 기준
 * 3. **상태**: OK(정상), WARNING(경고), REPLACE(교체필요), MAINT(정비중)
 */

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
export const moldStatusStyles: Record<MoldStatus, { label: string; color: string; bgColor: string }> = {
  OK: { label: '정상', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', bgColor: 'bg-green-50 dark:bg-green-900/10' },
  WARNING: { label: '경고', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', bgColor: 'bg-yellow-50 dark:bg-yellow-900/10' },
  REPLACE: { label: '교체필요', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/10' },
  MAINT: { label: '정비중', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', bgColor: 'bg-purple-50 dark:bg-purple-900/10' },
};
