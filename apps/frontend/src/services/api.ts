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
    try {
      const authData = JSON.parse(localStorage.getItem("harness-auth") || "{}");
      if (authData?.state?.selectedCompany) {
        config.headers["X-Company"] = authData.state.selectedCompany;
      }
      if (authData?.state?.selectedPlant) {
        config.headers["X-Plant"] = authData.state.selectedPlant;
      }
    } catch {
      // JSON 파싱 실패 시 무시
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 응답 인터셉터 - 에러 핸들링
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 네트워크 에러 (백엔드 미실행, ECONNREFUSED 등)
    if (!error.response) {
      console.warn(
        `[API] 서버 연결 실패: ${error.config?.url ?? "unknown"} - 백엔드가 실행 중인지 확인하세요.`,
      );
      return Promise.reject(error);
    }

    if (error.response.status === 401) {
      localStorage.removeItem("harness-token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    if (error.response.status === 403) {
      console.error("접근 권한이 없습니다.");
    }

    if (error.response.status >= 500) {
      console.error("서버 오류가 발생했습니다.");
    }

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
