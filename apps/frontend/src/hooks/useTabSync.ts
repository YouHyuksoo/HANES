/**
 * @file src/hooks/useTabSync.ts
 * @description URL 변경 시 활성 탭을 동기화하는 훅
 *
 * 초보자 가이드:
 * 1. **usePathname()**: Next.js App Router에서 현재 URL 경로를 반환
 * 2. **syncActiveTabByPath**: 경로에 해당하는 탭을 활성 상태로 변경
 * 3. 경로에 해당하는 탭이 없으면(새로고침·딥링크 직접 진입) 메뉴 설정에서 찾아 탭을 자동 등록
 *    — 탭 목록은 비영속이라 재진입 시 초기화되므로, 현재 페이지만 첫 탭으로 복원된다
 * 4. MainLayout에서 한 번만 호출하면 전체 앱에서 동기화 처리됨
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTabStore } from "@/stores/tabStore";
import { findMenuItemByPath } from "@/config/menuConfig";

export function useTabSync() {
  const pathname = usePathname();

  useEffect(() => {
    const { tabs, addTab, syncActiveTabByPath } = useTabStore.getState();
    const matched = tabs.find((t) => t.path === pathname);
    if (matched) {
      syncActiveTabByPath(pathname);
      return;
    }
    const found = findMenuItemByPath(pathname);
    if (found && found.item.path) {
      addTab({
        id: found.item.code,
        path: found.item.path,
        labelKey: found.item.labelKey,
        parentId: found.parentCode,
      });
    }
  }, [pathname]);
}
