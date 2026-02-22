'use client';

/**
 * @file src/app/(authenticated)/system/config/page.tsx
 * @description 시스템 환경설정 관리 페이지
 *
 * 초보자 가이드:
 * 1. 좌측 그룹 탭으로 카테고리 전환 (자재/생산/품질/시스템)
 * 2. 각 설정을 타입별 입력 UI로 편집 (토글/선택/숫자/텍스트)
 * 3. 변경사항을 한번에 "저장" 버튼으로 일괄 반영
 * 4. 저장 시 전역 스토어(sysConfigStore) 자동 갱신
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings, Package, Factory, ClipboardCheck, Cog,
  Save, Plus, Trash2, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, ConfirmModal } from '@/components/ui';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';
import { useSysConfigStore } from '@/stores/sysConfigStore';
import type { SysConfigItem } from '@/stores/sysConfigStore';
import ConfigItemRow from '@/components/system/ConfigItemRow';
import AddConfigModal from '@/components/system/AddConfigModal';

/** 그룹 탭 정의 */
const CONFIG_GROUPS = [
  { key: '', label: 'system.config.group.all', icon: Settings },
  { key: 'MATERIAL', label: 'system.config.group.MATERIAL', icon: Package },
  { key: 'PRODUCTION', label: 'system.config.group.PRODUCTION', icon: Factory },
  { key: 'QUALITY', label: 'system.config.group.QUALITY', icon: ClipboardCheck },
  { key: 'SYSTEM', label: 'system.config.group.SYSTEM', icon: Cog },
];

interface ConfigListResponse {
  data: SysConfigItem[];
  grouped: Record<string, SysConfigItem[]>;
  total: number;
}

function ConfigPage() {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState('');
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const invalidate = useInvalidateQueries();
  const { fetchConfigs } = useSysConfigStore();

  const queryParams = activeGroup ? `?configGroup=${activeGroup}` : '';
  const { data, isLoading, refetch } = useApiQuery<ConfigListResponse>(
    ['sys-configs', activeGroup],
    `/system/configs${queryParams}`,
    { staleTime: 30_000 },
  );

  const configs = useMemo(() => {
    const raw = data?.data;
    if (!raw) return [];
    const list = (raw as ConfigListResponse)?.data ?? (Array.isArray(raw) ? raw : []);
    return list as SysConfigItem[];
  }, [data]);

  const changedCount = Object.keys(changes).length;

  const handleValueChange = useCallback((id: string, value: string) => {
    setChanges((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (changedCount === 0) return;
    setIsSaving(true);
    try {
      const items = Object.entries(changes).map(([id, configValue]) => ({ id, configValue }));
      await api.put('/system/configs/bulk', { items });
      setChanges({});
      invalidate(['sys-configs']);
      refetch();
      fetchConfigs();
    } finally {
      setIsSaving(false);
    }
  }, [changes, changedCount, invalidate, refetch, fetchConfigs]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await api.delete(`/system/configs/${deleteTarget}`);
    setDeleteTarget(null);
    invalidate(['sys-configs']);
    refetch();
    fetchConfigs();
  }, [deleteTarget, invalidate, refetch, fetchConfigs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary" />
            {t('system.config.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('system.config.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" />{t('system.config.addNew')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={changedCount === 0}
            isLoading={isSaving}
          >
            <Save className="w-4 h-4 mr-1" />
            {changedCount > 0
              ? t('system.config.changedCount', { count: changedCount })
              : t('system.config.save')}
          </Button>
        </div>
      </div>

      {/* 그룹 탭 */}
      <div className="flex border-b border-border">
        {CONFIG_GROUPS.map((g) => {
          const Icon = g.icon;
          const isActive = activeGroup === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setActiveGroup(g.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />{t(g.label)}
            </button>
          );
        })}
      </div>

      {/* 설정 목록 */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-text-muted">로딩 중...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-text-muted">{t('common.noData')}</div>
          ) : (
            <div className="divide-y divide-border">
              {configs.map((cfg) => (
                <ConfigItemRow
                  key={cfg.id}
                  config={cfg}
                  currentValue={changes[cfg.id] ?? cfg.configValue}
                  isChanged={cfg.id in changes}
                  onValueChange={(val) => handleValueChange(cfg.id, val)}
                  onDelete={() => setDeleteTarget(cfg.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddConfigModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => { refetch(); fetchConfigs(); }}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('common.delete')}
        message={t('system.config.confirmDelete')}
        confirmText={t('common.delete')}
      />
    </div>
  );
}

export default ConfigPage;
