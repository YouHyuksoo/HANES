"use client";
/**
 * @file MenuItemPanel — 선택된 메뉴 항목의 카테고리 이동/미배치 패널
 *
 * 초보자 가이드:
 * - 현재 소속 카테고리를 표시하고 다른 카테고리로 이동하거나 미배치로 내보냄
 * - 라벨/경로는 menuConfig.ts 코드에서만 변경 가능
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type CategoryTreeNode } from '@/services/menuCategoriesApi';

interface Props {
  menuCode: string;
  tree: CategoryTreeNode[];
  onChange: () => Promise<void> | void;
}

export default function MenuItemPanel({ menuCode, tree, onChange }: Props) {
  const { t } = useTranslation();
  const current = tree.find((c) => c.menus.some((m) => m.menuCode === menuCode));
  const [targetCategory, setTargetCategory] = useState(current?.categoryCode ?? '');

  const apply = async () => {
    await menuCategoriesApi.moveItem({ menuCode, toCategoryCode: targetCategory, sortOrder: 9999 });
    await onChange();
  };

  const unassign = async () => {
    await menuCategoriesApi.unassign(menuCode);
    await onChange();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text">{t('menuCategoryAdmin.menuInfo')}</h3>

      <div>
        <div className="text-xs text-text-muted">menuCode</div>
        <div className="text-sm text-text">{menuCode}</div>
      </div>

      <div>
        <div className="text-xs text-text-muted mt-2">{t('menuCategoryAdmin.currentCategory')}</div>
        <div className="text-sm text-text">
          {current?.categoryCode ?? t('menuCategoryAdmin.noCategory')}
        </div>
      </div>

      <div className="pt-2">
        <label className="text-xs text-text-muted">{t('menuCategoryAdmin.moveToCategory')}</label>
        <select
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={targetCategory}
          onChange={(e) => setTargetCategory(e.target.value)}
        >
          <option value="">{t('menuCategoryAdmin.selectCategory')}...</option>
          {tree.map((c) => (
            <option key={c.categoryCode} value={c.categoryCode}>
              {c.categoryCode}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-text-muted pt-2">{t('menuCategoryAdmin.menuCodeHint')}</div>

      <div className="flex gap-2 pt-2">
        <button
          className="px-3 py-1.5 rounded-[var(--radius)] bg-primary text-white text-sm font-medium disabled:opacity-50"
          onClick={apply}
          disabled={!targetCategory}
        >
          {t('menuCategoryAdmin.move')}
        </button>
        <button
          className="px-3 py-1.5 rounded-[var(--radius)] border border-border text-sm font-medium hover:bg-background"
          onClick={unassign}
        >
          {t('menuCategoryAdmin.moveToUnassigned')}
        </button>
      </div>
    </div>
  );
}
