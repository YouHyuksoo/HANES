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
 *
 * 성능:
 * - 각 페이지 셀을 React.memo(KeepAliveCell)로 격리한다. 탭 추가/전환으로 이 컴포넌트가
 *   리렌더돼도 표시 여부(active)가 바뀐 셀만 리렌더되고, 나머지 열린 페이지(무거운 그리드 등)는
 *   리렌더를 건너뛴다. memo 없이는 새 탭을 열 때마다 열린 모든 페이지가 동시 리렌더돼 메인
 *   스레드가 막히고 새 화면이 한참 뒤에 떴다.
 * - 동시 마운트 수를 MAX_ALIVE개로 제한한다(LRU). 그 이상은 가장 오래 보지 않은 탭부터
 *   언마운트해 DOM/메모리 누적을 막는다(재방문 시 다시 마운트되며 상태는 초기화).
 */
"use client";

import { usePathname } from "next/navigation";
import { memo, useRef, type ComponentType, type ReactNode } from "react";
import { useTabStore } from "@/stores/tabStore";
import { pageRegistry } from "./pageRegistry.generated";

/** 동시 마운트 유지 상한(활성 포함). tabStore MAX_TABS(10) 이하로 둬 누적 부담을 막는다. */
const MAX_ALIVE = 10;

/**
 * keep-alive 페이지 셀. props(Comp, active)가 바뀔 때만 리렌더된다.
 * Comp는 모듈 레벨 pageRegistry의 안정 참조라, 표시 여부(active)가 그대로면 memo가 리렌더를 막는다.
 */
const KeepAliveCell = memo(function KeepAliveCell({
  Comp,
  active,
}: {
  Comp: ComponentType;
  active: boolean;
}) {
  return (
    <div
      className="h-full"
      style={{ display: active ? undefined : "none" }}
      aria-hidden={!active}
    >
      <Comp />
    </div>
  );
});

export default function TabKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabs = useTabStore((s) => s.tabs);

  const activeInRegistry = pathname in pageRegistry;

  // 열린 탭 중 레지스트리에 등록된 경로(탭 표시 순서 유지, 중복 path 제거)
  const openPaths = Array.from(
    new Set(tabs.map((t) => t.path).filter((p) => p in pageRegistry)),
  );

  // LRU: 최근 활성화된 경로일수록 앞. 마운트 유지 한도 적용 기준이다.
  // 렌더 중 갱신이지만 입력(pathname/openPaths)에만 의존하는 idempotent 연산이라 안전하다.
  const lruRef = useRef<string[]>([]);
  if (activeInRegistry) {
    lruRef.current = [pathname, ...lruRef.current.filter((p) => p !== pathname)];
  }
  const openSet = new Set(openPaths);
  lruRef.current = lruRef.current.filter((p) => openSet.has(p)); // 닫힌 탭 정리

  // 마운트 유지 대상: LRU 상위 MAX_ALIVE개(활성 경로는 항상 포함)
  const aliveSet = new Set(lruRef.current.slice(0, MAX_ALIVE));
  if (activeInRegistry) aliveSet.add(pathname);

  return (
    <>
      {openPaths
        .filter((p) => aliveSet.has(p))
        .map((path) => (
          <KeepAliveCell
            key={path}
            Comp={pageRegistry[path]}
            active={path === pathname}
          />
        ))}

      {/* 레지스트리에 없는 활성 경로는 keep-alive 대상이 아니므로 일반 children 렌더 */}
      {!activeInRegistry && <div className="h-full">{children}</div>}
    </>
  );
}
