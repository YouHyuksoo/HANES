/**
 * @file src/types/index.ts
 * @description 전역 타입 정의
 */

import type {
  ApiResponse as SharedApiResponse,
  JobOrderSelectItem,
  JobOrderStatusValue,
  PaginationParams as SharedPaginationParams,
  UseYnValue,
} from "@harness/shared";

// ========================================
// 공통 타입
// ========================================

export type ApiResponse<T> = SharedApiResponse<T>;

export type PaginationParams = SharedPaginationParams;

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type UseYn = UseYnValue;

// ========================================
// 생산 관련 타입
// ========================================

export type JobOrder = JobOrderSelectItem;

export type JobOrderStatus = JobOrderStatusValue;

// ========================================
// 메뉴/네비게이션 타입
// ========================================

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
  badge?: number | string;
}
