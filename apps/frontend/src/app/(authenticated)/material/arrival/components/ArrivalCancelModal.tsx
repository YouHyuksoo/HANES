"use client";

/**
 * @file src/app/(authenticated)/material/arrival/components/ArrivalCancelModal.tsx
 * @description 입하 취소 모달 - 사유 입력 후 역분개 처리
 *
 * 초보자 가이드:
 * 1. **역분개**: 삭제가 아닌 반대 트랜잭션 생성 (+qty → -qty)
 * 2. **사유 입력**: 취소 사유 필수 입력
 * 3. **상태 변경**: 원본 DONE → CANCELED, 역분개 트랜잭션 추가 생성
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input } from '@/components/ui';
import api from '@/services/api';
import type { ArrivalRecord } from './types';

interface ArrivalCancelModalProps {
  isOpen: boolean;
  record: ArrivalRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ArrivalCancelModal({ isOpen, record, onClose, onSuccess }: ArrivalCancelModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!record || !reason.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/material/arrivals/cancel', {
        transactionId: record.id,
        reason: reason.trim(),
      });
      setReason('');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('입하 취소 실패:', err);
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('material.arrival.cancelTitle')} size="lg">
      <div className="space-y-4">
        {record && (
          <div className="p-3 bg-surface-secondary rounded-lg space-y-1 text-sm">
            <p><span className="text-text-muted">{t('material.arrival.col.transNo')}:</span> {record.transNo}</p>
            <p><span className="text-text-muted">{t('common.partName')}:</span> {record.part?.itemName}</p>
            <p><span className="text-text-muted">{t('common.quantity')}:</span> {record.qty.toLocaleString()} {record.part?.unit}</p>
          </div>
        )}
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">
            {t('material.arrival.cancelWarning')}
          </p>
        </div>
        <Input
          label={t('material.arrival.cancelReason')}
          placeholder={t('material.arrival.cancelReasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!reason.trim() || submitting}
          >
            {submitting ? t('common.processing') : t('material.arrival.confirmCancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
