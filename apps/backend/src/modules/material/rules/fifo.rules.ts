/**
 * @file src/modules/material/rules/fifo.rules.ts
 * @description 자재 출고 FIFO(선입선출)·유효기간 순수 규칙 — DB/서비스 의존 없음
 *
 * 초보자 가이드:
 * 1. **findOlderIssuableLot**: 출고하려는 LOT(candidate)보다 기준일이 빠른 출고가능 LOT 가 있으면 그중 가장 오래된 LOT 를 돌려준다.
 *    기준일(입고일/제조일)이 null 인 LOT 는 순서를 만들 수 없으므로 비교에서 뺀다. 같은 날짜는 위반이 아니다.
 * 2. **isLotExpired**: EXPIRE_DATE < 오늘(일 단위) 이면 만료.
 * 3. 날짜 비교는 모두 로컬 날짜 키(YYYY-MM-DD)로 한다. toISOString 은 UTC 라서 KST 오전에 전날이 되므로 쓰지 않는다.
 * 4. **isFifoApplicableToIssueType**: 수리 부품 소비(issueType REPAIR)는 sys-config FIFO_APPLY_REPAIR(기본 N)가 Y 일 때만 FIFO 대상이다.
 */

/** 수리 부품 소비 출고 유형(repair-stock.service 가 createInTx 에 넘기는 값) */
export const REPAIR_ISSUE_TYPE = 'REPAIR';

/**
 * 출고 유형별 FIFO 적용 여부.
 * - REPAIR: FIFO_APPLY_REPAIR 설정(fifoApplyRepair)이 true 일 때만 적용
 * - 그 외 유형: 항상 적용(FIFO_ENABLED 는 호출자가 별도로 본다)
 */
export function isFifoApplicableToIssueType(issueType: string | null | undefined, fifoApplyRepair: boolean): boolean {
  if ((issueType ?? '').trim().toUpperCase() === REPAIR_ISSUE_TYPE) return fifoApplyRepair;
  return true;
}

export type FifoCriteria = 'RECEIVE_DATE' | 'MFG_DATE';

export type FifoDateValue = Date | string | null | undefined;

export interface FifoLotLike {
  matUid: string;
  recvDate?: FifoDateValue;
  manufactureDate?: FifoDateValue;
}

/**
 * sys-config FIFO_CRITERIA 값 정규화.
 * - 'MFG_DATE' → 제조일(MANUFACTURE_DATE)
 * - 'RCV_DATE'(실DB OPTIONS 값) / 'RECEIVE_DATE'(시드 표기) / null / 알 수 없는 값 → 입고일(RECV_DATE)
 */
export function normalizeFifoCriteria(value: string | null | undefined): FifoCriteria {
  return (value ?? '').trim().toUpperCase() === 'MFG_DATE' ? 'MFG_DATE' : 'RECEIVE_DATE';
}

/** Date/문자열을 로컬 날짜 키(YYYY-MM-DD)로. 값이 없거나 해석 불가면 null */
export function toDayKey(value: FifoDateValue): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : toDayKey(parsed);
  }
  if (Number.isNaN(value.getTime())) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** LOT 의 FIFO 기준일 키 — RECEIVE_DATE 면 입고일, MFG_DATE 면 제조일 */
export function getFifoDateKey(lot: FifoLotLike, criteria: FifoCriteria): string | null {
  return toDayKey(criteria === 'MFG_DATE' ? lot.manufactureDate : lot.recvDate);
}

/**
 * candidate 보다 기준일이 빠른 LOT 중 가장 오래된 LOT.
 * - candidate 기준일이 null 이면 순서를 만들 수 없으므로 null(위반 아님)
 * - others 중 기준일 null 은 제외, 같은 날짜는 위반 아님, candidate 자신은 제외
 */
export function findOlderIssuableLot<T extends FifoLotLike>(
  candidate: FifoLotLike,
  others: readonly T[],
  criteria: FifoCriteria,
): T | null {
  const candidateKey = getFifoDateKey(candidate, criteria);
  if (!candidateKey) return null;

  let oldest: T | null = null;
  let oldestKey: string | null = null;
  for (const lot of others) {
    if (lot.matUid === candidate.matUid) continue;
    const key = getFifoDateKey(lot, criteria);
    if (!key || key >= candidateKey) continue;
    if (!oldestKey || key < oldestKey) {
      oldest = lot;
      oldestKey = key;
    }
  }
  return oldest;
}

/** 유효기한 만료 여부 — EXPIRE_DATE < today (일 단위). 유효기한 없으면 만료 아님 */
export function isLotExpired(lot: { expireDate?: FifoDateValue }, today: Date): boolean {
  const expireKey = toDayKey(lot.expireDate);
  const todayKey = toDayKey(today);
  if (!expireKey || !todayKey) return false;
  return expireKey < todayKey;
}
