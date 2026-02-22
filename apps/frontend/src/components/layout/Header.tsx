"use client";

/**
 * @file src/components/layout/Header.tsx
 * @description 상단 헤더 컴포넌트 - 로고, 검색, 사용자 정보, 테마 토글
 *
 * 초보자 가이드:
 * 1. **고정 헤더**: 스크롤핏도 항상 상단에 고정
 * 2. **테마 토글**: 다크/라이트 모드 전환 버튼
 * 3. **사용자 메뉴**: 드롭다운 형태로 프로필/로그아웃
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Bell, Search, User, LogOut, Settings, Menu, PanelLeftClose, PanelLeftOpen, Building, BadgeCheck, Building2, Mail } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import LanguageSwitcher from "./LanguageSwitcher";
import SerialIndicator from "./SerialIndicator";

interface HeaderProps {
  onMenuToggle?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function Header({ onMenuToggle, collapsed, onToggleCollapse }: HeaderProps) {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, selectedCompany, selectedPlant } = useAuthStore();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    router.replace("/login");
  };

  return (
    <header
      className="
        fixed top-0 left-0 right-0 z-40
        h-[var(--header-height)]
        bg-surface border-b border-border
        flex items-center justify-between
        px-4
      "
    >
      {/* Left Section - Logo & Menu Toggle */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-md lg:hidden hover:bg-background transition-colors"
          aria-label={t('header.openMenu')}
        >
          <Menu className="w-5 h-5 text-text" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="font-semibold text-lg text-text hidden sm:block">
            HARNESS MES
          </span>
        </div>

        {/* 사이드바 접기/펴기 (데스크톱) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-md hover:bg-background transition-colors"
            aria-label={collapsed ? t('header.expandSidebar') : t('header.collapseSidebar')}
          >
            {collapsed
              ? <PanelLeftOpen className="w-5 h-5 text-text-muted" />
              : <PanelLeftClose className="w-5 h-5 text-text-muted" />
            }
          </button>
        )}
      </div>

      {/* Center Section - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <Input
          placeholder={t('header.searchPlaceholder')}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
          className="bg-background"
        />
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        {/* 바코드 스캐너 연결 상태 */}
        <SerialIndicator />

        {/* 알림 */}
        <button
          className="relative p-2 rounded-md hover:bg-background transition-colors"
          aria-label={t('header.notifications')}
        >
          <Bell className="w-5 h-5 text-text-muted" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
        </button>

        {/* 테마 토글 */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-background transition-colors"
          aria-label={isDark ? t('header.switchToLight') : t('header.switchToDark')}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-accent" />
          ) : (
            <Moon className="w-5 h-5 text-text-muted" />
          )}
        </button>

        {/* 언어 전환 */}
        <LanguageSwitcher />

        {/* 현재 회사 + 사업장 표시 */}
        {selectedCompany && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-md">
            <Building className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary">
              {selectedCompany}{selectedPlant ? ` / ${selectedPlant}` : ''}
            </span>
          </div>
        )}

        {/* 사용자 메뉴 */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="
              flex items-center gap-2 p-2
              rounded-md hover:bg-background transition-colors
            "
          >
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="hidden sm:block text-sm font-medium text-text">
              {user?.name || user?.email || t('common.user')}
            </span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                className="
                  absolute right-0 top-full mt-2 z-20
                  w-48 py-1
                  bg-surface border border-border rounded-[var(--radius)]
                  shadow-lg animate-slide-down
                "
              >
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="
                    w-full px-4 py-2 text-left text-sm
                    text-text hover:bg-background
                    flex items-center gap-2
                  "
                >
                  <User className="w-4 h-4" />
                  {t('header.profile')}
                </button>
                <button
                  className="
                    w-full px-4 py-2 text-left text-sm
                    text-text hover:bg-background
                    flex items-center gap-2
                  "
                >
                  <Settings className="w-4 h-4" />
                  {t('header.settings')}
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={handleLogout}
                  className="
                    w-full px-4 py-2 text-left text-sm
                    text-error hover:bg-background
                    flex items-center gap-2
                  "
                >
                  <LogOut className="w-4 h-4" />
                  {t('header.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title={t('header.profile')}
        size="md"
      >
        <div className="flex flex-col items-center py-6">
          {/* Profile Image */}
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-primary" />
          </div>

          {/* User Name */}
          <h3 className="text-xl font-semibold text-text mb-1">
            {user?.name || user?.email || t('common.user')}
          </h3>

          {/* Role Badge */}
          {user?.role && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full mb-6">
              <BadgeCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">{user.role}</span>
            </div>
          )}

          {/* User Info Grid */}
          <div className="w-full grid grid-cols-1 gap-3 mt-2">
            {user?.email && (
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-text-muted">{t('auth.email')}</p>
                  <p className="text-sm font-medium text-text">{user.email}</p>
                </div>
              </div>
            )}

            {user?.empNo && (
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <BadgeCheck className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-text-muted">{t('auth.empNo')}</p>
                  <p className="text-sm font-medium text-text">{user.empNo}</p>
                </div>
              </div>
            )}

            {user?.dept && (
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-text-muted">{t('auth.dept')}</p>
                  <p className="text-sm font-medium text-text">{user.dept}</p>
                </div>
              </div>
            )}

            {selectedCompany && (
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-text-muted">{t('menu.master.company')}</p>
                  <p className="text-sm font-medium text-text">
                    {selectedCompany}{selectedPlant ? ` / ${selectedPlant}` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </header>
  );
}

export default Header;
