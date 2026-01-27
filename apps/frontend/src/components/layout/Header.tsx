/**
 * @file src/components/layout/Header.tsx
 * @description 상단 헤더 컴포넌트 - 로고, 검색, 사용자 정보, 테마 토글
 *
 * 초보자 가이드:
 * 1. **고정 헤더**: 스크롤해도 항상 상단에 고정
 * 2. **테마 토글**: 다크/라이트 모드 전환 버튼
 * 3. **사용자 메뉴**: 드롭다운 형태로 프로필/로그아웃
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, Search, User, LogOut, Settings, Menu } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import Input from '@/components/ui/Input';

interface HeaderProps {
  onMenuToggle?: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    navigate('/login', { replace: true });
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
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5 text-text" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="font-semibold text-lg text-text hidden sm:block">
            HANES MES
          </span>
        </div>
      </div>

      {/* Center Section - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <Input
          placeholder="검색 (Ctrl+K)"
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
          className="bg-background"
        />
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        {/* 알림 */}
        <button
          className="relative p-2 rounded-md hover:bg-background transition-colors"
          aria-label="알림"
        >
          <Bell className="w-5 h-5 text-text-muted" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
        </button>

        {/* 테마 토글 */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-background transition-colors"
          aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-accent" />
          ) : (
            <Moon className="w-5 h-5 text-text-muted" />
          )}
        </button>

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
              {user?.name || user?.email || '사용자'}
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
                  className="
                    w-full px-4 py-2 text-left text-sm
                    text-text hover:bg-background
                    flex items-center gap-2
                  "
                >
                  <User className="w-4 h-4" />
                  프로필
                </button>
                <button
                  className="
                    w-full px-4 py-2 text-left text-sm
                    text-text hover:bg-background
                    flex items-center gap-2
                  "
                >
                  <Settings className="w-4 h-4" />
                  설정
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
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
