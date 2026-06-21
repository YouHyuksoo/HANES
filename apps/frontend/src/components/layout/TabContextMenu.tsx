/**
 * @file src/components/layout/TabContextMenu.tsx
 * @description 탭 우클릭 컨텍스트 메뉴 - 닫기/다른 탭 닫기/모든 탭 닫기
 *
 * 초보자 가이드:
 * 1. **position: fixed**: 마우스 좌표에 메뉴 표시
 * 2. **pinned 탭**: "닫기" 비활성화
 * 3. **외부 클릭/ESC**: 메뉴 자동 닫힘
 */
"use client";

import { useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, Tab } from "@/stores/tabStore";
import { navigateClientOnly } from "./clientNavigation";

interface TabContextMenuProps {
  tab: Tab;
  x: number;
  y: number;
  onClose: () => void;
}

export default function TabContextMenu({ tab, x, y, onClose }: TabContextMenuProps) {
  const { t } = useTranslation();
  const { removeTab, closeOtherTabs, closeAllTabs } = useTabStore();

  // keep-alive: 탭을 닫으면 라우트도 살아남은 활성 탭으로 이동해야 페이지가 사라진다.
  const gotoActiveTab = useCallback(() => {
    const s = useTabStore.getState();
    const active = s.tabs.find((t) => t.id === s.activeTabId);
    if (active) navigateClientOnly(active.path);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", onClose);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", onClose);
    };
  }, [handleKeyDown, onClose]);

  const menuItems = [
    {
      label: t("tabs.close"),
      disabled: !!tab.pinned,
      disabledReason: tab.pinned ? "현재 고정된 탭은 닫을 수 없습니다." : "",
      onClick: () => { removeTab(tab.id); gotoActiveTab(); onClose(); },
    },
    {
      label: t("tabs.closeOthers"),
      disabled: false,
      disabledReason: "",
      onClick: () => { closeOtherTabs(tab.id); gotoActiveTab(); onClose(); },
    },
    {
      label: t("tabs.closeAll"),
      disabled: false,
      disabledReason: "",
      onClick: () => { closeAllTabs(); gotoActiveTab(); onClose(); },
    },
  ];

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-[var(--radius)] border border-border
        bg-popover p-1 shadow-md animate-fade-in"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          disabled={item.disabled}
          onClick={item.onClick}
          title={item.disabled ? item.disabledReason : item.label}
          className="w-full text-left px-3 py-1.5 text-sm rounded-[var(--radius-sm)]
            transition-colors duration-150
            text-popover-foreground hover:bg-accent hover:text-accent-foreground
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
