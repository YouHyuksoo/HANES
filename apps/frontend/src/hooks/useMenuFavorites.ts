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
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@harness/shared";
import { useApiQuery, useApiMutation } from "@/hooks/useApi";
import { useAuthStore } from "@/stores/authStore";

const FAVORITES_URL = "/menu-favorites/me";
const FAVORITES_KEY = ["menu-favorites", "me"];

export function useMenuFavorites() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const { data } = useApiQuery<string[]>(FAVORITES_KEY, FAVORITES_URL, {
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });
  const favorites: string[] = data?.data ?? [];

  const replaceMutation = useApiMutation<string[], { menuCodes: string[] }>(
    FAVORITES_URL,
    "put",
    {
      onSuccess: (res) => {
        queryClient.setQueryData<ApiResponse<string[]>>(FAVORITES_KEY, res);
      },
      onError: () => {
        // 실패 시 서버 상태로 복원 (낙관적 갱신 롤백)
        queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
      },
    },
  );

  const isFavorite = useCallback(
    (menuCode: string) => favorites.includes(menuCode),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (menuCode: string) => {
      const next = favorites.includes(menuCode)
        ? favorites.filter((code) => code !== menuCode)
        : [...favorites, menuCode];
      queryClient.setQueryData<ApiResponse<string[]>>(FAVORITES_KEY, {
        ...(data ?? { success: true }),
        data: next,
      });
      replaceMutation.mutate({ menuCodes: next });
    },
    [favorites, data, queryClient, replaceMutation],
  );

  return { favorites, isFavorite, toggleFavorite };
}
