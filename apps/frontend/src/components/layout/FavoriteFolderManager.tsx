"use client";

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '@/components/ui';
import type { MenuConfigItem } from '@/config/menuConfig';
import type { useMenuFavoriteFolders, FavoriteFolder } from '@/hooks/useMenuFavoriteFolders';

type FolderState = ReturnType<typeof useMenuFavoriteFolders>;

/** 폴더 관리와 메뉴 이동만 담당. 폴더 삭제는 메뉴를 기본 즐겨찾기로 돌려놓는다. */
export function FavoriteFolderManager({ state, menus, onClose }: {
  state: FolderState; menus: MenuConfigItem[]; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FavoriteFolder | null>(null);
  const submit = async () => {
    if (!name.trim()) return;
    try {
      await state.save(editId === null ? { type: 'create', name: name.trim() } : { type: 'rename', id: editId, name: name.trim() });
      setName(''); setEditId(null);
    } catch { /* 서버 메시지는 hook에서 표시 */ }
  };
  return (
    <Modal isOpen onClose={onClose} title="즐겨찾기 폴더 관리" size="lg">
      <div className="space-y-5">
        <p className="text-sm text-text-muted">업무별 폴더를 만들고 즐겨찾기 메뉴를 옮기세요. 폴더를 삭제해도 메뉴는 기본 즐겨찾기에 남습니다.</p>
        {state.error && <div role="alert" className="text-sm text-red-600">폴더를 불러오지 못했습니다. <Button size="sm" onClick={() => state.reload()}>다시 조회</Button></div>}
        <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <Input label={editId === null ? '새 폴더 이름' : '폴더 이름 변경'} value={name} maxLength={100}
            onChange={event => setName(event.target.value)} placeholder="예: EAD 통합테스트" fullWidth />
          <Button type="submit" disabled={state.saving || state.loading || state.error || !name.trim()}>{editId === null ? '폴더 만들기' : '이름 저장'}</Button>
          {editId !== null && <Button variant="secondary" onClick={() => { setEditId(null); setName(''); }}>취소</Button>}
        </form>
        <ul className="divide-y divide-border">
          {state.folders.map(folder => <li key={folder.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 truncate" title={folder.name}>{folder.name}</span>
            <Button size="sm" variant="secondary" disabled={state.saving} onClick={() => { setEditId(folder.id); setName(folder.name); }}>이름 변경</Button>
            <Button size="sm" variant="secondary" disabled={state.saving} onClick={() => setDeleteTarget(folder)}>폴더 삭제</Button>
          </li>)}
        </ul>
        {deleteTarget && <div role="alert" className="border border-border rounded p-3 space-y-2">
          <p>「{deleteTarget.name}」 폴더를 삭제할까요? 메뉴는 기본 즐겨찾기로 이동합니다.</p>
          <div className="flex gap-2"><Button disabled={state.saving} onClick={async () => {
            try { await state.save({ type: 'delete', id: deleteTarget.id }); if (editId === deleteTarget.id) { setEditId(null); setName(''); } setDeleteTarget(null); } catch { /* hook 표시 */ }
          }}>삭제 확인</Button><Button variant="secondary" disabled={state.saving} onClick={() => setDeleteTarget(null)}>취소</Button></div>
        </div>}
        <div className="space-y-2">
          <h3 className="font-semibold">메뉴별 폴더</h3>
          {menus.length === 0 && <p className="text-sm text-text-muted">사이드바 메뉴의 별 버튼을 눌러 즐겨찾기를 추가하세요.</p>}
          {menus.map(menu => <div key={menu.code} className="grid grid-cols-2 items-center gap-3">
            <span className="text-sm truncate">{t(menu.labelKey)}</span>
            <Select aria-label={`${t(menu.labelKey)} 폴더`} value={String(state.assignments.find(item => item.menuCode === menu.code)?.folderId ?? '')}
              disabled={state.saving || state.loading || state.error} fullWidth
              options={[{ value: '', label: '기본 즐겨찾기' }, ...state.folders.map(folder => ({ value: String(folder.id), label: folder.name }))]}
              onChange={value => { void state.save({ type: 'move', menuCode: menu.code, folderId: value ? Number(value) : null }).catch(() => {}); }} />
          </div>)}
        </div>
      </div>
    </Modal>
  );
}
