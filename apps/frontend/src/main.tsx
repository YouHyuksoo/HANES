/**
 * @file src/main.tsx
 * @description React 앱 진입점 - DOM 렌더링 및 전역 Provider 설정
 *
 * 초보자 가이드:
 * 1. **StrictMode**: 개발 시 잠재적 문제를 감지
 * 2. **QueryClientProvider**: React Query 전역 상태 관리
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
