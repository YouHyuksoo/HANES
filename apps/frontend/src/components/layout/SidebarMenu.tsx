"use client";

/**
 * @file src/components/layout/SidebarMenu.tsx
 * @description 사이드바 메뉴 렌더링 - 접힌/펼친 상태에 따라 UI 변경
 *
 * 초보자 가이드:
 * 1. **펼친 상태**: 아이콘 + 텍스트 + 하위메뉴 토글
 * 2. **접힌 상태**: 아이콘만 표시, 호버 시 툴팁으로 메뉴명 확인
 */
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MenuItem } from "./Sidebar";

interface SidebarMenuProps {
  items: MenuItem[];
  collapsed: boolean;
  pathname: string;
  expandedMenus: string[];
  onToggleMenu: (id: string) => void;
  isMenuActive: (item: MenuItem) => boolean | undefined;
  onClose?: () => void;
  t: (key: string) => string;
}

export default function SidebarMenu({
  items, collapsed, pathname, expandedMenus, onToggleMenu, isMenuActive, onClose, t,
}: SidebarMenuProps) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          {/* 단일 메뉴 (하위 없음) */}
          {item.path && !item.children ? (
            <Link
              href={item.path}
              onClick={onClose}
              title={collapsed ? t(item.labelKey) : undefined}
              className={`
                flex items-center gap-3 py-2.5 rounded-[var(--radius)]
                text-sm font-medium transition-colors duration-200
                ${collapsed ? "justify-center px-0" : "px-3"}
                ${pathname === item.path ? "bg-primary text-white" : "text-text hover:bg-background"}
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </Link>
          ) : (
            /* 하위 메뉴가 있는 경우 */
            <>
              <button
                onClick={() => onToggleMenu(item.id)}
                title={collapsed ? t(item.labelKey) : undefined}
                className={`
                  w-full flex items-center py-2.5 rounded-[var(--radius)]
                  text-sm font-medium transition-colors duration-200
                  ${collapsed ? "justify-center px-0" : "justify-between px-3"}
                  ${isMenuActive(item) ? "bg-primary/10 text-primary" : "text-text hover:bg-background"}
                `}
              >
                <div className={`flex items-center gap-3 ${collapsed ? "" : ""}`}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </div>
                {!collapsed && (
                  expandedMenus.includes(item.id)
                    ? <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
              </button>

              {/* 하위 메뉴 리스트 (펼친 상태에서만) */}
              {!collapsed && expandedMenus.includes(item.id) && item.children && (
                <ul className="mt-1 ml-4 pl-4 border-l border-border space-y-1">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={child.path}
                        onClick={onClose}
                        className={`
                          block px-3 py-2 rounded-[var(--radius)] text-sm transition-colors duration-200
                          ${pathname === child.path
                            ? "bg-primary text-white"
                            : "text-text-muted hover:text-text hover:bg-background"
                          }
                        `}
                      >
                        {t(child.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
