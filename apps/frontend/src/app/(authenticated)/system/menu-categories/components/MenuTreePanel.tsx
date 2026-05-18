"use client";
/**
 * @file MenuTreePanel — 카테고리 + 메뉴 트리, dnd-kit로 순서/소속 변경
 *
 * 초보자 가이드:
 * - 카테고리 ↕ 카테고리: reorderCategories
 * - 메뉴 ↕ 같은 카테고리: reorderItems
 * - 미배치 ↔ 카테고리는 UnassignedTray에서 처리
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { menuCategoriesApi, type CategoryTreeNode } from '@/services/menuCategoriesApi';
import { menuConfig, type MenuConfigItem } from '@/config/menuConfig';

/** menuConfig.ts에서 leaf 메뉴 코드 → labelKey lookup 맵 생성 (관리 화면에서 다국어 라벨 표시용) */
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

interface Props {
  tree: CategoryTreeNode[];
  onChange: () => Promise<void> | void;
  onSelectCategory: (code: string) => void;
  onSelectMenu: (menuCode: string) => void;
}

function SortableRow({
  id,
  children,
  onClick,
}: {
  id: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-text-muted select-none"
        aria-label="drag handle"
      >
        ⋮⋮
      </span>
      <button
        className="flex-1 text-left py-1.5 px-2 hover:bg-surface rounded-[var(--radius)] text-sm text-text"
        onClick={onClick}
      >
        {children}
      </button>
    </div>
  );
}

export default function MenuTreePanel({ tree, onChange, onSelectCategory, onSelectMenu }: Props) {
  const { t } = useTranslation();
  const sorted = useMemo(() => tree.slice().sort((a, b) => a.sortOrder - b.sortOrder), [tree]);
  const categoryIds = sorted.map((c) => `cat:${c.categoryCode}`);
  const leafLabelMap = useMemo(() => buildLeafLabelLookup(), []);

  const onCategoriesDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = categoryIds.indexOf(active.id as string);
    const newIndex = categoryIds.indexOf(over.id as string);
    const next = arrayMove(sorted, oldIndex, newIndex);
    const payload = next.map((c, idx) => ({ code: c.categoryCode, sortOrder: (idx + 1) * 10 }));
    await menuCategoriesApi.reorderCategories(payload);
    await onChange();
  };

  const onItemsDragEnd = async (categoryCode: string, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const cat = sorted.find((c) => c.categoryCode === categoryCode);
    if (!cat) return;
    const items = cat.menus.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const ids = items.map((m) => `menu:${categoryCode}:${m.menuCode}`);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const next = arrayMove(items, oldIndex, newIndex);
    const payload = next.map((m, idx) => ({ menuCode: m.menuCode, sortOrder: (idx + 1) * 10 }));
    await menuCategoriesApi.reorderItems(categoryCode, payload);
    await onChange();
  };

  return (
    <div className="space-y-2">
      <DndContext collisionDetection={closestCenter} onDragEnd={onCategoriesDragEnd}>
        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
          {sorted.map((c) => (
            <div
              key={c.categoryCode}
              className="border border-border rounded-[var(--radius)] p-2 bg-surface"
            >
              <SortableRow
                id={`cat:${c.categoryCode}`}
                onClick={() => onSelectCategory(c.categoryCode)}
              >
                <span className="font-medium">{t(c.labelKey)}</span>
                <span className="ml-2 text-xs text-text-muted">({c.categoryCode})</span>
              </SortableRow>

              <div className="mt-1 ml-6 pl-3 border-l border-border">
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => onItemsDragEnd(c.categoryCode, e)}
                >
                  <SortableContext
                    items={c.menus.map((m) => `menu:${c.categoryCode}:${m.menuCode}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {c.menus
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((m) => {
                        const labelKey = leafLabelMap.get(m.menuCode);
                        return (
                          <SortableRow
                            key={m.menuCode}
                            id={`menu:${c.categoryCode}:${m.menuCode}`}
                            onClick={() => onSelectMenu(m.menuCode)}
                          >
                            <span className="text-sm">{labelKey ? t(labelKey) : m.menuCode}</span>
                            <span className="ml-2 text-xs text-text-muted">({m.menuCode})</span>
                          </SortableRow>
                        );
                      })}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
