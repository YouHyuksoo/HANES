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
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BookOpen, Star } from "lucide-react";
import { type MenuConfigItem } from "@/config/menuConfig";
import { useMenuTree } from "@/hooks/useMenuTree";
import { useMenuFavorites } from "@/hooks/useMenuFavorites";
import SidebarMenu from "./SidebarMenu";

const HELP_MENU_PATH = "/help";
const HELP_MENU_ITEM: MenuConfigItem = {
  code: "HELP_INDEX",
  labelKey: "help.viewAll",
  path: HELP_MENU_PATH,
  icon: BookOpen,
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
  const { items, isMenuDisabled } = useMenuTree();
  const { favorites, isFavorite, toggleFavorite } = useMenuFavorites();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["DASHBOARD", "FAVORITES"]);

  /** 즐겨찾기 그룹 — 권한 필터를 통과한 leaf만 표시 (없으면 그룹 자체 숨김) */
  const favoritesGroup: MenuConfigItem[] = useMemo(() => {
    const leafByCode = new Map<string, MenuConfigItem>();
    const walk = (arr: MenuConfigItem[]) => {
      for (const x of arr) {
        if (x.path && !x.children) leafByCode.set(x.code, x);
        if (x.children) walk(x.children);
      }
    };
    walk(items);

    const children = favorites
      .map((code) => leafByCode.get(code))
      .filter((x): x is MenuConfigItem => !!x && !isMenuDisabled(x));
    if (children.length === 0) return [];
    return [{ code: "FAVORITES", labelKey: "menu.favorites", icon: Star, children }];
  }, [items, favorites, isMenuDisabled]);

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

  const sidebarWidth = collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed top-[var(--header-height)] left-0 z-30 flex h-[calc(100vh-var(--header-height))] flex-col overflow-hidden bg-surface border-r border-border transition-all duration-300 ease-in-out lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: sidebarWidth }}
      >
        <nav className="min-h-0 flex-1 overflow-y-auto p-3">
          {favoritesGroup.length > 0 && (
            <div className="mb-2 border-b border-border pb-2">
              <SidebarMenu
                items={favoritesGroup}
                collapsed={collapsed}
                pathname={pathname}
                expandedMenus={expandedMenus}
                onToggleMenu={toggleMenu}
                isMenuActive={isMenuActive}
                isMenuDisabled={() => false}
                onClose={onClose}
                t={t}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          )}
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
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        </nav>
        <nav className="flex-shrink-0 border-t border-border bg-surface p-3">
          <SidebarMenu
            items={[HELP_MENU_ITEM]}
            collapsed={collapsed}
            pathname={pathname}
            expandedMenus={expandedMenus}
            onToggleMenu={toggleMenu}
            isMenuActive={isMenuActive}
            isMenuDisabled={() => false}
            onClose={onClose}
            t={t}
          />
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
