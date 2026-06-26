/**
 * @file src/components/layout/TabKeepAlive.tsx
 * @description 탭 본문 렌더러
 *
 * pageRegistry.generated.ts가 모든 페이지 dynamic 컴포넌트를 top-level에서 만들면 Next dev 서버가
 * 메뉴 클릭 시 authenticated page 전체를 on-demand compile 대상으로 잡아 화면 열림이 수십 초 지연된다.
 * getPageComponent(path)는 실제 방문한 경로의 작은 registry만 import하므로, 열린 탭의
 * React state를 보존하면서 전체 page compile 폭주를 피한다.
 */
"use client";

import { memo, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTabStore, useMaxTabs } from "@/stores/tabStore";
import { getPageComponent } from "./pageRegistry.generated";

type CachedPage = {
  path: string;
  Component: ComponentType;
  lastSeen: number;
};

type LoadedPage = {
  path: string;
  Component: ComponentType | null;
};

const KeepAliveCell = memo(function KeepAliveCell({
  active,
  Component,
}: {
  active: boolean;
  Component: ComponentType;
}) {
  return (
    <div
      className="h-full"
      style={{ display: active ? undefined : "none" }}
      aria-hidden={!active}
    >
      <Component />
    </div>
  );
});

export default function TabKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabs = useTabStore((s) => s.tabs);
  const maxTabs = useMaxTabs();
  const pagesRef = useRef(new Map<string, CachedPage>());
  // path:"" 초기값 — registry resolve 전(로딩 중)과 resolve 후 컴포넌트 없음(미등록)을 구분한다.
  const [loadedPage, setLoadedPage] = useState<LoadedPage>({ path: "", Component: null });
  const cachedCurrentPage = pagesRef.current.get(pathname);
  const currentComponent =
    cachedCurrentPage?.Component ??
    (loadedPage.path === pathname ? loadedPage.Component : null);

  useEffect(() => {
    let cancelled = false;
    getPageComponent(pathname).then((Component) => {
      if (!cancelled) setLoadedPage({ path: pathname, Component });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (currentComponent) {
    const cachedPage = pagesRef.current.get(pathname);
    if (cachedPage) {
      cachedPage.lastSeen = Date.now();
    } else {
      pagesRef.current.set(pathname, {
        path: pathname,
        Component: currentComponent,
        lastSeen: Date.now(),
      });
    }
  }

  const openPathSet = useMemo(() => new Set(tabs.map((tab) => tab.path)), [tabs]);
  for (const path of Array.from(pagesRef.current.keys())) {
    if (path !== pathname && !openPathSet.has(path)) {
      pagesRef.current.delete(path);
    }
  }

  const visiblePages = Array.from(pagesRef.current.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, maxTabs)
    .sort((a, b) => a.lastSeen - b.lastSeen);

  return (
    <>
      {visiblePages.map((page) => (
        <div
          key={page.path}
          className="h-full"
          style={{ display: page.path === pathname ? undefined : "none" }}
          aria-hidden={page.path !== pathname}
        >
          <KeepAliveCell active={page.path === pathname} Component={page.Component} />
        </div>
      ))}
      {!currentComponent &&
        (loadedPage.path === pathname ? (
          // registry resolve 완료 + 컴포넌트 없음(미등록 경로)일 때만 App Router children 사용
          <div className="h-full">{children}</div>
        ) : (
          // registry 로딩 중 — children을 마운트하면 keep-alive 컴포넌트와 2중 마운트되어 API가 중복 호출됨
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ))}
    </>
  );
}
