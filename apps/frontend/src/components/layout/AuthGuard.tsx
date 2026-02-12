"use client";

/**
 * @file src/components/layout/AuthGuard.tsx
 * @description 인증 보호 컴포넌트 - 미인증 시 로그인 페이지로 리다이렉트
 *
 * 초보자 가이드:
 * 1. **isAuthenticated**: authStore에서 인증 상태 확인
 * 2. **미인증 시**: /login으로 리다이렉트
 * 3. **로딩 상태**: 인증 확인 중 스피너 표시
 */
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
