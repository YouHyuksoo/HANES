"use client";

/**
 * @file src/components/layout/SidebarMenu.tsx
 * @description 사이드바 메뉴 렌더링 - RBAC 권한 기반 활성/비활성 처리
 *
 * 초보자 가이드:
 * 1. **펼친 상태**: 아이콘 + 텍스트 + 하위메뉴 토글
 * 2. **접힌 상태**: 아이콘만 표시, 호버 시 툴팁으로 메뉴명 확인
 * 3. **비활성 메뉴**: opacity-40 + cursor-not-allowed, 클릭 무시
 * 4. **부모 메뉴**: 하위 중 하나라도 허용이면 펼침 가능
 */
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MenuConfigItem } from "@/config/menuConfig";
import { useTabStore } from "@/stores/tabStore";

interface SidebarMenuProps {
  items: MenuConfigItem[];
  collapsed: boolean;
  pathname: string;
  expandedMenus: string[];
  onToggleMenu: (code: string) => void;
  isMenuActive: (item: MenuConfigItem) => boolean | undefined;
  /** 메뉴 항목이 비활성(권한 없음)인지 판별하는 함수 */
  isMenuDisabled: (item: MenuConfigItem) => boolean;
  onClose?: () => void;
  t: (key: string) => string;
}

export default function SidebarMenu({
  items, collapsed, pathname, expandedMenus, onToggleMenu, isMenuActive, isMenuDisabled, onClose, t,
}: SidebarMenuProps) {
  const addTab = useTabStore((s) => s.addTab);

  const handleMenuClick = (menuItem: { code: string; path: string; labelKey: string }, parentCode: string) => {
    addTab({ id: menuItem.code, path: menuItem.path, labelKey: menuItem.labelKey, parentId: parentCode });
    onClose?.();
  };

  /** 비활성 메뉴에 적용할 클래스 */
  const disabledCls = "opacity-40 cursor-not-allowed";

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const disabled = isMenuDisabled(item);

        return (
          <li key={item.code}>
            {/* 단일 메뉴 (하위 없음) */}
            {item.path && !item.children ? (
              disabled ? (
                <span
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={`
                    flex items-center gap-3 py-2.5 rounded-[var(--radius)]
                    text-sm font-medium select-none ${disabledCls}
                    ${collapsed ? "justify-center px-0" : "px-3"}
                    text-text
                  `}
                >
                  {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </span>
              ) : (
                <Link
                  href={item.path}
                  onClick={() => handleMenuClick(item as { code: string; path: string; labelKey: string }, item.code)}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={`
                    flex items-center gap-3 py-2.5 rounded-[var(--radius)]
                    text-sm font-medium transition-colors duration-200
                    ${collapsed ? "justify-center px-0" : "px-3"}
                    ${pathname === item.path ? "bg-primary text-white" : "text-text hover:bg-background"}
                  `}
                >
                  {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              )
            ) : (
              /* 하위 메뉴가 있는 경우 */
              <>
                <button
                  onClick={() => !disabled && onToggleMenu(item.code)}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={`
                    w-full flex items-center py-2.5 rounded-[var(--radius)]
                    text-sm font-medium transition-colors duration-200
                    ${collapsed ? "justify-center px-0" : "justify-between px-3"}
                    ${disabled ? disabledCls : ""}
                    ${!disabled && isMenuActive(item) ? "bg-primary/10 text-primary" : "text-text hover:bg-background"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </div>
                  {!collapsed && !disabled && (
                    expandedMenus.includes(item.code)
                      ? <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  )}
                </button>

                {/* 하위 메뉴 리스트 (펼친 상태에서만) */}
                {!collapsed && expandedMenus.includes(item.code) && item.children && (
                  <ul className="mt-1 ml-4 pl-4 border-l border-border space-y-1">
                    {item.children.map((child) => {
                      const childDisabled = isMenuDisabled(child);
                      return (
                        <li key={child.code}>
                          {childDisabled ? (
                            <span
                              className={`block px-3 py-2 rounded-[var(--radius)] text-sm select-none ${disabledCls} text-text-muted`}
                            >
                              {t(child.labelKey)}
                            </span>
                          ) : (
                            <Link
                              href={child.path!}
                              onClick={() => handleMenuClick(child as { code: string; path: string; labelKey: string }, item.code)}
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
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
