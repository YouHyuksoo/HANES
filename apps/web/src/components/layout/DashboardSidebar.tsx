/**
 * @file src/components/layout/DashboardSidebar.tsx
 * @description
 * 대시보드 사이드바 컴포넌트입니다.
 * MES 메뉴를 계층형(Collapsible)으로 표시합니다.
 *
 * 초보자 가이드:
 * 1. **계층 메뉴**: 상위 메뉴 클릭 시 하위 메뉴 펼침/접힘
 * 2. **Collapsible**: Radix UI의 접힘 컴포넌트 사용
 * 3. **다국어**: useTranslation으로 메뉴명 번역
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Package,
  FileBox,
  Scissors,
  Wrench,
  Factory,
  Zap,
  ClipboardCheck,
  Boxes,
  Settings,
  Truck,
  ArrowLeftRight,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 메뉴 아이템 타입 */
interface MenuItem {
  id: string;
  labelKey: string;
  href?: string;
  icon: React.ElementType;
  children?: Omit<MenuItem, "icon" | "children">[];
}

/** MES 메뉴 구조 */
const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    labelKey: "menu.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "material",
    labelKey: "menu.material",
    icon: Package,
    children: [
      { id: "material-receiving", labelKey: "menu.material.receiving", href: "/dashboard/material/receiving" },
      { id: "material-stock", labelKey: "menu.material.stock", href: "/dashboard/material/stock" },
      { id: "material-inventory", labelKey: "menu.material.inventory", href: "/dashboard/material/inventory" },
      { id: "material-adjustment", labelKey: "menu.material.adjustment", href: "/dashboard/material/adjustment" },
    ],
  },
  {
    id: "bonded",
    labelKey: "menu.bonded",
    icon: FileBox,
    children: [
      { id: "bonded-import", labelKey: "menu.bonded.import", href: "/dashboard/bonded/import" },
      { id: "bonded-history", labelKey: "menu.bonded.history", href: "/dashboard/bonded/history" },
    ],
  },
  {
    id: "cutting",
    labelKey: "menu.cutting",
    icon: Scissors,
    children: [
      { id: "cutting-workOrder", labelKey: "menu.cutting.workOrder", href: "/dashboard/cutting/work-order" },
      { id: "cutting-result", labelKey: "menu.cutting.result", href: "/dashboard/cutting/result" },
    ],
  },
  {
    id: "crimping",
    labelKey: "menu.crimping",
    icon: Wrench,
    children: [
      { id: "crimping-mold", labelKey: "menu.crimping.mold", href: "/dashboard/crimping/mold" },
      { id: "crimping-result", labelKey: "menu.crimping.result", href: "/dashboard/crimping/result" },
    ],
  },
  {
    id: "production",
    labelKey: "menu.production",
    icon: Factory,
    children: [
      { id: "production-workOrder", labelKey: "menu.production.workOrder", href: "/dashboard/production/work-order" },
      { id: "production-result", labelKey: "menu.production.result", href: "/dashboard/production/result" },
      { id: "production-semiProduct", labelKey: "menu.production.semiProduct", href: "/dashboard/production/semi-product" },
    ],
  },
  {
    id: "inspection",
    labelKey: "menu.inspection",
    href: "/dashboard/inspection",
    icon: Zap,
  },
  {
    id: "quality",
    labelKey: "menu.quality",
    icon: ClipboardCheck,
    children: [
      { id: "quality-firstLast", labelKey: "menu.quality.firstLast", href: "/dashboard/quality/first-last" },
      { id: "quality-defect", labelKey: "menu.quality.defect", href: "/dashboard/quality/defect" },
      { id: "quality-repair", labelKey: "menu.quality.repair", href: "/dashboard/quality/repair" },
    ],
  },
  {
    id: "consumable",
    labelKey: "menu.consumable",
    href: "/dashboard/consumable",
    icon: Boxes,
  },
  {
    id: "equipment",
    labelKey: "menu.equipment",
    href: "/dashboard/equipment",
    icon: Settings,
  },
  {
    id: "outsourcing",
    labelKey: "menu.outsourcing",
    href: "/dashboard/outsourcing",
    icon: Truck,
  },
  {
    id: "shipping",
    labelKey: "menu.shipping",
    href: "/dashboard/shipping",
    icon: ArrowLeftRight,
  },
  {
    id: "interface",
    labelKey: "menu.interface",
    href: "/dashboard/interface",
    icon: ArrowLeftRight,
  },
  {
    id: "master",
    labelKey: "menu.master",
    icon: Database,
    children: [
      { id: "master-commonCode", labelKey: "menu.master.commonCode", href: "/dashboard/master/common-code" },
      { id: "master-factory", labelKey: "menu.master.factory", href: "/dashboard/master/factory" },
      { id: "master-item", labelKey: "menu.master.item", href: "/dashboard/master/item" },
      { id: "master-auth", labelKey: "menu.master.auth", href: "/dashboard/master/auth" },
    ],
  },
];

interface DashboardSidebarProps {
  collapsed?: boolean;
}

export function DashboardSidebar({ collapsed = false }: DashboardSidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  // 메뉴 펼침/접힘 토글
  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  // 현재 경로가 메뉴에 포함되는지 확인
  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // 하위 메뉴 중 활성화된 것이 있는지 확인
  const hasActiveChild = (children?: Omit<MenuItem, "icon" | "children">[]) => {
    if (!children) return false;
    return children.some((child) => isActive(child.href));
  };

  return (
    <aside
      className={cn(
        "h-full bg-sidebar border-r border-sidebar-border",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* 로고 영역 */}
      <div className="h-16 flex items-center justify-center border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">H</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-foreground">
              HANES MES
            </span>
          )}
        </Link>
      </div>

      {/* 메뉴 리스트 */}
      <nav className="p-2 overflow-y-auto h-[calc(100%-4rem)]">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus.includes(item.id);
            const active = isActive(item.href) || hasActiveChild(item.children);

            return (
              <li key={item.id}>
                {/* 상위 메뉴 */}
                {hasChildren ? (
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                      "text-sidebar-foreground hover:bg-sidebar-accent/10",
                      "transition-colors duration-150",
                      active && "bg-sidebar-accent/20 text-sidebar-primary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm font-medium">
                          {t(item.labelKey)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href || "#"}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                      "text-sidebar-foreground hover:bg-sidebar-accent/10",
                      "transition-colors duration-150",
                      active && "bg-sidebar-primary text-sidebar-primary-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium">{t(item.labelKey)}</span>
                    )}
                  </Link>
                )}

                {/* 하위 메뉴 */}
                {hasChildren && isExpanded && !collapsed && (
                  <ul className="mt-1 ml-4 pl-4 border-l border-sidebar-border space-y-1">
                    {item.children?.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href || "#"}
                          className={cn(
                            "block px-3 py-2 rounded-lg text-sm",
                            "text-sidebar-foreground hover:bg-sidebar-accent/10",
                            "transition-colors duration-150",
                            isActive(child.href) &&
                              "bg-sidebar-primary text-sidebar-primary-foreground"
                          )}
                        >
                          {t(child.labelKey)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
