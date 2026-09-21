"use client";

/**
 * @file src/components/layout/FavoriteMenuDropdown.tsx
 * @description 헤더 즐겨찾기 드롭다운 — 별 버튼을 누르면 위에서 아래로 즐겨찾기 메뉴가 펼쳐진다
 *
 * 초보자 가이드:
 * 1. 사이드바 상단에 있던 즐겨찾기 영역(FavoriteSidebar)을 헤더로 옮긴 것이다(2026-09-20 지시).
 *    사이드바는 업무 메뉴만 남겨 스크롤 부담을 줄이고, 즐겨찾기는 어느 화면에서든 한 번 눌러 펼친다.
 * 2. 데이터 출처는 그대로다: useMenuFavorites(메뉴코드 목록) + useMenuFavoriteFolders(폴더·배정) + useMenuTree(권한 반영 트리).
 * 3. 이동은 사이드바·검색과 같은 경로다 — addTab 후 navigateClientOnly(history.pushState). Next router 를 쓰지 않는다.
 * 4. 폴더 만들기·이름 바꾸기·메뉴 이동은 공용 FavoriteFolderManager 모달이 담당한다.
 * 5. 각 줄의 ★ 를 누르면 즐겨찾기에서 빼진다(사이드바 메뉴 옆 ★ 와 같은 토글).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Folder, Settings2, Star } from "lucide-react";
import type { MenuConfigItem } from "@/config/menuConfig";
import { useMenuTree } from "@/hooks/useMenuTree";
import { useMenuFavorites } from "@/hooks/useMenuFavorites";
import { useMenuFavoriteFolders } from "@/hooks/useMenuFavoriteFolders";
import { useTabStore } from "@/stores/tabStore";
import { FavoriteFolderManager } from "./FavoriteFolderManager";
import { navigateClientOnly } from "./clientNavigation";

interface FavoriteLeaf {
  code: string;
  path: string;
  labelKey: string;
  parentCode: string;
}

export default function FavoriteMenuDropdown() {
  const { t } = useTranslation();
  const { items, isMenuDisabled } = useMenuTree();
  const { favorites, toggleFavorite } = useMenuFavorites();
  const folderState = useMenuFavoriteFolders();
  const addTab = useTabStore((s) => s.addTab);
  const [open, setOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [closedFolders, setClosedFolders] = useState<Set<number>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  /** 권한 있는 leaf 만, 즐겨찾기 순서대로. 탭 parentId 용 부모 코드를 함께 담는다. */
  const leaves = useMemo(() => {
    const map = new Map<string, FavoriteLeaf>();
    const collect = (list: MenuConfigItem[], parentCode: string) => list.forEach((item) => {
      if (item.children) collect(item.children, item.code);
      else if (item.path && !isMenuDisabled(item)) map.set(item.code, { code: item.code, path: item.path, labelKey: item.labelKey, parentCode: parentCode || item.code });
    });
    collect(items, "");
    return favorites.map((code) => map.get(code)).filter((leaf): leaf is FavoriteLeaf => !!leaf);
  }, [items, favorites, isMenuDisabled]);

  /** 폴더 관리 모달은 MenuConfigItem 목록을 받는다 */
  const managerMenus = useMemo(() => leaves.map((leaf) => ({ code: leaf.code, path: leaf.path, labelKey: leaf.labelKey }) as MenuConfigItem), [leaves]);

  const assignments = useMemo(() => new Map(folderState.assignments.map((a) => [a.menuCode, a.folderId])), [folderState.assignments]);
  const folderIds = useMemo(() => new Set(folderState.folders.map((f) => f.id)), [folderState.folders]);
  const unfiled = leaves.filter((leaf) => !folderIds.has(assignments.get(leaf.code) ?? -1));

  const openMenu = (leaf: FavoriteLeaf) => {
    const opened = addTab({ id: leaf.code, path: leaf.path, labelKey: leaf.labelKey, parentId: leaf.parentCode });
    // 최대 탭 수 초과로 차단되면 페이지 이동도 막는다(안내 모달은 TabBar 가 표시)
    if (!opened) return;
    navigateClientOnly(leaf.path);
    close();
  };

  const toggleFolder = (id: number) => setClosedFolders((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderLeaf = (leaf: FavoriteLeaf, indent = false) => (
    <div key={leaf.code} role="none" className={`group flex items-center ${indent ? "pl-7" : "pl-3"} pr-2`}>
      <button
        type="button"
        role="menuitem"
        data-testid={`favorite-menu-item-${leaf.code}`}
        onClick={() => openMenu(leaf)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-text hover:bg-background focus:outline-none focus-visible:bg-background"
      >
        <span className="truncate">{t(leaf.labelKey)}</span>
      </button>
      <button
        type="button"
        tabIndex={-1}
        title={t("menu.favorites.remove")}
        aria-label={t("menu.favorites.remove")}
        onClick={(e) => { e.stopPropagation(); toggleFavorite(leaf.code); }}
        className="shrink-0 rounded p-1 opacity-60 hover:bg-background hover:opacity-100"
      >
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      </button>
    </div>
  );

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        data-testid="favorite-menu-open"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("menu.favorites")}
        className={`flex h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors ${
          open ? "border-primary bg-primary/10 text-primary" : "border-border text-text hover:bg-background"
        }`}
      >
        <Star className={`h-4 w-4 ${leaves.length > 0 ? "fill-amber-400 text-amber-400" : ""}`} />
        <span className="hidden md:inline">{t("menu.favorites")}</span>
        {leaves.length > 0 && <span className="rounded bg-background px-1.5 text-xs tabular-nums text-text-muted">{leaves.length}</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={close} />
          <div
            role="menu"
            aria-label={t("menu.favorites")}
            data-testid="favorite-menu-panel"
            className="absolute left-0 top-full z-20 mt-2 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-lg animate-slide-down"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-bold text-text-muted">{t("menu.favorites")} · {leaves.length}</span>
              <button
                type="button"
                onClick={() => { close(); setManagerOpen(true); }}
                title={t("menu.favorites.manageFolders", "즐겨찾기 폴더 관리")}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text hover:bg-background"
              >
                <Settings2 className="h-3.5 w-3.5" />{t("menu.favorites.manageFolders", "폴더 관리")}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {leaves.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-text-muted">{t("menu.favorites.empty", "즐겨찾기가 없습니다. 메뉴 옆 ★를 눌러 추가하세요.")}</p>
              )}
              {folderState.folders.map((folder) => {
                const inFolder = leaves.filter((leaf) => assignments.get(leaf.code) === folder.id);
                const closed = closedFolders.has(folder.id);
                return (
                  <div key={folder.id} role="none">
                    <button
                      type="button"
                      aria-expanded={!closed}
                      onClick={() => toggleFolder(folder.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-bold text-text hover:bg-background"
                    >
                      {closed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                      <Folder className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="truncate" title={folder.name}>{folder.name}</span>
                      <span className="ml-auto text-[11px] font-normal tabular-nums text-text-muted">{inFolder.length}</span>
                    </button>
                    {!closed && inFolder.map((leaf) => renderLeaf(leaf, true))}
                  </div>
                );
              })}
              {folderState.folders.length > 0 && unfiled.length > 0 && <hr className="my-1 border-border" role="separator" />}
              {unfiled.map((leaf) => renderLeaf(leaf))}
            </div>
          </div>
        </>
      )}

      {managerOpen && <FavoriteFolderManager state={folderState} menus={managerMenus} onClose={() => setManagerOpen(false)} />}
    </div>
  );
}
