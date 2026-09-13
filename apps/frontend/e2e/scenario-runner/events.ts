/**
 * @file e2e/scenario-runner/events.ts
 * @description 링버퍼 drain + 스텝 판정 (규격서 6.1 / 6.2)
 *
 * 핵심은 **에러 귀속 규칙**이다.
 * 배경 폴링과 suppressErrorModal 인라인 처리 호출이 무관한 API_ERROR 를 흘리므로,
 * "에러가 오면 즉시 실패"로 두면 정상 스텝이 남의 에러로 실패한다.
 * 따라서 에러는 후보로 모으고, expect 충족이 이긴다.
 */
import type { Page } from '@playwright/test';
import { isActivityErrorType } from '@harness/shared';
import {
  type ActivityEvent,
  type EventPredicate,
  type StepVerdict,
} from './types';

/** 러너가 항상 무시하는 경로 — 수집기 자신의 전송 트래픽 */
const ALWAYS_IGNORED: EventPredicate[] = [{ pathIncludes: '/system/activity-logs' }];

/** 버퍼를 비우고 내용을 돌려준다. goto 직전에도 반드시 호출한다(리로드 시 window 가 날아간다). */
export async function drain(page: Page): Promise<ActivityEvent[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __HANES_ACTIVITY__?: unknown[] };
    const buffer = (w.__HANES_ACTIVITY__ ?? []) as unknown[];
    w.__HANES_ACTIVITY__ = [];
    return buffer;
  }) as Promise<ActivityEvent[]>;
}

export function matches(event: ActivityEvent, predicate: EventPredicate): boolean {
  if (predicate.type !== undefined && event.type !== predicate.type) return false;
  if (predicate.status !== undefined && event.status !== predicate.status) return false;
  if (predicate.method !== undefined && event.method !== predicate.method.toUpperCase()) return false;
  if (predicate.errorCode !== undefined && event.errorCode !== predicate.errorCode) return false;
  if (predicate.messageIncludes !== undefined
      && !(event.message ?? '').includes(predicate.messageIncludes)) return false;
  if (predicate.pathIncludes !== undefined
      && !(event.path ?? '').includes(predicate.pathIncludes)) return false;
  return true;
}

function isError(event: ActivityEvent): boolean {
  return isActivityErrorType(event.type);
}

function isIgnored(event: ActivityEvent, ignoreRules: EventPredicate[]): boolean {
  return [...ALWAYS_IGNORED, ...ignoreRules].some((rule) => matches(event, rule));
}

export interface JudgeOptions {
  expect?: EventPredicate;
  alreadyDone?: EventPredicate;
  timeoutMs: number;
  /** expect 가 없는 스텝이 에러를 관찰하는 시간 */
  settleMs: number;
  ignoreErrors: EventPredicate[];
}

export interface JudgeResult {
  verdict: StepVerdict;
  events: ActivityEvent[];
  candidateErrors: ActivityEvent[];
  error: string | null;
}

function describe(event: ActivityEvent): string {
  const parts: string[] = [event.type];
  if (event.method) parts.push(event.method);
  if (event.path) parts.push(event.path);
  if (event.status !== undefined) parts.push(String(event.status));
  if (event.errorCode) parts.push(event.errorCode);
  if (event.message) parts.push(`"${event.message}"`);
  return parts.join(' ');
}

/**
 * 스텝 실행 직후 호출한다. 규격서 6.2 판정 루프.
 *
 * - alreadyDone 일치 -> ALREADY_DONE
 * - expect 일치      -> PASS (에러가 이미 와 있어도 expect 가 이긴다)
 * - 그 외 에러       -> candidateErrors 에 적재하고 계속 대기 (조기 실패 안 함)
 * - 타임아웃         -> candidateErrors 있으면 FAIL / expect 있으면 FAIL / 없으면 PASS
 *
 * expect 가 없는 스텝은 settleMs 만큼만 관찰한다.
 */
export async function judgeStep(page: Page, options: JudgeOptions): Promise<JudgeResult> {
  const { expect: expectPredicate, alreadyDone, timeoutMs, settleMs, ignoreErrors } = options;
  const observed: ActivityEvent[] = [];
  const candidateErrors: ActivityEvent[] = [];

  // expect 가 없으면 오래 기다릴 이유가 없다 — 에러만 잠깐 지켜본다
  const deadline = Date.now() + (expectPredicate || alreadyDone ? timeoutMs : settleMs);

  while (Date.now() < deadline) {
    const batch = await drain(page);
    for (const event of batch) {
      if (isError(event) && isIgnored(event, ignoreErrors)) {
        observed.push({ ...event, ignored: true });
        continue;
      }
      observed.push(event);
      if (isError(event)) candidateErrors.push(event);
    }

    if (alreadyDone && observed.some((e) => !e.ignored && matches(e, alreadyDone))) {
      return { verdict: 'ALREADY_DONE', events: observed, candidateErrors, error: null };
    }
    if (expectPredicate && observed.some((e) => !e.ignored && matches(e, expectPredicate))) {
      // expect 가 이긴다. 동시에 들어온 에러는 증거로만 남긴다.
      return { verdict: 'PASS', events: observed, candidateErrors, error: null };
    }

    await page.waitForTimeout(100);
  }

  if (candidateErrors.length > 0) {
    return {
      verdict: 'FAIL',
      events: observed,
      candidateErrors,
      error: `에러 이벤트: ${describe(candidateErrors[0])}`,
    };
  }
  if (expectPredicate || alreadyDone) {
    return {
      verdict: 'FAIL',
      events: observed,
      candidateErrors,
      error: `expect 미충족(타임아웃 ${timeoutMs}ms): ${JSON.stringify(expectPredicate ?? alreadyDone)}`,
    };
  }
  return { verdict: 'PASS', events: observed, candidateErrors, error: null };
}
