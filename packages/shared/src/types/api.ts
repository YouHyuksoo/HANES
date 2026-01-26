/**
 * @file packages/shared/src/types/api.ts
 * @description API 요청/응답 공통 타입 정의
 */

/** API 응답 기본 구조 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: ApiMeta;
}

/** API 에러 구조 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** API 메타 정보 (페이지네이션 등) */
export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

/** 페이지네이션 요청 파라미터 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 검색 요청 파라미터 */
export interface SearchParams extends PaginationParams {
  keyword?: string;
  filters?: Record<string, unknown>;
}
