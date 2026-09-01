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
  Save, Plus, Trash2, RefreshCw, Sparkles, Database,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Modal, ConfirmModal } from '@/components/ui';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';
import { useSysConfigStore } from '@/stores/sysConfigStore';
import type { SysConfigItem } from '@/stores/sysConfigStore';
import ConfigItemRow from '@/components/system/ConfigItemRow';
import AddConfigModal from '@/components/system/AddConfigModal';
import AiConfigPanel from '@/components/system/AiConfigPanel';
import AiEmbeddingPanel from '@/components/system/AiEmbeddingPanel';

/** 그룹 탭 정의 */
const CONFIG_GROUPS = [
  { key: '', label: 'system.config.group.all', icon: Settings },
  { key: 'MATERIAL', label: 'system.config.group.MATERIAL', icon: Package },
  { key: 'PRODUCTION', label: 'system.config.group.PRODUCTION', icon: Factory },
  { key: 'QUALITY', label: 'system.config.group.QUALITY', icon: ClipboardCheck },
  { key: 'SYSTEM', label: 'system.config.group.SYSTEM', icon: Cog },
  { key: 'AI', label: 'system.config.group.AI', icon: Sparkles },
  { key: 'AI_EMBEDDING', label: 'Embedding', icon: Database },
];

const getConfigId = (config: SysConfigItem) => config.id ?? config.configKey;

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
    const arr = list as SysConfigItem[];
    // 전체 탭에서는 AI 그룹을 숨긴다 — AI/Embedding 설정은 전용 패널에서만 관리.
    return activeGroup === '' ? arr.filter((c) => c.configGroup !== 'AI') : arr;
  }, [data, activeGroup]);


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
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary" />
            {t('system.config.title')}
          </h1>
          <p className="text-text-muted mt-1">{t('system.config.description')}</p>
        </div>
        {activeGroup !== 'AI' && activeGroup !== 'AI_EMBEDDING' && (
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
        )}
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

      {/* 설정 목록 (AI/Embedding 탭은 전용 패널) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeGroup === 'AI' ? (
          <div className="h-full overflow-y-auto"><AiConfigPanel /></div>
        ) : activeGroup === 'AI_EMBEDDING' ? (
          <div className="h-full overflow-y-auto"><AiEmbeddingPanel /></div>
        ) : (
          <Card className="h-full overflow-hidden" padding="none">
            <CardContent className="h-full overflow-y-auto p-4">
              {isLoading ? (
                <div className="text-center py-8 text-text-muted">{t('common.loading')}</div>
              ) : configs.length === 0 ? (
                <div className="text-center py-8 text-text-muted">{t('common.noData')}</div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 pr-1">
                  {configs.map((cfg) => (
                    <ConfigItemRow
                      key={getConfigId(cfg)}
                      config={cfg}
                      currentValue={changes[getConfigId(cfg)] ?? cfg.configValue}
                      isChanged={getConfigId(cfg) in changes}
                      onValueChange={(val) => handleValueChange(getConfigId(cfg), val)}
                      onDelete={() => setDeleteTarget(getConfigId(cfg))}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

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
