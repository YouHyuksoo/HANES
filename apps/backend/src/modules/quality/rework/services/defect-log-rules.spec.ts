/**
 * @file defect-log-rules.spec.ts
 * @description 불량이력 상태 규칙(@harness/shared defect-log-rules) — 공통코드 DEFECT_LOG_STATUS 정본과 전이표 검증
 */
import {
  DEFECT_LOG_STATUS,
  DEFECT_LOG_STATUSES,
  DEFECT_LOG_OPEN_STATUSES,
  canTransitionDefectLogStatus,
  deriveDefectLogStatusFromReworkInspect,
  isDefectLogOpen,
  isDefectLogStatus,
} from '@harness/shared';

describe('defect-log-rules', () => {
  it('정본 어휘는 공통코드 DEFECT_LOG_STATUS(WAIT/REPAIR/REWORK/SCRAP/DONE)와 같다', () => {
    expect([...DEFECT_LOG_STATUSES].sort()).toEqual(['DONE', 'REPAIR', 'REWORK', 'SCRAP', 'WAIT']);
    expect(DEFECT_LOG_STATUS.WAIT).toBe('WAIT');
  });

  it('재작업 공정 어휘(WAITING)는 불량이력 정본이 아니다', () => {
    expect(isDefectLogStatus('WAITING')).toBe(false);
    expect(isDefectLogStatus('WAIT')).toBe(true);
  });

  it('미처리 상태는 WAIT/REPAIR/REWORK, 종결은 SCRAP/DONE', () => {
    expect([...DEFECT_LOG_OPEN_STATUSES]).toEqual(['WAIT', 'REPAIR', 'REWORK']);
    expect(isDefectLogOpen('REWORK')).toBe(true);
    expect(isDefectLogOpen('DONE')).toBe(false);
    expect(isDefectLogOpen(null)).toBe(false);
  });

  it('전이표: WAIT→REPAIR/REWORK/SCRAP 허용, WAIT→DONE 직접 완료 불가, 종결 후 변경 불가', () => {
    expect(canTransitionDefectLogStatus('WAIT', 'REPAIR')).toBe(true);
    expect(canTransitionDefectLogStatus('WAIT', 'REWORK')).toBe(true);
    expect(canTransitionDefectLogStatus('WAIT', 'SCRAP')).toBe(true);
    expect(canTransitionDefectLogStatus('WAIT', 'DONE')).toBe(false);
    expect(canTransitionDefectLogStatus('REPAIR', 'DONE')).toBe(true);
    expect(canTransitionDefectLogStatus('REWORK', 'WAIT')).toBe(true);
    expect(canTransitionDefectLogStatus('DONE', 'WAIT')).toBe(false);
    expect(canTransitionDefectLogStatus('SCRAP', 'REWORK')).toBe(false);
  });

  it('정본 외 값(WAITING/PENDING 등)은 어느 방향으로도 전이하지 않는다', () => {
    expect(canTransitionDefectLogStatus('WAITING', 'REWORK')).toBe(false);
    expect(canTransitionDefectLogStatus('WAIT', 'PENDING')).toBe(false);
    expect(canTransitionDefectLogStatus(undefined, 'WAIT')).toBe(false);
  });

  it('재작업 검사 결과 → 불량이력 상태: PASS=DONE, SCRAP=SCRAP, FAIL=REWORK', () => {
    expect(deriveDefectLogStatusFromReworkInspect('PASS')).toBe('DONE');
    expect(deriveDefectLogStatusFromReworkInspect('SCRAP')).toBe('SCRAP');
    expect(deriveDefectLogStatusFromReworkInspect('FAIL')).toBe('REWORK');
  });
});
