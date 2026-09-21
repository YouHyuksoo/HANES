"use client";

/**
 * @file src/components/layout/useFullViewToggle.ts
 * @description 실적입력 계열 화면의 전체화면(chromeless) 토글 공용 훅
 *
 * 초보자 가이드:
 * 1. MainLayout 은 `?view=full` 이면 헤더·사이드바·탭을 모두 숨긴다(범용 규칙).
 *    가공 키오스크만 예외로 `?view=work` 를 쓰는데, 그건 경로 화이트리스트에 박혀 있는
 *    기존 규칙이라 그대로 두고 여기서 param 으로 받는다.
 * 2. URL 쿼리(chromeless)와 브라우저 전체화면(Fullscreen API)을 함께 켜고 끈다.
 *    사용자가 F11/ESC 로 브라우저 전체화면만 빠져나가도 아이콘이 따라 바뀌도록 이벤트를 듣는다.
 * 3. 화면마다 라우트가 다르므로 route 를 인자로 받는다. 이 로직을 화면마다 복붙하면
 *    어느 화면은 exitFullscreen 을 빠뜨리는 식으로 갈라진다(2026-09-21 통합).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export interface FullViewToggle {
  /** 지금 chromeless 상태인가(URL 쿼리 기준) */
  isFullView: boolean;
  /** 브라우저 전체화면 상태 — 아이콘 전환용 */
  isBrowserFullscreen: boolean;
  /** 켜고 끄기 */
  toggle: () => void;
}

export function useFullViewToggle(route: string, param: "full" | "work" = "full"): FullViewToggle {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFullView = searchParams.get("view") === param;
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  useEffect(() => {
    const handle = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  const toggle = useCallback(() => {
    if (isFullView) {
      router.push(route);
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    router.push(`${route}?view=${param}`);
    // 사용자 제스처 없이 호출되면 브라우저가 거부한다 — chromeless 는 이미 켜졌으므로 무시한다.
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, [isFullView, param, route, router]);

  return { isFullView, isBrowserFullscreen, toggle };
}
