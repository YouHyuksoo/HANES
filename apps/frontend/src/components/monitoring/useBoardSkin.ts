/**
 * @file src/components/monitoring/useBoardSkin.ts
 * @description 모니터링 보드 공통 상태 훅 — 스킨 선택(TV별 localStorage 저장) + TV 모드(전체화면).
 *
 * 초보자 가이드:
 * - useBoardSkin("monitoring:prod-board:skin", ["control","departure","datawall"], "control")
 *   → 저장된 스킨을 복원하고, setSkin 으로 바꾸면 localStorage 에도 기록한다.
 * - useTvMode() → fixed 오버레이 + requestFullscreen 토글. 전체화면 미지원 환경은 오버레이만.
 */
import { useCallback, useEffect, useState } from "react";

export function useBoardSkin<T extends string>(storageKey: string, ids: readonly T[], initial: T) {
  const [skin, setSkinState] = useState<T>(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && (ids as readonly string[]).includes(saved)) setSkinState(saved as T);
    } catch {
      // localStorage 접근 불가 환경은 기본 스킨 유지
    }
    // ids 는 상수 배열이므로 storageKey 기준으로만 복원
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setSkin = useCallback((next: T) => {
    setSkinState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // 저장 실패 무시
    }
  }, [storageKey]);

  return { skin, setSkin };
}

export function useTvMode() {
  const [tvMode, setTvMode] = useState(false);

  const toggleTvMode = useCallback(() => {
    setTvMode((prev) => {
      const next = !prev;
      try {
        if (next) void document.documentElement.requestFullscreen?.();
        else if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        // 전체화면 미지원 환경에서는 오버레이만 적용
      }
      return next;
    });
  }, []);

  return { tvMode, toggleTvMode };
}
