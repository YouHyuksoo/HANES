/**
 * @file src/stores/authStore.ts
 * @description Zustand 기반 인증 상태 관리 스토어
 *
 * 초보자 가이드:
 * 1. **persist**: localStorage에 인증 정보 저장 (harness-auth)
 * 2. **login**: POST /auth/login → 토큰+사용자 저장
 * 3. **logout**: 토큰+사용자 제거 → 로그인 페이지 이동
 * 4. **fetchMe**: GET /auth/me → 토큰 유효성 검증 및 사용자 갱신
 * 5. **currentWorker**: PDA 작업자 로그인 상태 (persist 포함, 앱 재시작 후에도 유지)
 * 6. **pdaAllowedMenus**: PDA 작업자에게 허용된 메뉴 코드 목록
 * 7. **setCurrentWorker**: PDA 작업자 설정
 * 8. **clearCurrentWorker**: PDA 작업자 해제
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

/** PDA 작업자 정보 */
export interface CurrentWorker {
  id: number;
  name: string;
  workerCode: string;
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
  /** PDA: 현재 로그인된 작업자 정보 (앱 재시작 후에도 유지) */
  currentWorker: CurrentWorker | null;
  /** PDA: 작업자에게 허용된 메뉴 코드 목록 */
  pdaAllowedMenus: string[];

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
  /** PDA 작업자 설정 */
  setCurrentWorker: (worker: CurrentWorker) => void;
  /** PDA 작업자 해제 */
  clearCurrentWorker: () => void;
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
      currentWorker: null,
      pdaAllowedMenus: [],

      login: async (email: string, password: string, company?: string, plant?: string) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/login", { email, password, company });
          const responseData = res.data?.data ?? res.data;
          const { token, user, allowedMenus, pdaAllowedMenus } = responseData;

          localStorage.setItem("harness-token", token);

          set({
            user,
            token,
            selectedCompany: company || user.company || "",
            selectedPlant: plant || "",
            isAuthenticated: true,
            isLoading: false,
            allowedMenus: allowedMenus || [],
            pdaAllowedMenus: pdaAllowedMenus || [],
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
          currentWorker: null,
          pdaAllowedMenus: [],
        });
      },

      setCompany: (company: string) => {
        set({ selectedCompany: company });
      },

      setPlant: (plant: string) => {
        set({ selectedPlant: plant });
      },

      setCurrentWorker: (worker: CurrentWorker) => {
        set({ currentWorker: worker });
      },

      clearCurrentWorker: () => {
        set({ currentWorker: null, pdaAllowedMenus: [] });
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
          const { allowedMenus, pdaAllowedMenus, ...userData } = responseData;
          set({
            user: userData,
            allowedMenus: allowedMenus || [],
            pdaAllowedMenus: pdaAllowedMenus || [],
            isAuthenticated: true,
          });
        } catch (error: any) {
          const status = error?.response?.status;
          const isServerError =
            status === 500 || status === 502 || status === 503 || status === 504;
          const isNetworkError = !error.response && error.code !== "ERR_CANCELED";

          if (isServerError || isNetworkError) {
            // 서버 다운/DB 타임아웃 시 기존 캐시된 인증 상태 유지
            // ServerStatusBanner가 에러를 표시하도록 함
            return;
          }

          // 401 등 인증 실패만 로그아웃 처리
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
        currentWorker: state.currentWorker,
        pdaAllowedMenus: state.pdaAllowedMenus,
      }),
    },
  ),
);
