/**
 * @file src/components/layout/MainLayout.tsx
 * @description 메인 레이아웃 - 헤더 + 사이드바 + 콘텐츠 영역
 *
 * 초보자 가이드:
 * 1. **구조**: 고정 헤더 + 고정 사이드바 + 스크롤 가능한 메인 영역
 * 2. **반응형**: 모바일에서는 사이드바가 오버레이로 표시
 * 3. **Outlet**: React Router의 자식 라우트가 렌더링되는 위치
 */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header onMenuToggle={handleMenuToggle} />

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />

      {/* Main Content */}
      <main
        className="
          pt-[var(--header-height)]
          lg:pl-[var(--sidebar-width)]
          min-h-screen
          transition-all duration-300
        "
      >
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
