"use client";

/**
 * @file src/components/pda/PdaAuthGuard.tsx
 * @description PDA 전용 인증 보호 - 미인증 시 /pda/login 리다이렉트
 *
 * 초보자 가이드:
 * 1. 기존 AuthGuard와 동일 로직이나 PDA 전용 로딩 UI + 리다이렉트 경로
 * 2. Zustand persist hydration 완료 대기 후 인증 확인
 * 3. 미인증 → /pda/login 리다이렉트 (PDA 전용 로그인 페이지)
 * 4. 서버 다운 시에도 캐시된 토큰이 있으면 children 렌더 (ServerStatusBanner 표시)
 */
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useActivityLogger } from "@/hooks/useActivityLogger";

interface PdaAuthGuardProps {
  children: React.ReactNode;
}

export default function PdaAuthGuard({ children }: PdaAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, token } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  // PDA 페이지 접속 활동 로그 전송
  useActivityLogger();

  // PDA 로그인 페이지는 가드 건너뛰기
  const isLoginPage = pathname === "/pda/login";

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  useEffect(() => {
    // 토큰도 없고 인증도 안 된 경우에만 로그인 리다이렉트
    if (hydrated && !isAuthenticated && !token && !isLoginPage) {
      router.replace("/pda/login");
    }
  }, [hydrated, isAuthenticated, token, isLoginPage, router]);

  // 로그인 페이지는 바로 렌더
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // 인증됨 또는 토큰이 있으면(서버 다운이라 검증 실패해도) children 렌더
  // ServerStatusBanner가 에러 안내를 담당
  if (isAuthenticated || token) {
    return <>{children}</>;
  }

  // 토큰도 없고 인증도 안 됨 → 로그인 리다이렉트 대기
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading...
        </p>
      </div>
    </div>
  );
}
