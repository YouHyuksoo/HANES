/**
 * @file src/services/api.ts
 * @description Axios 인스턴스 설정 및 API 유틸리티
 *
 * 초보자 가이드:
 * 1. **baseURL**: Next.js rewrites를 통해 백엔드로 연결
 * 2. **interceptors**: 요청/응답 전처리 (토큰 추가, 에러 핸들링)
 * 3. **api**: 앱 전체에서 사용하는 axios 인스턴스
 */
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

/** suppressErrorModal: true 시 에러 모달 표시 안 함 */
declare module "axios" {
  interface AxiosRequestConfig {
    suppressErrorModal?: boolean;
  }
}

/** API 에러 응답 타입 */
interface ApiErrorResponse {
  message?: string;
  error?: string;
  /** 백엔드 HttpExceptionFilter가 채우는 에러 코드 (HTTP_400, DB_CONNECTION_ERROR 등) */
  errorCode?: string;
  [key: string]: unknown;
}

interface SqlDebugQuery {
  sql?: string;
  parameters?: unknown[];
  tables?: string[];
}

interface SqlDebugPayload {
  sql?: string;
  parameters?: unknown[];
  tables?: string[];
  queries?: SqlDebugQuery[];
}

interface CachedSqlDebug {
  sql: string;
  parameters?: unknown[];
  tables: string[];
  sourceUrl?: string;
  recordedAt: number;
}

import toast from "react-hot-toast";
import { useErrorStore } from "@/stores/errorStore";
import { classifyApiError } from "./api-error-severity";
import { useAuthStore } from "@/stores/authStore";

// 응답 인터셉터의 자동 성공 토스트를 끄는 opt-out 플래그.
// 컴포넌트가 자체 토스트(i18n·조건부)를 띄우는 호출에서 { skipSuccessToast: true } 지정 → 중복 토스트 방지.
declare module "axios" {
  interface AxiosRequestConfig {
    skipSuccessToast?: boolean;
    // 응답 인터셉터의 전역 에러 상세 모달을 끄는 opt-out 플래그.
    // 컴포넌트가 자체 toast/인라인 안내로 에러를 처리하는 호출에서 사용.
    suppressErrorModal?: boolean;
  }
}

const READONLY_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const VIEWER_READONLY_MESSAGE = "조회 전용 권한은 데이터를 변경할 수 없습니다.";
const SQL_DEBUG_CACHE_LIMIT = 80;
const sqlDebugCache: CachedSqlDebug[] = [];

const extractSqlTables = (sql: string): string[] => {
  const tables = new Set<string>();
  const tablePattern = /\b(?:FROM|JOIN)\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_$#]*))/gi;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(sql)) !== null) {
    const table = match[1] ?? match[2];
    if (table) {
      tables.add(table.toUpperCase());
    }
  }

  return [...tables];
};

const formatActualSql = (entry: CachedSqlDebug): string => {
  if (!entry.parameters?.length) {
    return entry.sql;
  }

  return `${entry.sql}\n\n-- parameters\n-- ${JSON.stringify(entry.parameters, null, 2).replace(/\n/g, "\n-- ")}`;
};

const isCountOnlySql = (sql: string): boolean => /^\s*SELECT\s+COUNT\s*\(/i.test(sql);

export const recordSqlDebugResponse = (sourceUrl?: string, debugSql?: SqlDebugPayload): void => {
  if (!debugSql) {
    return;
  }

  const queries = debugSql.queries?.length
    ? debugSql.queries
    : [{ sql: debugSql.sql, parameters: debugSql.parameters, tables: debugSql.tables }];

  for (const query of queries) {
    if (!query.sql) {
      continue;
    }

    sqlDebugCache.push({
      sql: query.sql,
      parameters: query.parameters,
      tables: query.tables?.length ? query.tables : extractSqlTables(query.sql),
      sourceUrl,
      recordedAt: Date.now(),
    });
  }

  if (sqlDebugCache.length > SQL_DEBUG_CACHE_LIMIT) {
    sqlDebugCache.splice(0, sqlDebugCache.length - SQL_DEBUG_CACHE_LIMIT);
  }
};

export const getLatestActualSqlForPreview = (previewSql: string): string | null => {
  const previewTables = extractSqlTables(previewSql);
  if (!previewTables.length) {
    return null;
  }

  const previewTableSet = new Set(previewTables);
  let countFallback: CachedSqlDebug | null = null;

  for (let idx = sqlDebugCache.length - 1; idx >= 0; idx -= 1) {
    const entry = sqlDebugCache[idx];
    if (entry.tables.some((table) => previewTableSet.has(table))) {
      if (isCountOnlySql(entry.sql)) {
        countFallback ??= entry;
        continue;
      }
      return formatActualSql(entry);
    }
  }

  return countFallback ? formatActualSql(countFallback) : null;
};

const getCurrentUserRole = (): string | undefined => {
  const storeRole = useAuthStore.getState().user?.role;
  if (storeRole) {
    return storeRole;
  }

  try {
    const authData = JSON.parse(localStorage.getItem("harness-auth") || "{}");
    return authData?.state?.user?.role;
  } catch {
    return undefined;
  }
};

const isViewerMutationRequest = (config: InternalAxiosRequestConfig): boolean => {
  const method = (config.method || "GET").toUpperCase();
  return getCurrentUserRole() === "VIEWER" && !READONLY_HTTP_METHODS.has(method);
};

const createViewerReadonlyError = (config: InternalAxiosRequestConfig): AxiosError<ApiErrorResponse> => {
  const error = new AxiosError<ApiErrorResponse>(
    VIEWER_READONLY_MESSAGE,
    "ERR_VIEWER_READONLY",
    config,
  );

  error.response = {
    data: { message: VIEWER_READONLY_MESSAGE },
    status: 403,
    statusText: "Forbidden",
    headers: {},
    config,
  };

  return error;
};

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
    if (isViewerMutationRequest(config)) {
      return Promise.reject(createViewerReadonlyError(config));
    }

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
    recordSqlDebugResponse(response.config?.url, response.data?.meta?.debugSql);
    const method = response.config.method?.toUpperCase();
    const msg = response.data?.message;
    if (msg && method && ["POST", "PUT", "PATCH", "DELETE"].includes(method) && !response.config.skipSuccessToast) {
      toast.success(msg);
    }
    return response;
  },
  (error: AxiosError) => {
    // 응답이 없는 경우 — 시간 초과와 연결 실패는 원인이 다르므로 구분해서 알린다.
    // (둘을 뭉치면 정상 동작하는 서버를 "죽었다"고 잘못 안내하게 된다)
    if (!error.response) {
      const isTimeout = error.code === "ECONNABORTED" || /timeout/i.test(error.message ?? "");
      const timeoutMs = (error.config as AxiosRequestConfig)?.timeout;
      useErrorStore.getState().showError({
        severity: "system",
        timestamp: new Date().toLocaleString(),
        method: error.config?.method?.toUpperCase() || "UNKNOWN",
        url: error.config?.url || "unknown",
        status: 0,
        message: isTimeout
          ? `응답이 ${timeoutMs ? Math.round(timeoutMs / 1000) : 30}초 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.`
          : "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.",
        responseBody: isTimeout
          ? `요청 시간 초과 (${error.code ?? "ECONNABORTED"})`
          : "네트워크 연결 실패 (ECONNREFUSED)",
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

    // suppressErrorModal 플래그가 있으면 모달 생략
    if ((error.config as AxiosRequestConfig)?.suppressErrorModal) {
      return Promise.reject(error);
    }

    // 심각도에 따라 업무 안내 창 / 시스템 오류 창으로 분리 표시
    const errorCode = typeof data?.errorCode === "string" ? data.errorCode : undefined;
    useErrorStore.getState().showError({
      severity: classifyApiError(status, errorCode),
      timestamp: new Date().toLocaleString(),
      method: error.config?.method?.toUpperCase() || "UNKNOWN",
      url: error.config?.url || "unknown",
      status,
      message: serverMessage,
      errorCode,
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
