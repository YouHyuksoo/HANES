/**
 * @file src/components/layout/PrivateRoute.tsx
 * @description 인증 필요 라우트 보호 컴포넌트
 *
 * 초보자 가이드:
 * 1. **isAuthenticated**: authStore에서 인증 상태 확인
 * 2. **미인증 시**: /login으로 리다이렉트
 * 3. **Outlet**: 하위 라우트 렌더링
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

function PrivateRoute() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default PrivateRoute;
