"use client";
/**
 * @file CategoryFormPanel — 카테고리 신규/수정 폼, 삭제 버튼 포함
 *
 * 초보자 가이드:
 * - mode="create": 새 카테고리 생성 폼
 * - mode="edit": 기존 카테고리 불러와 수정/삭제
 * - __ROOT__ 카테고리는 수정 제한
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { menuCategoriesApi, type MenuCategoryRow } from '@/services/menuCategoriesApi';

type Mode = 'create' | 'edit';
interface Props {
  mode: Mode;
  code?: string;
  onSaved: () => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
}

const RESERVED = '__ROOT__';

export default function CategoryFormPanel({ mode, code, onSaved, onDeleted }: Props) {
  const { t } = useTranslation();
  const [row, setRow] = useState<MenuCategoryRow | null>(null);
  const [form, setForm] = useState({
    code: '',
    labelKey: '',
    iconName: '',
    isActive: 'Y' as 'Y' | 'N',
    sortOrder: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && code) {
      menuCategoriesApi.list().then((rows) => {
        const r = rows.find((x) => x.categoryCode === code) ?? null;
        setRow(r);
        if (r) {
          setForm({
            code: r.categoryCode,
            labelKey: r.labelKey,
            iconName: r.iconName ?? '',
            isActive: r.isActive,
            sortOrder: r.sortOrder,
          });
        }
      });
    }
  }, [mode, code]);

  const isRoot = code === RESERVED;

  const submit = async () => {
    setError(null);
    try {
      if (mode === 'create') {
        await menuCategoriesApi.create({
          code: form.code,
          labelKey: form.labelKey,
          iconName: form.iconName || undefined,
        });
      } else if (mode === 'edit' && code) {
        await menuCategoriesApi.update(code, {
          labelKey: form.labelKey,
          iconName: form.iconName === '' ? null : form.iconName,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
      }
      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  const remove = async () => {
    if (!code) return;
    setError(null);
    try {
      await menuCategoriesApi.delete(code);
      await onDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-text">
        {mode === 'create' ? t('menuCategoryAdmin.addCategory') : t('menuCategoryAdmin.editCategory')}
      </h3>

      <div>
        <label className="text-xs text-text-muted">code</label>
        <input
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={form.code}
          disabled={mode === 'edit'}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
        />
      </div>

      <div>
        <label className="text-xs text-text-muted">labelKey</label>
        <input
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={form.labelKey}
          disabled={isRoot}
          onChange={(e) => setForm({ ...form, labelKey: e.target.value })}
        />
      </div>

      <div>
        <label className="text-xs text-text-muted">iconName (lucide-react)</label>
        <input
          className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
          value={form.iconName}
          disabled={isRoot}
          onChange={(e) => setForm({ ...form, iconName: e.target.value })}
        />
      </div>

      {mode === 'edit' && !isRoot && (
        <div>
          <label className="text-xs text-text-muted">isActive</label>
          <select
            className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
            value={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.value as 'Y' | 'N' })}
          >
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
      )}

      {mode === 'edit' && (
        <div>
          <label className="text-xs text-text-muted">sortOrder</label>
          <input
            type="number"
            className="w-full px-2 py-1 border border-border rounded-[var(--radius)] bg-white dark:bg-slate-900 text-text"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      )}

      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}

      <div className="flex gap-2 pt-2">
        <button
          className="px-3 py-1.5 rounded-[var(--radius)] bg-primary text-white text-sm font-medium"
          onClick={submit}
        >
          {t('menuCategoryAdmin.save')}
        </button>
        {mode === 'edit' && !isRoot && row && (
          <button
            className="px-3 py-1.5 rounded-[var(--radius)] border border-border text-sm font-medium hover:bg-background"
            onClick={remove}
          >
            {t('menuCategoryAdmin.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
