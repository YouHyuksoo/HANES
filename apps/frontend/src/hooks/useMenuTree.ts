"use client";
/**
 * @file src/hooks/useMenuTree.ts
 * @description DB 머지 메뉴 트리 + 권한 판정 — Sidebar, 헤더 메뉴검색 등에서 공유
 */
import { useEffect, useMemo, useCallback } from "react";
import {
  Folder, LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
} from "lucide-react";
import { menuConfig, type MenuConfigItem } from "@/config/menuConfig";
import { useAuthStore } from "@/stores/authStore";
import { useMenuTreeStore } from "@/stores/menuTreeStore";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Package, Factory, ScanLine, Shield, Wrench, Truck,
  Database, FileBox, Cog, Building2, ArrowLeftRight, Warehouse, UserCog,
  ClipboardCheck, ShoppingCart, Monitor, PackageCheck, Ruler, GitBranch,
};

const HELP_MENU_PATH = "/help";

function excludeHelpMenuItems(items: MenuConfigItem[]): MenuConfigItem[] {
  return items.flatMap((item) => {
    if (item.path === HELP_MENU_PATH) return [];
    if (!item.children) return [item];

    const children = excludeHelpMenuItems(item.children);
    if (children.length === 0) return [];

    return [{ ...item, children }];
  });
}

export function useMenuTree() {
  const { user, allowedMenus } = useAuthStore();
  const groups = useMenuTreeStore((s) => s.groups);
  const loadTree = useMenuTreeStore((s) => s.load);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** DB 머지된 트리를 MenuConfigItem 형식으로 변환. groups가 null이면 코드 menuConfig 사용(FOUC fallback). */
  const items: MenuConfigItem[] = useMemo(() => {
    if (!groups) return excludeHelpMenuItems(menuConfig);
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
        for (const leaf of childrenLeaf) result.push(leaf);
        continue;
      }
      result.push({
        code: g.categoryCode,
        labelKey: g.labelKey,
        icon: ICON_MAP[g.iconName || ''] ?? Folder,
        children: childrenLeaf,
      });
    }
    return excludeHelpMenuItems(result);
  }, [groups]);

  const isMenuDisabled = useCallback(
    (item: MenuConfigItem): boolean => {
      if (isAdmin) return false;
      if (item.children) return !item.children.some((child) => allowedMenus.includes(child.code));
      return !allowedMenus.includes(item.code);
    },
    [isAdmin, allowedMenus],
  );

  return { items, isMenuDisabled };
}
