/**
 * @file src/stores/authStore.ts
 * @description Zustand 기반 인증 상태 관리 스토어
 *
 * 초보자 가이드:
 * 1. **persist**: localStorage에 인증 정보 저장 (harness-auth)
 * 2. **login**: POST /auth/login → 토큰+사용자 저장
 * 3. **logout**: 토큰+사용자 제거 → 로그인 페이지 이동
 * 4. **fetchMe**: GET /auth/me → 토큰 유효성 검증 및 사용자 갱신
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/services/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  empNo: string | null;
  dept: string | null;
  role: string;
  status: string;
  company?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  selectedCompany: string;
  selectedPlant: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** RBAC: 접근 허용된 메뉴 코드 목록 (빈 배열이면 ADMIN = 전체 허용) */
  allowedMenus: string[];

  login: (email: string, password: string, company?: string, plant?: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
    empNo?: string;
    dept?: string;
  }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setCompany: (company: string) => void;
  setPlant: (plant: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      selectedCompany: "",
      selectedPlant: "",
      isAuthenticated: false,
      isLoading: false,
      allowedMenus: [],

      login: async (email: string, password: string, company?: string, plant?: string) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/login", { email, password, company });
          const responseData = res.data?.data ?? res.data;
          const { token, user, allowedMenus } = responseData;

          localStorage.setItem("harness-token", token);

          set({
            user,
            token,
            selectedCompany: company || user.company || "",
            selectedPlant: plant || "",
            isAuthenticated: true,
            isLoading: false,
            allowedMenus: allowedMenus || [],
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/register", data);
          const responseData = res.data?.data ?? res.data;
          const { token, user } = responseData;

          localStorage.setItem("harness-token", token);

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
        localStorage.removeItem("harness-token");
        set({
          user: null,
          token: null,
          selectedCompany: "",
          selectedPlant: "",
          isAuthenticated: false,
          allowedMenus: [],
        });
      },

      setCompany: (company: string) => {
        set({ selectedCompany: company });
      },

      setPlant: (plant: string) => {
        set({ selectedPlant: plant });
      },

      fetchMe: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          const res = await api.get("/auth/me");
          const responseData = res.data?.data ?? res.data;
          const { allowedMenus, ...userData } = responseData;
          set({
            user: userData,
            allowedMenus: allowedMenus || [],
            isAuthenticated: true,
          });
        } catch {
          localStorage.removeItem("harness-token");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: "harness-auth",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        selectedCompany: state.selectedCompany,
        selectedPlant: state.selectedPlant,
        isAuthenticated: state.isAuthenticated,
        allowedMenus: state.allowedMenus,
      }),
    },
  ),
);
