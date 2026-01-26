/**
 * @file src/hooks/useApi.ts
 * @description API 호출 관련 커스텀 훅 - React Query 래퍼
 *
 * 초보자 가이드:
 * 1. **useApiQuery**: GET 요청용 (데이터 조회)
 * 2. **useApiMutation**: POST/PUT/DELETE 요청용 (데이터 변경)
 * 3. **React Query**: 캐싱, 재시도, 로딩 상태 자동 관리
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types';

/**
 * GET 요청 훅
 * @param key - 캐시 키 (배열 형태)
 * @param url - API 엔드포인트
 * @param options - React Query 옵션
 */
export function useApiQuery<T>(
  key: string[],
  url: string,
  options?: Omit<UseQueryOptions<ApiResponse<T>>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ApiResponse<T>>({
    queryKey: key,
    queryFn: async () => {
      const response = await api.get<ApiResponse<T>>(url);
      return response.data;
    },
    ...options,
  });
}

/**
 * POST/PUT/DELETE 요청 훅
 * @param url - API 엔드포인트
 * @param method - HTTP 메서드
 * @param options - React Query Mutation 옵션
 */
export function useApiMutation<TData, TVariables = unknown>(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  options?: UseMutationOptions<ApiResponse<TData>, Error, TVariables>
) {
  return useMutation<ApiResponse<TData>, Error, TVariables>({
    mutationFn: async (variables) => {
      const response = await api[method]<ApiResponse<TData>>(url, variables);
      return response.data;
    },
    ...options,
  });
}

/**
 * 쿼리 캐시 무효화 훅
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return (keys: string[]) => {
    queryClient.invalidateQueries({ queryKey: keys });
  };
}

/**
 * 페이지네이션 쿼리 훅
 */
export function usePaginatedQuery<T>(
  key: string[],
  url: string,
  params: { page: number; limit: number; [key: string]: unknown }
) {
  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();

  return useApiQuery<T>([...key, params.page.toString()], `${url}?${queryString}`, {
    placeholderData: (previousData) => previousData, // 이전 데이터 유지
  });
}
