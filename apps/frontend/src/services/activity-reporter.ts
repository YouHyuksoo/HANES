/**
 * @file services/activity-reporter.ts
 * @description 활동 이벤트를 서버(ACTIVITY_LOGS)로 전송한다 — 채널 A
 *
 * 초보자 가이드:
 * 채널이 둘이다. 역할이 다르므로 섞지 않는다.
 *
 *   채널 B (services/activity-collector.ts, 인페이지 링버퍼)
 *     - 항상 전량. 설정과 무관
 *     - 시나리오 드라이버가 스텝을 **즉시** 판정하고, 체인 파라미터(생성된 번호 등)를 읽는다
 *     - 브라우저 안에만 있다. 새로고침하면 사라진다
 *
 *   채널 A (이 파일)
 *     - 서버 저장. 감사 추적, 실행 기록, **백엔드 AI가 실패 원인을 분석할 때 참조**
 *     - 링버퍼는 브라우저 안에 있어서 백엔드 AI가 못 본다. 그래서 이 채널이 필요하다
 *     - 응답 본문(result)은 보내지 않는다. 메시지·상태·경로면 분석에 충분하고
 *       응답 페이로드를 장기 보관할 이유가 없다
 *
 * 전송 정책:
 *   - 에러 3종(TOAST_ERROR/API_ERROR/JS_ERROR)은 ENABLE_ACTIVITY_LOG 와 무관하게 항상 보낸다.
 *     장애 기록을 설정에 맡기면 정작 필요할 때 없다. 백엔드도 같은 규칙이다.
 *   - 나머지는 ENABLE_ACTIVITY_LOG, 그리고 성공·스캔·조회 계열은 ACTIVITY_LOG_COLLECT_ALL 까지 봐야 보낸다.
 *   - 전송 실패는 무시한다(fire-and-forget). 업무 흐름을 막지 않는다.
 */
import api from './api';
import type { ActivityEvent, ActivityEventType } from './activity-collector';
import { useSysConfigStore } from '@/stores/sysConfigStore';

/** 설정과 무관하게 항상 전송 — 백엔드 ALWAYS_LOGGED_TYPES 와 같은 목록을 유지한다 */
const ALWAYS_SENT: ActivityEventType[] = ['TOAST_ERROR', 'API_ERROR', 'JS_ERROR'];

/** ACTIVITY_LOG_COLLECT_ALL 이 Y 일 때만 전송 (평상시 수집량 억제) */
const VERBOSE_TYPES: ActivityEventType[] = ['TOAST_SUCCESS', 'API_CALL', 'SCAN'];

/** 현재 시나리오 실행 중인지 — 드라이버가 켜고 끈다 */
let actorKind: 'HUMAN' | 'SCENARIO' = 'HUMAN';

export function setActivityActorKind(kind: 'HUMAN' | 'SCENARIO'): void {
  actorKind = kind;
}

function shouldSend(type: ActivityEventType): boolean {
  if (ALWAYS_SENT.includes(type)) return true;

  const config = useSysConfigStore.getState();
  if (!config.isEnabled('ENABLE_ACTIVITY_LOG')) return false;
  if (VERBOSE_TYPES.includes(type)) return config.isEnabled('ACTIVITY_LOG_COLLECT_ALL');
  return true;
}

/** 메시지는 컬럼 상한(2000 CHAR)에 맞춰 자른다 */
function trimMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length > 2000 ? message.slice(0, 2000) : message;
}

/**
 * 이벤트 1건을 서버로 보낸다. 실패는 무시한다.
 * result(응답 본문)는 의도적으로 제외한다.
 */
export function reportActivityEvent(event: ActivityEvent): void {
  if (!shouldSend(event.type)) return;

  const message = trimMessage(
    event.message
      // API 계열은 메시지가 비어도 어떤 호출이었는지 남겨야 분석이 된다
      ?? (event.path ? `${event.method ?? ''} ${event.path} ${event.status ?? ''}`.trim() : undefined),
  );

  api
    .post(
      '/system/activity-logs',
      {
        activityType: event.type,
        message,
        actorKind,
        pagePath: event.pagePath,
        deviceType: event.pagePath?.startsWith('/pda') ? 'PDA' : 'PC',
      },
      { suppressErrorModal: true, skipSuccessToast: true },
    )
    .catch(() => {
      // 로그 전송 실패는 업무에 영향을 주지 않는다
    });
}
