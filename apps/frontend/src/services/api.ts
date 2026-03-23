/**
 * @file src/services/api.ts
 * @description Axios 인스턴스 설정 및 API 유틸리티
 *
 * 초보자 가이드:
 * 1. **baseURL**: Next.js rewrites를 통해 백엔드로 연결
 * 2. **interceptors**: 요청/응답 전처리 (토큰 추가, 에러 핸들링)
 * 3. **api**: 앱 전체에서 사용하는 axios 인스턴스
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/** API 에러 응답 타입 */
interface ApiErrorResponse {
  message?: string;
  error?: string;
  [key: string]: unknown;
}
import toast from "react-hot-toast";
import { useErrorStore } from "@/stores/errorStore";
import { useAuthStore } from "@/stores/authStore";

// Axios 인스턴스 생성
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터 - 토큰 + X-Company 헤더 추가
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("harness-token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 선택된 회사코드/사업장코드를 X-Company, X-Plant 헤더에 추가
    // Zustand store → localStorage fallback (핫리로드 시 hydration 타이밍 보장)
    const { selectedCompany, selectedPlant } = useAuthStore.getState();
    if (selectedCompany) {
      config.headers["X-Company"] = selectedCompany;
    }
    if (selectedPlant) {
      config.headers["X-Plant"] = selectedPlant;
    }

    // store가 아직 hydration 전이면 localStorage에서 직접 읽기
    if (!selectedCompany || !selectedPlant) {
      try {
        const authData = JSON.parse(localStorage.getItem("harness-auth") || "{}");
        if (!selectedCompany && authData?.state?.selectedCompany) {
          config.headers["X-Company"] = authData.state.selectedCompany;
        }
        if (!selectedPlant && authData?.state?.selectedPlant) {
          config.headers["X-Plant"] = authData.state.selectedPlant;
        }
      } catch { /* 무시 */ }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 응답 인터셉터 - 성공 메시지 + 에러 핸들링
api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toUpperCase();
    const msg = response.data?.message;
    if (msg && method && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      toast.success(msg);
    }
    return response;
  },
  (error: AxiosError) => {
    // 네트워크 에러 (백엔드 미실행, ECONNREFUSED 등)
    if (!error.response) {
      useErrorStore.getState().showError({
        timestamp: new Date().toLocaleString("ko-KR"),
        method: error.config?.method?.toUpperCase() || "UNKNOWN",
        url: error.config?.url || "unknown",
        status: 0,
        message: "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.",
        responseBody: "네트워크 연결 실패 (ECONNREFUSED)",
      });
      return Promise.reject(error);
    }

    const status = error.response.status;
    const data = error.response.data as ApiErrorResponse;
    const serverMessage = data?.message || data?.error || "알 수 없는 오류";

    // 401은 로그인 페이지로 리다이렉트 (모달 불필요)
    if (status === 401) {
      localStorage.removeItem("harness-token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // 요청 바디 추출
    let requestBody: string | undefined;
    try {
      if (error.config?.data) {
        const parsed = typeof error.config.data === "string"
          ? JSON.parse(error.config.data)
          : error.config.data;
        requestBody = JSON.stringify(parsed, null, 2);
      }
    } catch {
      requestBody = String(error.config?.data);
    }

    // 에러 상세 모달 표시
    useErrorStore.getState().showError({
      timestamp: new Date().toLocaleString("ko-KR"),
      method: error.config?.method?.toUpperCase() || "UNKNOWN",
      url: error.config?.url || "unknown",
      status,
      message: serverMessage,
      responseBody: JSON.stringify(data, null, 2),
      requestBody,
    });

    return Promise.reject(error);
  },
);

// API 헬퍼 함수들
export const apiHelpers = {
  uploadFile: async (url: string, file: File, fieldName: string = "file") => {
    const formData = new FormData();
    formData.append(fieldName, file);

    return api.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  downloadFile: async (url: string, filename: string) => {
    const response = await api.get(url, {
      responseType: "blob",
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default api;
