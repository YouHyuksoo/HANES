"use client";

/**
 * @file src/app/(authenticated)/system/menu-categories/page.tsx
 * @description 메뉴 카테고리 관리 — 드래그앤드롭 트리 + 우측 편집 패널
 *
 * 초보자 가이드:
 * 1. 좌측: 카테고리 트리 + 미배치 메뉴 트레이 (DnD)
 * 2. 우측: 선택된 항목 편집(카테고리: 라벨/아이콘/순서; 메뉴: 소속 변경)
 * 3. 트리/폼/트레이는 컴포넌트로 분리, 페이지 파일은 상태/레이아웃만
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type CategoryTreeNode } from '@/services/menuCategoriesApi';
import { useMenuTreeStore } from '@/stores/menuTreeStore';
import MenuTreePanel from './components/MenuTreePanel';
import CategoryFormPanel from './components/CategoryFormPanel';
import MenuItemPanel from './components/MenuItemPanel';
import UnassignedTray from './components/UnassignedTray';

type Selection =
  | { kind: 'none' }
  | { kind: 'new-category' }
  | { kind: 'category'; code: string }
  | { kind: 'menu'; menuCode: string };

export default function MenuCategoryAdminPage() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const invalidate = useMenuTreeStore((s) => s.invalidate);

  const refresh = async () => {
    const [t1, u1] = await Promise.all([
      menuCategoriesApi.tree(),
      menuCategoriesApi.unassigned(),
    ]);
    setTree(t1);
    setUnassigned(u1);
    await invalidate();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
        <h1 className="text-lg font-semibold text-text">{t('menuCategoryAdmin.title')}</h1>
        <button
          className="px-3 py-1.5 rounded-[var(--radius)] bg-primary text-white text-sm font-medium hover:opacity-90"
          onClick={() => setSelection({ kind: 'new-category' })}
        >
          + {t('menuCategoryAdmin.addCategory')}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-auto p-4 border-r border-border">
          <MenuTreePanel
            tree={tree}
            onChange={refresh}
            onSelectCategory={(code) => setSelection({ kind: 'category', code })}
            onSelectMenu={(menuCode) => setSelection({ kind: 'menu', menuCode })}
          />
          <div className="mt-6">
            <UnassignedTray unassigned={unassigned} tree={tree} onChange={refresh} />
          </div>
        </div>

        <aside className="w-[380px] min-h-0 overflow-auto p-4 bg-background">
          {selection.kind === 'none' && (
            <div className="text-sm text-text-muted">{t('menuCategoryAdmin.selectItem')}</div>
          )}
          {selection.kind === 'new-category' && (
            <CategoryFormPanel
              key="new"
              mode="create"
              onSaved={async () => { setSelection({ kind: 'none' }); await refresh(); }}
            />
          )}
          {selection.kind === 'category' && (
            <CategoryFormPanel
              key={selection.code}
              mode="edit"
              code={selection.code}
              onSaved={async () => { await refresh(); }}
              onDeleted={async () => { setSelection({ kind: 'none' }); await refresh(); }}
            />
          )}
          {selection.kind === 'menu' && (
            <MenuItemPanel
              key={selection.menuCode}
              menuCode={selection.menuCode}
              tree={tree}
              onChange={async () => { await refresh(); }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
