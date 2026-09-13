/**
 * @file services/activity-collector.ts
 * @description 활동 이벤트 인페이지 링버퍼 — 시나리오 실행기의 판정 채널
 *
 * 초보자 가이드:
 * 1. 화면에서 일어난 일(토스트·API 응답·JS 에러·스캔)을 구조화된 객체로 `window.__HANES_ACTIVITY__`에 쌓는다.
 * 2. Playwright 시나리오 실행기가 `page.evaluate()`로 이 버퍼를 읽어 **스텝 성공/실패를 판정**한다.
 *    토스트는 4초 뒤 사라지고 스크린샷은 기계 판정이 불가능하므로, 판정은 반드시 이 이벤트로 한다.
 * 3. 설정(SYS_CONFIGS)과 무관하게 **항상 전량** 쌓는다.
 *    설정은 서버 전송(POST /system/activity-logs)만 제어하며, 그건 별개 채널이다.
 * 4. 상한 500건. 초과하면 오래된 것부터 버린다(장시간 켜두는 키오스크의 메모리 누수 방지).
 *
 * 설계 근거: docs/plans/2026-09-11-activity-log-scenario-runner.md 2절
 */

// 유형 목록은 @harness/shared 가 단일 출처다 (백엔드 DTO 와 같은 목록이어야 한다)
export type { ActivityEventType } from '@harness/shared';

import type { ActivityEventType } from '@harness/shared';

export interface ActivityEvent {
  /** Date.now() */
  ts: number;
  type: ActivityEventType;
  /** 토스트 본문 / 에러 메시지 */
  message?: string;
  /** GET | POST | ... */
  method?: string;
  /** /production/subprocess-kitting/issue */
  path?: string;
  /** HTTP 상태 */
  status?: number;
  /** 백엔드 HttpExceptionFilter가 채우는 에러 코드 */
  errorCode?: string;
  /** 이벤트 발생 시점의 화면 경로 */
  pagePath?: string;
  /** SCAN 값 */
  value?: string;
  /**
   * 쓰기(POST/PUT/PATCH/DELETE) 응답 본문.
   * 시나리오 체인이 "직전 절차가 만든 것"(예: 생성된 작업지시번호)을 여기서 읽는다.
   * 화면 수정·토스트 파싱·재조회 없이 실제로 일어난 일을 그대로 참조하기 위한 필드다.
   * 조회(GET)는 담지 않는다 — 목록 응답이 크고 체인에 쓸 일이 없다.
   * 링버퍼 전용이며 서버로는 보내지 않는다(응답 페이로드 장기보관 회피).
   */
  result?: unknown;
}

declare global {
  interface Window {
    __HANES_ACTIVITY__?: ActivityEvent[];
  }
}

/** 링버퍼 상한 — 한 스텝이 만드는 이벤트는 보통 한 자릿수라 충분히 여유 있다 */
export const ACTIVITY_BUFFER_LIMIT = 500;

/**
 * 수집 자신이 만드는 트래픽은 제외한다.
 * 로그 전송 API를 수집하면 전송 → 수집 → 전송 무한 루프가 된다.
 */
const EXCLUDED_PATH_FRAGMENTS = ['/system/activity-logs'];

function isExcluded(path?: string): boolean {
  if (!path) return false;
  return EXCLUDED_PATH_FRAGMENTS.some((fragment) => path.includes(fragment));
}

/**
 * 이벤트를 링버퍼에 적재한다.
 * SSR(window 없음)에서는 아무것도 하지 않는다.
 */
/** 쓰기 메서드 — 이 응답만 result에 담는다 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isWriteMethod(method?: string): boolean {
  return WRITE_METHODS.has((method ?? '').toUpperCase());
}

/**
 * 적재된 이벤트를 넘겨받는 구독자 — 서버 전송(activity-reporter)이 여기 등록한다.
 * 수집기가 리포터를 직접 import 하면 순환 참조가 되므로 주입 방식으로 둔다.
 */
let sink: ((event: ActivityEvent) => void) | null = null;

export function setActivitySink(fn: ((event: ActivityEvent) => void) | null): void {
  sink = fn;
}

export function pushActivityEvent(event: Omit<ActivityEvent, 'ts' | 'pagePath'> & { ts?: number }): void {
  if (typeof window === 'undefined') return;
  if (isExcluded(event.path)) return;

  const buffer = (window.__HANES_ACTIVITY__ ??= []);
  const full: ActivityEvent = {
    ...event,
    ts: event.ts ?? Date.now(),
    pagePath: window.location?.pathname,
  };
  buffer.push(full);

  // 서버 전송은 부가 작업이다. 실패해도 링버퍼 적재를 막지 않는다.
  try {
    sink?.(full);
  } catch {
    // 무시
  }

  // 상한 초과분은 앞에서 버린다
  if (buffer.length > ACTIVITY_BUFFER_LIMIT) {
    buffer.splice(0, buffer.length - ACTIVITY_BUFFER_LIMIT);
  }
}

/**
 * 버퍼를 비우고 내용을 돌려준다 — 실행기가 스텝 경계마다 호출한다.
 * 앱 코드에서 쓸 일은 없고, 콘솔·Playwright에서 쓰라고 열어 둔다.
 */
export function drainActivityEvents(): ActivityEvent[] {
  if (typeof window === 'undefined') return [];
  const buffer = window.__HANES_ACTIVITY__ ?? [];
  window.__HANES_ACTIVITY__ = [];
  return buffer;
}

/** URL에서 쿼리스트링과 오리진을 떼고 경로만 남긴다 (이벤트 술어의 pathIncludes 대상) */
export function toEventPath(url?: string): string | undefined {
  if (!url) return undefined;
  const withoutQuery = url.split('?')[0];
  try {
    // 절대 URL이면 pathname만
    return new URL(withoutQuery, window.location.origin).pathname;
  } catch {
    return withoutQuery;
  }
}
