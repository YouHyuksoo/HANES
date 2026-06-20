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
import { useTabStore, MAX_TABS } from "@/stores/tabStore";
import { getPageComponent } from "./pageRegistry.generated";
import { restoreTabPageState, saveTabPageState } from "./tabPageState";

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
      data-tab-page-state-root
    >
      <Component />
    </div>
  );
});

export default function TabKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabs = useTabStore((s) => s.tabs);
  const rootsRef = useRef(new Map<string, HTMLDivElement | null>());
  const pagesRef = useRef(new Map<string, CachedPage>());
  const pathnameRef = useRef(pathname);
  const [loadedPage, setLoadedPage] = useState<LoadedPage>({ path: pathname, Component: null });
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
      rootsRef.current.delete(path);
    }
  }

  const visiblePages = Array.from(pagesRef.current.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_TABS)
    .sort((a, b) => a.lastSeen - b.lastSeen);

  useEffect(() => {
    pathnameRef.current = pathname;
    const timers: number[] = [];
    const restore = () => restoreTabPageState(pathname, rootsRef.current.get(pathname) ?? null);
    const raf = window.requestAnimationFrame(restore);
    for (const delay of [50, 150, 350, 750]) {
      timers.push(window.setTimeout(restore, delay));
    }

    return () => {
      saveTabPageState(pathname, rootsRef.current.get(pathname) ?? null);
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  useEffect(() => {
    const saveCurrent = () => {
      saveTabPageState(pathnameRef.current, rootsRef.current.get(pathnameRef.current) ?? null);
    };

    document.addEventListener("pointerdown", saveCurrent, true);
    document.addEventListener("keydown", saveCurrent, true);
    document.addEventListener("input", saveCurrent, true);
    document.addEventListener("change", saveCurrent, true);
    window.addEventListener("beforeunload", saveCurrent);
    document.addEventListener("visibilitychange", saveCurrent);

    return () => {
      saveCurrent();
      document.removeEventListener("pointerdown", saveCurrent, true);
      document.removeEventListener("keydown", saveCurrent, true);
      document.removeEventListener("input", saveCurrent, true);
      document.removeEventListener("change", saveCurrent, true);
      window.removeEventListener("beforeunload", saveCurrent);
      document.removeEventListener("visibilitychange", saveCurrent);
    };
  }, []);

  return (
    <>
      {visiblePages.map((page) => (
        <div
          key={page.path}
          ref={(el) => {
            rootsRef.current.set(page.path, el);
          }}
          className="h-full"
          style={{ display: page.path === pathname ? undefined : "none" }}
          aria-hidden={page.path !== pathname}
        >
          <KeepAliveCell active={page.path === pathname} Component={page.Component} />
        </div>
      ))}
      {!currentComponent && <div className="h-full">{children}</div>}
    </>
  );
}
