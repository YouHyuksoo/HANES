"use client";

/**
 * @file src/components/layout/Sidebar.tsx
 * @description 사이드바 네비게이션 - RBAC 권한 기반 메뉴 활성/비활성 처리
 *
 * 초보자 가이드:
 * 1. **메뉴 구조**: menuConfig에서 가져온 설정 기반 렌더링
 * 2. **접기/펴기**: 우측 가장자리 핸들로 사이드바 축소/확장
 * 3. **접힌 상태**: 아이콘만 표시, 호버 시 툴팁
 * 4. **RBAC**: ADMIN은 전체 메뉴 활성, 일반 사용자는 allowedMenus 기반 활성
 */
import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { menuConfig, type MenuConfigItem } from "@/config/menuConfig";
import { useAuthStore } from "@/stores/authStore";
import SidebarMenu from "./SidebarMenu";

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { user, allowedMenus } = useAuthStore();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["DASHBOARD"]);
  const isAdmin = user?.role === "ADMIN";

  const toggleMenu = (menuCode: string) => {
    if (collapsed) return;
    setExpandedMenus((prev) =>
      prev.includes(menuCode) ? prev.filter((c) => c !== menuCode) : [...prev, menuCode]
    );
  };

  const isMenuActive = (item: MenuConfigItem) => {
    if (item.path) return pathname === item.path;
    return item.children?.some((child) => pathname === child.path);
  };

  /** 메뉴 항목이 비활성(권한 없음) 상태인지 판별 */
  const isMenuDisabled = useCallback(
    (item: MenuConfigItem): boolean => {
      if (isAdmin) return false;
      // 하위 메뉴가 있는 부모: 하위 중 하나라도 허용되면 활성
      if (item.children) {
        return !item.children.some((child) => allowedMenus.includes(child.code));
      }
      // 단일 메뉴
      return !allowedMenus.includes(item.code);
    },
    [isAdmin, allowedMenus],
  );

  const sidebarWidth = collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-[var(--header-height)] left-0 z-30
          h-[calc(100vh-var(--header-height))]
          bg-surface border-r border-border
          overflow-y-auto overflow-x-hidden
          transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ width: sidebarWidth }}
      >
        <nav className="p-3">
          <SidebarMenu
            items={menuConfig}
            collapsed={collapsed}
            pathname={pathname}
            expandedMenus={expandedMenus}
            onToggleMenu={toggleMenu}
            isMenuActive={isMenuActive}
            isMenuDisabled={isMenuDisabled}
            onClose={onClose}
            t={t}
          />
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
