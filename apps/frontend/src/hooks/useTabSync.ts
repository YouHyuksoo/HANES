/**
 * @file src/hooks/useTabSync.ts
 * @description URL 변경 시 활성 탭을 동기화하는 훅
 *
 * 초보자 가이드:
 * 1. **usePathname()**: Next.js App Router에서 현재 URL 경로를 반환
 * 2. **syncActiveTabByPath**: 경로에 해당하는 탭을 활성 상태로 변경
 * 3. MainLayout에서 한 번만 호출하면 전체 앱에서 동기화 처리됨
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTabStore } from "@/stores/tabStore";

export function useTabSync() {
  const pathname = usePathname();
  const syncActiveTabByPath = useTabStore((s) => s.syncActiveTabByPath);

  useEffect(() => {
    syncActiveTabByPath(pathname);
  }, [pathname, syncActiveTabByPath]);
}
