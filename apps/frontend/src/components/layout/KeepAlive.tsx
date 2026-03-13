/**
 * @file src/components/layout/KeepAlive.tsx
 * @description 탭 기반 페이지 캐싱 - 방문한 페이지를 언마운트하지 않고 display:none으로 숨김
 *
 * 초보자 가이드:
 * 1. Next.js App Router는 라우트 변경 시 페이지를 리마운트함 → 상태 초기화
 * 2. KeepAlive는 첫 방문 시 children을 캐시에 저장하고, 재방문 시 캐시된 버전을 보여줌
 * 3. 탭이 닫히면 해당 캐시 엔트리를 제거하여 메모리 누수 방지
 * 4. 캐시된 React element reference가 동일하므로 React가 컴포넌트를 리마운트하지 않음
 */
"use client";

import { usePathname } from "next/navigation";
import { useRef, ReactNode } from "react";
import { useTabStore } from "@/stores/tabStore";

export default function KeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cacheRef = useRef(new Map<string, ReactNode>());
  const tabs = useTabStore((s) => s.tabs);

  // 첫 방문 시에만 캐시에 추가 (재방문 시 기존 캐시 유지 → 상태 보존)
  if (!cacheRef.current.has(pathname)) {
    cacheRef.current.set(pathname, children);
  }

  // 탭에 없는 페이지는 캐시에서 제거 (현재 경로는 제외)
  const tabPaths = new Set(tabs.map((t) => t.path));
  for (const key of cacheRef.current.keys()) {
    if (!tabPaths.has(key) && key !== pathname) {
      cacheRef.current.delete(key);
    }
  }

  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([path, cachedChildren]) => (
        <div
          key={path}
          className="h-full"
          style={{ display: path === pathname ? undefined : "none" }}
        >
          {cachedChildren}
        </div>
      ))}
    </>
  );
}
