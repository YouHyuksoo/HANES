"use client";

/**
 * @file src/components/layout/AuthGuard.tsx
 * @description 인증 보호 컴포넌트 - 미인증 시 로그인 페이지로 리다이렉트
 *
 * 초보자 가이드:
 * 1. **isAuthenticated**: authStore에서 인증 상태 확인
 * 2. **미인증 시**: /login으로 리다이렉트
 * 3. **hydration**: Zustand persist가 localStorage에서 복원 완료될 때까지 대기
 */
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  // Zustand persist hydration 완료 대기
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // 이미 hydration 완료된 경우
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  // hydration 완료 후에만 리다이렉트 판단
  useEffect(() => {
    if (hydrated && !isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
