/**
 * @file hooks/useActivityLogger.ts
 * @description 사용자 페이지 접속 활동 로그 전송 훅
 *
 * 초보자 가이드:
 * 1. **usePathname** 변경 감지 → POST /system/activity-logs 호출
 * 2. **sysConfigStore.isEnabled('ENABLE_ACTIVITY_LOG')** 확인 후에만 전송
 * 3. 디바운스 적용 (빠른 연속 이동 시 중복 방지, 500ms)
 * 4. deviceType: pathname이 /pda로 시작하면 'PDA', 아니면 'PC'
 * 5. AuthGuard / PdaAuthGuard 내부에서 호출
 */
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import { api } from "@/services/api";

export function useActivityLogger() {
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    // 같은 경로면 무시
    if (pathname === lastPathRef.current) return;

    // 로그인 페이지는 무시
    if (pathname === "/login" || pathname === "/pda/login") return;

    // 디바운스: 이전 타이머 취소
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      lastPathRef.current = pathname;

      // 설정 체크 (동기적으로 store에서 확인)
      const isEnabled = useSysConfigStore.getState().isEnabled("ENABLE_ACTIVITY_LOG");
      if (!isEnabled) return;

      const deviceType = pathname.startsWith("/pda") ? "PDA" : "PC";

      api
        .post("/system/activity-logs", {
          activityType: "PAGE_ACCESS",
          pagePath: pathname,
          deviceType,
        })
        .catch(() => {
          // 로그 전송 실패는 무시 (사용자 경험에 영향 주지 않음)
        });
    }, 500);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pathname]);
}
