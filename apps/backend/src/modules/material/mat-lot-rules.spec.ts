/**
 * @file src/modules/material/mat-lot-rules.spec.ts
 * @description 자재 LOT 상태 규칙(@harness/shared mat-lot-rules) 진리표 — 출고/병합/분할/보류/입고 서비스가 모두 이 함수를 본다.
 */
import {
  MAT_LOT_ACTIVE_STATUSES,
  MAT_LOT_LIVE_STATUSES,
  MAT_LOT_STATUS,
  MAT_LOT_STATUSES,
  MAT_LOT_TERMINAL_STATUSES,
  canHoldMatLot,
  canReleaseMatLot,
  isMatLotActive,
  isMatLotIssuable,
  isMatLotMergeableOrSplittable,
  isMatLotOnHold,
  isMatLotReceivable,
  isMatLotTerminal,
} from '@harness/shared';

describe('mat-lot-rules (자재 LOT 상태 규칙)', () => {
  it('전체 집합은 공통코드 MAT_LOT_STATUS 6개와 같다', () => {
    expect([...MAT_LOT_STATUSES].sort()).toEqual(['DEPLETED', 'DISCARDED', 'HOLD', 'MERGED', 'NORMAL', 'SPLIT']);
  });

  it('활성/살아있는/종결 집합은 서로 겹치지 않고 합치면 전체가 된다', () => {
    const active = new Set<string>(MAT_LOT_ACTIVE_STATUSES);
    const terminal = new Set<string>(MAT_LOT_TERMINAL_STATUSES);
    for (const s of active) expect(terminal.has(s)).toBe(false);
    expect(new Set([...MAT_LOT_LIVE_STATUSES, ...MAT_LOT_TERMINAL_STATUSES]).size).toBe(MAT_LOT_STATUSES.length);
    expect(MAT_LOT_LIVE_STATUSES).toEqual(expect.arrayContaining([...MAT_LOT_ACTIVE_STATUSES, MAT_LOT_STATUS.HOLD]));
  });

  it.each([
    // status      active  hold   terminal receivable issuable
    ['NORMAL',     true,   false, false,   true,      true],
    ['HOLD',       false,  true,  false,   true,      false],
    ['DEPLETED',   false,  false, true,    false,     false],
    ['SPLIT',      false,  false, true,    false,     false],
    ['MERGED',     false,  false, true,    false,     false],
    ['DISCARDED',  false,  false, true,    false,     false],
  ])('%s → active=%s hold=%s terminal=%s receivable=%s issuable=%s', (status, active, hold, terminal, receivable, issuable) => {
    expect(isMatLotActive(status)).toBe(active);
    expect(isMatLotOnHold(status)).toBe(hold);
    expect(isMatLotTerminal(status)).toBe(terminal);
    expect(isMatLotReceivable(status)).toBe(receivable);
    expect(isMatLotIssuable(status)).toBe(issuable);
    expect(isMatLotMergeableOrSplittable(status)).toBe(active);
    expect(canHoldMatLot(status)).toBe(active);
    expect(canReleaseMatLot(status)).toBe(hold);
  });

  it('상태 미상(null/undefined/빈값/미등록 값)은 어느 경로에서도 통과시키지 않는다 — 조용한 폴백 금지', () => {
    for (const s of [null, undefined, '', '  ', 'UNKNOWN']) {
      expect(isMatLotIssuable(s)).toBe(false);
      expect(isMatLotReceivable(s)).toBe(false);
      expect(isMatLotMergeableOrSplittable(s)).toBe(false);
      expect(canHoldMatLot(s)).toBe(false);
      expect(canReleaseMatLot(s)).toBe(false);
      expect(isMatLotTerminal(s)).toBe(false);
    }
  });

  it('대소문자·공백은 정규화한다', () => {
    expect(isMatLotIssuable(' normal ')).toBe(true);
    expect(isMatLotTerminal('merged')).toBe(true);
    expect(isMatLotOnHold('Hold')).toBe(true);
  });
});
