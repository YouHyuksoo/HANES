/**
 * @file src/stores/authStore.ts
 * @description Zustand 기반 인증 상태 관리 스토어
 *
 * 초보자 가이드:
 * 1. **persist**: localStorage에 인증 정보 저장 (hanes-auth)
 * 2. **login**: POST /auth/login → 토큰+사용자 저장
 * 3. **logout**: 토큰+사용자 제거 → 로그인 페이지 이동
 * 4. **fetchMe**: GET /auth/me → 토큰 유효성 검증 및 사용자 갱신
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/services/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  empNo: string | null;
  dept: string | null;
  role: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
    empNo?: string;
    dept?: string;
  }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user } = res.data;

          // localStorage에 토큰 저장 (api interceptor에서 사용)
          localStorage.setItem('hanes-token', token);

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/register', data);
          const { token, user } = res.data;

          localStorage.setItem('hanes-token', token);

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('hanes-token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      fetchMe: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          const res = await api.get('/auth/me');
          set({
            user: res.data,
            isAuthenticated: true,
          });
        } catch {
          // 토큰 만료/무효 → 로그아웃 처리
          localStorage.removeItem('hanes-token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'hanes-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
