"use client";

/**
 * @file components/system/ActivityCollector.tsx
 * @description 토스트 / 전역 JS 에러를 활동 이벤트 링버퍼에 수집한다.
 *
 * 초보자 가이드:
 * 1. **토스트**: `useToasterStore()`로 react-hot-toast의 활성 토스트 목록을 구독한다.
 *    이렇게 하면 `toast.success(...)`를 호출하는 53개 파일을 하나도 고치지 않아도 된다.
 *    (래퍼 함수를 만들어 전부 교체하는 방식은 호출부를 전부 건드려야 해서 쓰지 않았다)
 * 2. **JS 에러**: `window.onerror` + `unhandledrejection`.
 * 3. API 계열(API_CALL / API_ERROR)은 여기가 아니라 `services/api.ts` 인터셉터가 수집한다.
 * 4. 적재된 이벤트를 서버로도 흘리도록 sink(activity-reporter)를 등록한다.
 *    링버퍼는 브라우저 안에만 있어서 백엔드 AI가 실패 원인을 못 본다 — 그래서 서버 사본이 필요하다.
 * 5. 화면에 아무것도 그리지 않는다. providers.tsx의 <Toaster> 옆에 마운트한다.
 */

import { useEffect, useRef } from 'react';
import { useToasterStore } from 'react-hot-toast';
import { pushActivityEvent, setActivitySink } from '@/services/activity-collector';
import { reportActivityEvent } from '@/services/activity-reporter';

/** 토스트 메시지는 문자열이 아닐 수 있다(JSX). 문자열만 안전하게 뽑는다. */
function toMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export default function ActivityCollector() {
  const { toasts } = useToasterStore();
  /** 이미 수집한 토스트 id — 같은 토스트가 리렌더마다 다시 잡히는 것을 막는다 */
  const seenToastIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const t of toasts) {
      if (seenToastIds.current.has(t.id)) continue;
      // 아직 화면에 뜨지 않은(예약된) 토스트는 건너뛴다
      if (!t.visible) continue;
      seenToastIds.current.add(t.id);

      if (t.type === 'success') {
        pushActivityEvent({ type: 'TOAST_SUCCESS', message: toMessage(t.message) });
      } else if (t.type === 'error') {
        pushActivityEvent({ type: 'TOAST_ERROR', message: toMessage(t.message) });
      }
      // 'loading' / 'blank' 는 결과가 아니라 진행 표시라 수집하지 않는다
    }

    // 사라진 토스트의 id는 정리한다(장시간 실행 시 Set 무한 증가 방지)
    if (seenToastIds.current.size > 200) {
      const alive = new Set(toasts.map((t) => t.id));
      seenToastIds.current = new Set([...seenToastIds.current].filter((id) => alive.has(id)));
    }
  }, [toasts]);

  // 링버퍼에 쌓인 이벤트를 서버 전송으로도 흘린다 (채널 A)
  useEffect(() => {
    setActivitySink(reportActivityEvent);
    return () => setActivitySink(null);
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      pushActivityEvent({
        type: 'JS_ERROR',
        message: event.message || String(event.error ?? 'unknown error'),
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      pushActivityEvent({
        type: 'JS_ERROR',
        message: reason instanceof Error ? reason.message : String(reason),
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
