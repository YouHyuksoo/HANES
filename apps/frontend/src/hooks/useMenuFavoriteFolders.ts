"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiQuery } from './useApi';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

export interface FavoriteFolder { id: number; name: string; sortOrder: number }
interface FolderData {
  folders: FavoriteFolder[];
  assignments: { menuCode: string; folderId: number | null }[];
}
type FolderAction =
  | { type: 'create'; name: string }
  | { type: 'rename'; id: number; name: string }
  | { type: 'delete'; id: number }
  | { type: 'move'; menuCode: string; folderId: number | null };

export function useMenuFavoriteFolders() {
  const { user, selectedCompany, selectedPlant, isAuthenticated } = useAuthStore();
  const client = useQueryClient();
  const query = useApiQuery<FolderData>(
    ['menu-favorite-folders', user?.email ?? '', selectedCompany, selectedPlant],
    '/menu-favorites/folders', { enabled: isAuthenticated, retry: false },
  );
  const mutation = useMutation({
    mutationFn: async (action: FolderAction) => {
      if (action.type === 'create') return api.post('/menu-favorites/folders', { name: action.name });
      if (action.type === 'rename') return api.patch(`/menu-favorites/folders/${action.id}`, { name: action.name });
      if (action.type === 'delete') return api.delete(`/menu-favorites/folders/${action.id}`);
      return api.put(`/menu-favorites/me/${encodeURIComponent(action.menuCode)}/folder`, { folderId: action.folderId });
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['menu-favorite-folders'] }); },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof message === 'string' ? message : '즐겨찾기 폴더를 저장하지 못했습니다.');
    },
  });
  return {
    folders: query.data?.data?.folders ?? [], assignments: query.data?.data?.assignments ?? [],
    loading: query.isLoading, error: query.isError, reload: query.refetch,
    save: mutation.mutateAsync, saving: mutation.isPending,
  };
}
