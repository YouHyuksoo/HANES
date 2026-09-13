/**
 * @file scenario-driver/judge.ts
 * @description 스텝 판정 — 링버퍼 이벤트로만 판단한다 (규격 6.1 / 6.2)
 *
 * 인앱이라 page.evaluate 없이 링버퍼를 직접 읽는다.
 *
 * 에러 귀속 규칙이 핵심이다.
 * HANES 에는 배경 폴링과 suppressErrorModal 로 컴포넌트가 조용히 복구하는 호출이 있다.
 * "에러가 오면 즉시 실패"로 두면 무관한 남의 에러 하나에 정상 스텝이 실패한다.
 * 그래서 에러는 후보로 모으고, expect 충족이 이긴다.
 * 대가로 진짜 실패는 타임아웃까지 기다린다 — 조기 실패의 속도를 버리고 오판을 없앴다.
 */
import { drainActivityEvents, type ActivityEvent } from '@/services/activity-collector';
import { isActivityErrorType } from '@harness/shared';
import type { EventPredicate, StepVerdict } from './types';

// 에러 판정 대상은 @harness/shared 가 단일 출처다 (수집·전송·저장과 같은 목록)

/** 드라이버가 항상 무시하는 경로 — 수집기 자신의 전송 트래픽 */
const ALWAYS_IGNORED: EventPredicate[] = [{ pathIncludes: '/system/activity-logs' }];

export function matches(event: ActivityEvent, predicate: EventPredicate): boolean {
  if (predicate.type !== undefined && event.type !== predicate.type) return false;
  if (predicate.status !== undefined && event.status !== predicate.status) return false;
  if (predicate.method !== undefined && event.method !== predicate.method.toUpperCase()) return false;
  if (predicate.errorCode !== undefined && event.errorCode !== predicate.errorCode) return false;
  if (predicate.messageIncludes !== undefined && !(event.message ?? '').includes(predicate.messageIncludes)) return false;
  if (predicate.pathIncludes !== undefined && !(event.path ?? '').includes(predicate.pathIncludes)) return false;
  return true;
}

export function describeEvent(event: ActivityEvent): string {
  return [event.type, event.method, event.path, event.status, event.errorCode, event.message]
    .filter(Boolean)
    .join(' · ');
}

export interface JudgeOptions {
  expect?: EventPredicate;
  alreadyDone?: EventPredicate;
  timeoutMs?: number;
  /** expect 가 없는 스텝이 에러를 지켜보는 시간 */
  settleMs?: number;
  ignoreErrors?: EventPredicate[];
}

export interface JudgeResult {
  verdict: Extract<StepVerdict, 'PASS' | 'ALREADY_DONE' | 'FAIL'>;
  events: ActivityEvent[];
  error: string | null;
}

/** 버퍼를 비워 이전 스텝의 이벤트가 섞이지 않게 한다 */
export function clearEvents(): void {
  drainActivityEvents();
}

export async function judgeStep({
  expect: expectPredicate,
  alreadyDone,
  timeoutMs = 10_000,
  settleMs = 600,
  ignoreErrors = [],
}: JudgeOptions): Promise<JudgeResult> {
  const observed: ActivityEvent[] = [];
  const candidateErrors: ActivityEvent[] = [];
  const ignoreRules = [...ALWAYS_IGNORED, ...ignoreErrors];

  // expect 가 없는 순수 조작 스텝은 오래 기다릴 이유가 없다. 에러만 잠깐 지켜본다.
  const deadline = Date.now() + (expectPredicate || alreadyDone ? timeoutMs : settleMs);

  for (;;) {
    for (const event of drainActivityEvents()) {
      // 무시 규칙에 걸린 에러도 증거로는 남긴다 — ignoreErrors 가 과하게 넓어
      // 진짜 실패를 삼키고 있는지 사람이 검토할 수 있어야 한다.
      observed.push(event);
      const isError = isActivityErrorType(event.type);
      if (isError && !ignoreRules.some((r) => matches(event, r))) candidateErrors.push(event);
    }

    if (alreadyDone && observed.some((e) => matches(e, alreadyDone))) {
      return { verdict: 'ALREADY_DONE', events: observed, error: null };
    }
    // expect 가 이긴다 — 같은 창에 무관한 에러가 들어와 있어도 성공으로 본다
    if (expectPredicate && observed.some((e) => matches(e, expectPredicate))) {
      return { verdict: 'PASS', events: observed, error: null };
    }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (candidateErrors.length > 0) {
    return { verdict: 'FAIL', events: observed, error: describeEvent(candidateErrors[0]) };
  }
  if (expectPredicate || alreadyDone) {
    return {
      verdict: 'FAIL',
      events: observed,
      error: `기대한 결과가 ${timeoutMs}ms 안에 나타나지 않았습니다.`,
    };
  }
  return { verdict: 'PASS', events: observed, error: null };
}
