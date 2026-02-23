"use client";

/**
 * @file src/components/layout/AuthGuard.tsx
 * @description 인증 + RBAC 권한 보호 컴포넌트
 *
 * 초보자 가이드:
 * 1. **isAuthenticated**: authStore에서 인증 상태 확인
 * 2. **미인증 시**: /login으로 리다이렉트
 * 3. **hydration**: Zustand persist가 localStorage에서 복원 완료될 때까지 대기
 * 4. **RBAC**: URL 접근 시 allowedMenus 기반 권한 체크 (ADMIN은 항상 통과)
 */
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ShieldX } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { useActivityLogger } from "@/hooks/useActivityLogger";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isAuthenticated, user, allowedMenus } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  // 페이지 접속 활동 로그 전송
  useActivityLogger();

  // Zustand persist hydration 완료 대기
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
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

  // --- RBAC: URL 권한 체크 ---
  const isAdmin = user?.role === "ADMIN";
  const menuCode = findMenuCodeByPath(pathname);

  // ADMIN이면 항상 통과, 메뉴 코드를 찾을 수 없는 경로면 통과 (권한 체크 대상 아님)
  if (!isAdmin && menuCode && !allowedMenus.includes(menuCode)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center space-y-4 p-8">
          <ShieldX className="w-16 h-16 mx-auto text-red-400 dark:text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t("auth.noPermission")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {t("auth.noPermissionDesc")}
          </p>
          <button
            onClick={() => router.replace("/dashboard")}
            className="mt-4 px-6 py-2.5 bg-primary text-white rounded-lg
              hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {t("auth.goHome")}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
