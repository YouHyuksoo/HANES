/**
 * @file src/services/menuCategoriesApi.ts
 * @description 메뉴 카테고리/배치 API 클라이언트
 *
 * 초보자 가이드:
 * 1. 백엔드 응답이 { success, data, ... } 형태이므로 .data.data로 payload 추출
 * 2. 인증 토큰/회사/사업장 헤더는 services/api.ts 인터셉터가 자동 처리
 */
import { api } from './api';

export interface CategoryTreeNode {
  categoryCode: string;
  labelKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: 'Y' | 'N';
  menus: { menuCode: string; sortOrder: number }[];
}

export interface MenuCategoryRow {
  categoryCode: string;
  labelKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: 'Y' | 'N';
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const menuCategoriesApi = {
  tree: () =>
    api
      .get<{ data: CategoryTreeNode[] }>('/menu-categories/tree')
      .then((r) => unwrap<CategoryTreeNode[]>(r as any)),

  list: () =>
    api
      .get<{ data: MenuCategoryRow[] }>('/menu-categories')
      .then((r) => unwrap<MenuCategoryRow[]>(r as any)),

  unassigned: () =>
    api
      .get<{ data: string[] }>('/menu-categories/unassigned-menus')
      .then((r) => unwrap<string[]>(r as any)),

  create: (dto: { code: string; labelKey: string; iconName?: string }) =>
    api.post('/menu-categories', dto).then((r) => unwrap<MenuCategoryRow>(r as any)),

  update: (
    code: string,
    dto: { labelKey?: string; iconName?: string | null; isActive?: 'Y' | 'N'; sortOrder?: number },
  ) =>
    api
      .patch(`/menu-categories/${code}`, dto)
      .then((r) => unwrap<MenuCategoryRow>(r as any)),

  delete: (code: string) =>
    api
      .delete(`/menu-categories/${code}`)
      .then((r) => unwrap<{ code: string }>(r as any)),

  reorderCategories: (items: { code: string; sortOrder: number }[]) =>
    api
      .patch('/menu-categories/reorder', { items })
      .then((r) => unwrap<{ ok: true }>(r as any)),

  reorderItems: (
    categoryCode: string,
    items: { menuCode: string; sortOrder: number }[],
  ) =>
    api
      .patch(`/menu-categories/${categoryCode}/items`, { items })
      .then((r) => unwrap<{ ok: true }>(r as any)),

  moveItem: (dto: { menuCode: string; toCategoryCode: string; sortOrder: number }) =>
    api
      .patch('/menu-category-items/move', dto)
      .then((r) => unwrap<{ menuCode: string; categoryCode: string }>(r as any)),

  unassign: (menuCode: string) =>
    api
      .delete(`/menu-category-items/${menuCode}`)
      .then((r) => unwrap<{ menuCode: string }>(r as any)),
};
