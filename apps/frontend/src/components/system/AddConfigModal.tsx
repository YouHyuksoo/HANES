'use client';

/**
 * @file components/system/AddConfigModal.tsx
 * @description 환경설정 신규 등록 모달
 *
 * 초보자 가이드:
 * 1. 설정 그룹, 키, 값, 타입, 라벨, 설명 입력
 * 2. SELECT 타입일 때 옵션 JSON 입력란 표시
 * 3. 등록 후 목록 자동 새로고침
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '@/components/ui';
import { api } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const GROUP_OPTIONS = [
  { value: 'MATERIAL', label: '자재관리' },
  { value: 'PRODUCTION', label: '생산관리' },
  { value: 'QUALITY', label: '품질관리' },
  { value: 'SYSTEM', label: '시스템' },
];

const TYPE_OPTIONS = [
  { value: 'BOOLEAN', label: '사용여부 (Y/N)' },
  { value: 'SELECT', label: '선택' },
  { value: 'NUMBER', label: '숫자' },
  { value: 'TEXT', label: '텍스트' },
];

export default function AddConfigModal({ isOpen, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    configGroup: 'MATERIAL',
    configKey: '',
    configValue: 'Y',
    configType: 'BOOLEAN',
    label: '',
    description: '',
    options: '',
    sortOrder: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const updateField = useCallback((key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.configKey || !form.label) return;
    setIsSaving(true);
    try {
      await api.post('/system/configs', {
        ...form,
        options: form.configType === 'SELECT' && form.options ? form.options : undefined,
      });
      setForm({ configGroup: 'MATERIAL', configKey: '', configValue: 'Y', configType: 'BOOLEAN', label: '', description: '', options: '', sortOrder: 0 });
      onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [form, onSaved, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('system.config.addNew')} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">그룹</label>
            <Select options={GROUP_OPTIONS} value={form.configGroup} onChange={(v) => updateField('configGroup', v)} fullWidth />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">타입</label>
            <Select options={TYPE_OPTIONS} value={form.configType} onChange={(v) => updateField('configType', v)} fullWidth />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">설정 키 (영문)</label>
          <Input value={form.configKey} onChange={(e) => updateField('configKey', e.target.value)} placeholder="예: FIFO_ENABLED" fullWidth />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">표시 라벨</label>
          <Input value={form.label} onChange={(e) => updateField('label', e.target.value)} placeholder="예: 선입선출 사용" fullWidth />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">설명</label>
          <Input value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="설정에 대한 설명" fullWidth />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">기본값</label>
          <Input value={form.configValue} onChange={(e) => updateField('configValue', e.target.value)} placeholder={form.configType === 'BOOLEAN' ? 'Y 또는 N' : '값 입력'} fullWidth />
        </div>
        {form.configType === 'SELECT' && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">선택 옵션 (JSON)</label>
            <Input value={form.options} onChange={(e) => updateField('options', e.target.value)} placeholder='[{"value":"V1","label":"옵션1"},{"value":"V2","label":"옵션2"}]' fullWidth />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!form.configKey || !form.label} isLoading={isSaving}>
            {t('common.register')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
