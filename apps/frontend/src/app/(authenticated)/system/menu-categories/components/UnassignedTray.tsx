"use client";
/**
 * @file UnassignedTray — 어떤 카테고리에도 속하지 않은 미배치 메뉴 목록
 *
 * 초보자 가이드:
 * - 카테고리 선택 시 즉시 moveItem API를 호출해 배치
 * - 항목이 없으면 트레이 자체를 렌더링하지 않음
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type CategoryTreeNode } from '@/services/menuCategoriesApi';
import { menuConfig, type MenuConfigItem } from '@/config/menuConfig';

interface Props {
  unassigned: string[];
  tree: CategoryTreeNode[];
  onChange: () => Promise<void> | void;
}

function buildLeafLabelLookup(): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (items: MenuConfigItem[]) => {
    for (const item of items) {
      if (item.path) map.set(item.code, item.labelKey);
      if (item.children) walk(item.children);
    }
  };
  walk(menuConfig);
  return map;
}

export default function UnassignedTray({ unassigned, tree, onChange }: Props) {
  const { t } = useTranslation();
  const leafLabelMap = useMemo(() => buildLeafLabelLookup(), []);
  if (unassigned.length === 0) return null;
  return (
    <div className="border border-dashed border-border rounded-[var(--radius)] p-3 bg-surface">
      <h3 className="text-sm font-semibold text-text mb-2">
        {t('menuCategoryAdmin.unassigned')} ({unassigned.length})
      </h3>
      <ul className="space-y-1">
        {unassigned.map((code) => {
          const labelKey = leafLabelMap.get(code);
          return (
            <li
              key={code}
              className="flex items-center justify-between gap-2 py-1 px-2 hover:bg-background rounded-[var(--radius)]"
            >
              <span className="text-sm text-text">
                {labelKey ? t(labelKey) : code}
                <span className="ml-2 text-xs text-text-muted">({code})</span>
              </span>
              <select
                className="text-xs px-1 py-0.5 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
                defaultValue=""
                onChange={async (e) => {
                  const v = e.target.value;
                  if (!v) return;
                  await menuCategoriesApi.moveItem({ menuCode: code, toCategoryCode: v, sortOrder: 9999 });
                  await onChange();
                }}
              >
                <option value="">{t('menuCategoryAdmin.selectCategory')}</option>
                {tree.map((c) => (
                  <option key={c.categoryCode} value={c.categoryCode}>
                    {t(c.labelKey)} ({c.categoryCode})
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
