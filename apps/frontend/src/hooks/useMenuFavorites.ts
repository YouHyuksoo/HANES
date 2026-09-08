"use client";
/**
 * @file src/hooks/useMenuFavorites.ts
 * @description 사용자별 사이드바 메뉴 즐겨찾기 — 서버 상태(react-query) 훅
 *
 * 초보자 가이드:
 * 1. GET /menu-favorites/me — 내 즐겨찾기 메뉴 코드 목록 (순서 보존)
 * 2. PUT /menu-favorites/me — 전체 교체 (배열 순서 = 표시 순서)
 * 3. 토글은 낙관적 갱신 후 서버 반영, 실패 시 재조회로 복원
 * 4. 미로그인/API 실패 시 빈 목록 — 사이드바가 깨지지 않게 조용히 처리
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@harness/shared";
import { useApiQuery } from "@/hooks/useApi";
import api from '@/services/api';
import { useAuthStore } from "@/stores/authStore";
import toast from 'react-hot-toast';

const FAVORITES_URL = "/menu-favorites/me";


export function useMenuFavorites() {
  const { isAuthenticated, user, selectedCompany, selectedPlant } = useAuthStore();
  const FAVORITES_KEY = useMemo(() => ['menu-favorites', 'me', user?.email ?? '', selectedCompany, selectedPlant], [user?.email, selectedCompany, selectedPlant]);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useApiQuery<string[]>(FAVORITES_KEY, FAVORITES_URL, {
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });
  const favorites: string[] = data?.data ?? [];

  const replaceMutation = useMutation({
      mutationFn: async ({ menuCodes }: { menuCodes: string[]; queryKey: string[] }) => {
        const res = await api.put<ApiResponse<string[]>>(FAVORITES_URL, { menuCodes });
        return res.data;
      },
      onSuccess: (res, variables) => {
        // 저장 중 사용자/사업장이 바뀌어도 응답은 요청 당시 캐시에만 기록한다.
        queryClient.setQueryData<ApiResponse<string[]>>(variables.queryKey, res);
        queryClient.invalidateQueries({ queryKey: ['menu-favorite-folders'] });
      },
      onError: (_error, variables) => {
        // 실패 시 서버 상태로 복원 (낙관적 갱신 롤백)
        queryClient.invalidateQueries({ queryKey: variables.queryKey });
        toast.error('즐겨찾기를 저장하지 못했습니다. 다시 시도해 주세요.');
      },
  });

  const isFavorite = useCallback(
    (menuCode: string) => favorites.includes(menuCode),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (menuCode: string) => {
      // 전체 교체 API이므로 원래 목록을 읽기 전에 빈 배열로 덮어쓰지 않는다.
      if (!isAuthenticated || isLoading || isError || !data || replaceMutation.isPending) {
        toast.error('즐겨찾기를 불러오거나 저장하는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const next = favorites.includes(menuCode)
        ? favorites.filter((code) => code !== menuCode)
        : [...favorites, menuCode];
      queryClient.setQueryData<ApiResponse<string[]>>(FAVORITES_KEY, {
        ...(data ?? { success: true }),
        data: next,
      });
      replaceMutation.mutate({ menuCodes: next, queryKey: FAVORITES_KEY });
    },
    [favorites, data, queryClient, replaceMutation, FAVORITES_KEY, isAuthenticated, isLoading, isError],
  );

  return { favorites, isFavorite, toggleFavorite };
}
