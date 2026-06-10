/**
 * @file src/components/layout/TabKeepAlive.tsx
 * @description 탭 기반 페이지 keep-alive — 열린 탭 페이지들을 레이아웃에서 직접 마운트 유지
 *
 * 왜 이 방식인가:
 * 1. Next App Router는 활성 라우트만 {children}에 렌더하고, 라우트가 바뀌면 비활성 세그먼트를
 *    언마운트한다. children(=LayoutRouter)을 캐시해 숨기는 방식은 라우트 컨텍스트 전파로
 *    비활성 페이지가 강제 언마운트되어 동작하지 않는다(React19/Next15에서 실측 확인).
 * 2. 대신 경로→컴포넌트 레지스트리(pageRegistry.generated.ts)로 열린 탭 페이지들을 레이아웃이
 *    직접 렌더한다. 레지스트리 컴포넌트는 라우트 컨텍스트에 묶이지 않으므로, 같은 컴포넌트
 *    참조 + 안정 key(div key=path)로 React가 인스턴스를 유지 → 입력값·열린 패널 등 상태 보존.
 * 3. 비활성 탭은 display:none으로 숨기되 마운트는 유지한다.
 *
 * 폴백: 활성 경로가 레지스트리에 없으면(드묾) {children}으로 일반 렌더(keep-alive 미적용).
 */
"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useTabStore } from "@/stores/tabStore";
import { pageRegistry } from "./pageRegistry.generated";

export default function TabKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabs = useTabStore((s) => s.tabs);

  const activeInRegistry = pathname in pageRegistry;

  // 마운트 유지 대상: 레지스트리에 있는 열린 탭 경로들 (+ 현재 경로: 탭 등록 전 첫 진입 대비)
  const paths = new Set(
    tabs.map((t) => t.path).filter((p) => p in pageRegistry),
  );
  if (activeInRegistry) paths.add(pathname);

  return (
    <>
      {Array.from(paths).map((path) => {
        const Comp = pageRegistry[path];
        const active = path === pathname;
        return (
          <div
            key={path}
            className="h-full"
            style={{ display: active ? undefined : "none" }}
            aria-hidden={!active}
          >
            <Comp />
          </div>
        );
      })}

      {/* 레지스트리에 없는 활성 경로는 keep-alive 대상이 아니므로 일반 children 렌더 */}
      {!activeInRegistry && <div className="h-full">{children}</div>}
    </>
  );
}
