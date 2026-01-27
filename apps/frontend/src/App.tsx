/**
 * @file src/App.tsx
 * @description 메인 App 컴포넌트 - 라우터 및 테마 프로바이더 설정
 *
 * 초보자 가이드:
 * 1. **BrowserRouter**: HTML5 History API 기반 라우팅
 * 2. **useThemeStore**: Zustand 기반 테마 상태 관리
 * 3. **useEffect**: 테마 변경 시 HTML class 업데이트
 */
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useComCodes } from '@/hooks/useComCode';
import AppRoutes from '@/routes';

function App() {
  const { theme } = useThemeStore();
  const { fetchMe, isAuthenticated } = useAuthStore();

  // 앱 시작 시 토큰 유효성 검사
  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 공통코드 프리페치 (앱 시작 시 한 번 로드)
  useComCodes();

  // 테마 변경 시 HTML에 dark 클래스 추가/제거
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
