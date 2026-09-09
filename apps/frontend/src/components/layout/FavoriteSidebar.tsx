"use client";

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Folder, Settings2, Star } from 'lucide-react';
import type { MenuConfigItem } from '@/config/menuConfig';
import { useMenuFavoriteFolders } from '@/hooks/useMenuFavoriteFolders';
import { FavoriteFolderManager } from './FavoriteFolderManager';
import SidebarMenu from './SidebarMenu';

export function FavoriteSidebar({ items, favorites, collapsed, pathname, isMenuDisabled, isFavorite, onToggleFavorite, onClose }: {
  items: MenuConfigItem[]; favorites: string[]; collapsed: boolean; pathname: string;
  isMenuDisabled: (item: MenuConfigItem) => boolean;
  isFavorite: (code: string) => boolean; onToggleFavorite: (code: string) => void; onClose?: () => void;
}) {
  const { t } = useTranslation();
  const state = useMenuFavoriteFolders();
  const [managerOpen, setManagerOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [closedFolders, setClosedFolders] = useState<Set<number>>(new Set());
  const [dragOverFolder, setDragOverFolder] = useState<number | null>(null);
  const ensureFavorite = (menuCode: string) => { if (!isFavorite(menuCode)) onToggleFavorite(menuCode); };
  const dropIntoFolder = (event: React.DragEvent, folderId: number) => {
    event.preventDefault();
    const menuCode = event.dataTransfer.getData('text/hanes-menu-code');
    setDragOverFolder(null);
    if (!menuCode) return;
    ensureFavorite(menuCode);
    void state.save({ type: 'move', menuCode, folderId }).catch(() => {});
  };
  const menus = useMemo(() => {
    const leaves = new Map<string, MenuConfigItem>();
    const collect = (list: MenuConfigItem[]) => list.forEach(item => {
      if (item.children) collect(item.children); else if (item.path && !isMenuDisabled(item)) leaves.set(item.code, item);
    });
    collect(items);
    return favorites.map(code => leaves.get(code)).filter((item): item is MenuConfigItem => !!item);
  }, [items, favorites, isMenuDisabled]);
  const assignments = new Map(state.assignments.map(item => [item.menuCode, item.folderId]));
  const folderIds = new Set(state.folders.map(folder => folder.id));
  const renderMenus = (list: MenuConfigItem[]) => <SidebarMenu items={list} collapsed={false} pathname={pathname}
    expandedMenus={[]} onToggleMenu={() => {}} isMenuActive={item => item.path === pathname}
    isMenuDisabled={isMenuDisabled} onClose={onClose} t={t} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite}
    onMenuDragStart={ensureFavorite} />;

  return <div className="mb-2 border-b border-border pb-2">
    <div className="flex items-center">
      <button type="button" title="즐겨찾기" aria-expanded={expanded} className="flex flex-1 items-center gap-2 min-w-0 px-3 py-2 text-sm font-medium"
        onClick={() => collapsed ? setManagerOpen(true) : setExpanded(!expanded)}>
        <Star className="w-4 h-4 shrink-0" />{!collapsed && <><span className="flex-1 text-left">{t('menu.favorites')}</span>{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</>}
      </button>
      {!collapsed && <button type="button" title="즐겨찾기 폴더 관리" aria-label="즐겨찾기 폴더 관리" className="p-2 rounded hover:bg-background" onClick={() => setManagerOpen(true)}><Settings2 className="w-4 h-4" /></button>}
    </div>
    {!collapsed && expanded && <div className="ml-2">
      {state.folders.map(folder => <div key={folder.id}>
        <button type="button" onDragEnter={(event) => { event.preventDefault(); setDragOverFolder(folder.id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverFolder(folder.id); }} onDragLeave={() => setDragOverFolder(null)} onDrop={(event) => dropIntoFolder(event, folder.id)} className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-background rounded ${dragOverFolder === folder.id ? 'ring-2 ring-primary bg-primary/10' : ''}`} aria-expanded={!closedFolders.has(folder.id)}
          onClick={() => setClosedFolders(prev => { const next = new Set(prev); if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id); return next; })}>
          {closedFolders.has(folder.id) ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}<Folder className="w-4 h-4 shrink-0" /><span className="truncate" title={folder.name}>{folder.name}</span>
        </button>
        {!closedFolders.has(folder.id) && <div className="ml-4 border-l border-border">{renderMenus(menus.filter(menu => assignments.get(menu.code) === folder.id))}</div>}
      </div>)}
      {renderMenus(menus.filter(menu => !folderIds.has(assignments.get(menu.code) ?? -1)))}
    </div>}
    {managerOpen && <FavoriteFolderManager state={state} menus={menus} onClose={() => setManagerOpen(false)} />}
  </div>;
}
