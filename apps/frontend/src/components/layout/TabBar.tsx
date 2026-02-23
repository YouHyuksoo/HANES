/**
 * @file src/components/layout/TabBar.tsx
 * @description 앱 내 탭 바 - 열린 페이지 탭 목록, 클릭으로 페이지 이동
 *
 * 초보자 가이드:
 * 1. **sticky**: 헤더 아래에 고정, 스크롤해도 항상 보임
 * 2. **가로 스크롤**: 탭이 많으면 좌우 화살표 + 휠 스크롤
 * 3. **우클릭**: 컨텍스트 메뉴 (닫기, 다른 탭 닫기, 모든 탭 닫기)
 * 4. **pinned 탭**: 닫기 버튼 없음 (대시보드)
 */
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTabStore, Tab } from "@/stores/tabStore";
import { menuConfig } from "@/config/menuConfig";
import { useTabSync } from "@/hooks/useTabSync";
import TabContextMenu from "./TabContextMenu";

/** 부모 메뉴의 아이콘 컴포넌트를 찾아 반환 */
function getParentIcon(parentId: string) {
  const parent = menuConfig.find((m) => m.code === parentId);
  return parent?.icon ?? null;
}

const SCROLL_AMOUNT = 200;

export default function TabBar() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ tab: Tab; x: number; y: number } | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  useTabSync();

  /** 스크롤 위치에 따라 화살표 표시 여부 갱신 */
  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
  }, [tabs, updateArrows]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows);
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -SCROLL_AMOUNT, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" });
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id);
    router.push(tab.path);
  };

  const handleContextMenu = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    setCtxMenu({ tab, x: e.clientX, y: e.clientY });
  };

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        className="sticky top-[var(--header-height)] z-[25] hidden lg:flex
          items-center bg-background border-b border-border relative"
        style={{ height: "var(--tab-bar-height)" }}
      >
        {/* 왼쪽 화살표 */}
        {showLeftArrow && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 z-10 h-full px-1
              bg-background/90 border-r border-border
              hover:bg-muted/60 transition-colors
              flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-text-muted" />
          </button>
        )}

        {/* 탭 목록 */}
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="flex items-center h-full overflow-x-auto scrollbar-hide flex-1"
          style={{
            paddingLeft: showLeftArrow ? 24 : 0,
            paddingRight: showRightArrow ? 24 : 0,
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = getParentIcon(tab.parentId);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                title={tab.pinned ? t("tabs.pinnedTooltip") : t(tab.labelKey)}
                className={`group relative flex items-center gap-1.5 px-3 h-full
                  text-sm font-medium whitespace-nowrap transition-colors duration-150
                  border-b-2 shrink-0
                  ${isActive
                    ? "border-primary text-primary bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{t(tab.labelKey)}</span>

                {!tab.pinned && (
                  <span
                    onClick={(e) => handleClose(e, tab.id)}
                    className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100
                      hover:bg-destructive/10 hover:text-destructive
                      transition-opacity duration-150"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 오른쪽 화살표 */}
        {showRightArrow && (
          <button
            onClick={scrollRight}
            className="absolute right-0 z-10 h-full px-1
              bg-background/90 border-l border-border
              hover:bg-muted/60 transition-colors
              flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </button>
        )}
      </div>

      {ctxMenu && (
        <TabContextMenu
          tab={ctxMenu.tab}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}
