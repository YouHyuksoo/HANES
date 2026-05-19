"use client";
/**
 * @file src/components/layout/Sidebar.tsx
 * @description 사이드바 네비게이션 — DB 머지된 트리 + 코드 fallback
 *
 * 초보자 가이드:
 * 1. useMenuTreeStore.groups가 null이면 코드 menuConfig 그대로 사용 (FOUC fallback)
 * 2. groups 도착 후 카테고리/순서/소속이 DB 기준으로 머지된 트리로 교체
 * 3. __ROOT__ 카테고리의 자식은 평탄화하여 사이드바 최상위에 표시 (DASHBOARD/WORKFLOW)
 * 4. 권한 필터링 로직(allowedMenus + 부모-자식 합)은 그대로 유지
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Folder, LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
} from "lucide-react";
import { menuConfig, type MenuConfigItem } from "@/config/menuConfig";
import { useAuthStore } from "@/stores/authStore";
import { useMenuTreeStore } from "@/stores/menuTreeStore";
import SidebarMenu from "./SidebarMenu";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
};

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function Sidebar({ isOpen, onClose, collapsed }: SidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { user, allowedMenus } = useAuthStore();
  const groups = useMenuTreeStore((s) => s.groups);
  const loadTree = useMenuTreeStore((s) => s.load);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["DASHBOARD"]);
  const isAdmin = user?.role === "ADMIN";

  // 마운트 시 항상 DB에서 갱신 (persist로 캐시된 값이 있어도 최신화)
  // 레이아웃 컴포넌트는 클라이언트 내비게이션 시 재마운트되지 않으므로 호출 1회
  useEffect(() => {
    loadTree();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** DB 머지된 트리를 SidebarMenu가 받는 MenuConfigItem 형식으로 변환. groups가 null이면 코드 menuConfig 사용. */
  const items: MenuConfigItem[] = useMemo(() => {
    if (!groups) return menuConfig;
    const leafLookup = new Map<string, MenuConfigItem>();
    const walk = (arr: MenuConfigItem[]) => {
      for (const x of arr) {
        if (x.path) leafLookup.set(x.code, x);
        if (x.children) walk(x.children);
      }
    };
    walk(menuConfig);

    const result: MenuConfigItem[] = [];
    for (const g of groups) {
      const childrenLeaf = g.children
        .map((c) => leafLookup.get(c.code))
        .filter((x): x is MenuConfigItem => !!x);

      if (g.categoryCode === '__ROOT__') {
        // 단독 메뉴 — 평탄화하여 최상위에 배치
        for (const leaf of childrenLeaf) {
          result.push(leaf);
        }
        continue;
      }
      result.push({
        code: g.categoryCode,
        labelKey: g.labelKey,
        icon: ICON_MAP[g.iconName || ''] ?? Folder,
        children: childrenLeaf,
      });
    }
    return result;
  }, [groups]);

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

  const isMenuDisabled = useCallback(
    (item: MenuConfigItem): boolean => {
      if (isAdmin) return false;
      if (item.children) return !item.children.some((child) => allowedMenus.includes(child.code));
      return !allowedMenus.includes(item.code);
    },
    [isAdmin, allowedMenus],
  );

  const sidebarWidth = collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed top-[var(--header-height)] left-0 z-30 h-[calc(100vh-var(--header-height))] bg-surface border-r border-border overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: sidebarWidth }}
      >
        <nav className="p-3">
          <SidebarMenu
            items={items}
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
