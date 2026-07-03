/**
 * @file src/stores/menuTreeStore.ts
 * @description 사이드바 렌더용 — DB 트리 + 코드 menuConfig leaf를 머지한 결과 보관
 *
 * 초보자 가이드:
 * 1. load(): /menu-categories/tree 호출, menuConfig leaf 정보와 머지
 * 2. invalidate(): 관리 화면에서 변경 시 재로딩 트리거
 * 3. 비활성(IS_ACTIVE='N') 카테고리는 사이드바에서 제외
 * 4. 매핑이 없는 leaf는 사이드바에서 제외(미배치 상태)
 * 5. sessionStorage persist로 첫 렌더 시 코딩 순서 깜빡임(FOUC) 방지
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { menuCategoriesApi, type CategoryTreeNode } from '@/services/menuCategoriesApi';
import { menuConfig, type MenuConfigItem } from '@/config/menuConfig';

interface MergedMenuItem {
  code: string;
  labelKey: string;
  path: string;
}

export interface MergedMenuGroup {
  categoryCode: string; // '__ROOT__' 포함
  labelKey: string;
  iconName: string | null;
  children: MergedMenuItem[];
}

interface MenuTreeStore {
  groups: MergedMenuGroup[] | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  invalidate: () => Promise<void>;
}

/** menuConfig.ts에서 leaf 메뉴 코드 → 정보 lookup 맵 생성 */
function buildLeafLookup(): Map<string, MergedMenuItem> {
  const map = new Map<string, MergedMenuItem>();
  const walk = (items: MenuConfigItem[]) => {
    for (const item of items) {
      if (item.path) {
        map.set(item.code, { code: item.code, labelKey: item.labelKey, path: item.path });
      }
      if (item.children) walk(item.children);
    }
  };
  walk(menuConfig);
  return map;
}

export const useMenuTreeStore = create<MenuTreeStore>()(
  persist(
    (set, get) => ({
      groups: null,
      loading: false,
      error: null,

      load: async () => {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const tree: CategoryTreeNode[] = await menuCategoriesApi.tree();
          const leafLookup = buildLeafLookup();

          const active = tree.filter((c) => c.isActive === 'Y');
          active.sort((a, b) => a.sortOrder - b.sortOrder);

          const groups: MergedMenuGroup[] = active.map((c) => ({
            categoryCode: c.categoryCode,
            labelKey: c.labelKey,
            iconName: c.iconName,
            children: c.menus
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((m) => leafLookup.get(m.menuCode))
              .filter((x): x is MergedMenuItem => x !== undefined),
          }));

          set({ groups, loading: false });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'failed to load menu tree';
          set({ loading: false, error: message });
        }
      },

      invalidate: async () => {
        await get().load();
      },
    }),
    {
      name: 'hanes-menu-tree',
      storage: createJSONStorage(() => sessionStorage),
      // groups만 persist (loading/error는 휘발성)
      partialize: (state) => ({ groups: state.groups }),
    }
  )
);
