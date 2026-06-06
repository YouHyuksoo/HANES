"use client";

/**
 * @file SerialIssueConfirmModal.tsx
 * @description "n건의 시리얼을 발급합니다" 최종 확인 모달
 */

import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/ui';

interface Props {
  isOpen: boolean;
  expectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export default function SerialIssueConfirmModal({
  isOpen, expectedCount, onConfirm, onCancel, submitting,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={t('material.arrival.confirm.serialIssueTitle')} size="md">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        {t('material.arrival.confirm.serialIssueBody', { count: expectedCount })}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('material.arrival.confirm.serialIssueNote')}</p>
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} disabled={submitting}>
          {submitting ? t('common.processing') : t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
