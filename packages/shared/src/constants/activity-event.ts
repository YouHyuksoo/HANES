/**
 * @file packages/shared/src/constants/activity-event.ts
 * @description 활동 이벤트 유형 — 프론트·백엔드 단일 출처
 *
 * 왜 여기에 두는가:
 * 이 목록이 다섯 곳에 각각 박혀 있었다(백엔드 DTO·백엔드 저장규칙·프론트 전송규칙·
 * 드라이버 판정·e2e 타입). 다섯이 같은 값이면 동작하지만, 유형을 하나 추가할 때
 * 한 곳만 고치면 조용히 어긋난다.
 *
 * 실제로 같은 유형의 결함을 겪었다(2026-09-13): 시나리오 셀렉터 규칙을 드라이버에서만
 * 고치고 백엔드 검증기를 안 고쳐서, 시나리오가 규격 위반으로 통째로 적재 거부됐다.
 * 그래서 "양쪽이 같이 봐야 하는 규격"은 여기로 올린다.
 */

/** 수집 가능한 활동 유형 */
export const ACTIVITY_EVENT_TYPES = [
  'LOGIN',
  'PAGE_ACCESS',
  'TOAST_SUCCESS',
  'TOAST_ERROR',
  'API_CALL',
  'API_ERROR',
  'JS_ERROR',
  'SCAN',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/**
 * 장애 기록 3종.
 *
 * 이 유형들은 `ENABLE_ACTIVITY_LOG` 설정과 무관하게 항상 수집·저장한다.
 * 그 설정은 평상시 수집량을 줄이려는 것이지 장애 기록을 끄려는 것이 아니다.
 * 장애가 났을 때 기록이 없으면 원인 추적이 불가능하고, AI 가 실패를 분석할 재료도 사라진다.
 */
export const ACTIVITY_ERROR_TYPES = ['TOAST_ERROR', 'API_ERROR', 'JS_ERROR'] as const;

export type ActivityErrorType = (typeof ACTIVITY_ERROR_TYPES)[number];

export function isActivityErrorType(type: string): type is ActivityErrorType {
  return (ACTIVITY_ERROR_TYPES as readonly string[]).includes(type);
}

/**
 * 평상시에는 수집하지 않고 `ACTIVITY_LOG_COLLECT_ALL='Y'` 일 때만 서버로 보내는 유형.
 * 업무 요청 1건당 로그가 딸려 붙어 기록량이 크게 늘기 때문이다.
 */
export const ACTIVITY_VERBOSE_TYPES = ['TOAST_SUCCESS', 'API_CALL', 'SCAN'] as const;

/** 기록 주체 — 사람 조작과 시나리오 드라이버 실행을 구분한다 */
export const ACTIVITY_ACTOR_KINDS = ['HUMAN', 'SCENARIO'] as const;

export type ActivityActorKind = (typeof ACTIVITY_ACTOR_KINDS)[number];
