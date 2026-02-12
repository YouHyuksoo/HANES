"use client";

/**
 * @file src/pages/material/issue/components/IssueProcessModal.tsx
 * @description 출고처리 모달 - 실제 출고 수량 입력 후 재고 차감
 *
 * 초보자 가이드:
 * 1. **요청 정보**: 요청번호, 작업지시, 품목, 수량 표시
 * 2. **출고 수량**: 잔여 수량 이내로 출고 수량 입력
 * 3. **처리 완료**: 출고 수량이 요청 수량에 도달하면 완료
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import type { IssueRecord } from '@/hooks/material/useIssueData';

interface IssueProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: IssueRecord | null;
}

export default function IssueProcessModal({ isOpen, onClose, record }: IssueProcessModalProps) {
  const { t } = useTranslation();
  const [issueQty, setIssueQty] = useState('');

  const handleSubmit = () => {
    if (!record) return;
    console.log(`출고처리: ${record.requestNo} / ${record.partCode}, 수량: ${issueQty}`);
    handleClose();
  };

  const handleClose = () => {
    setIssueQty('');
    onClose();
  };

  if (!record) return null;

  const remaining = record.requestQty - record.issuedQty;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('material.issue.modalTitle')} size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-background rounded-lg space-y-1">
          <p className="text-sm text-text-muted">
            {t('material.issue.requestNoLabel')}: <span className="font-medium text-text">{record.requestNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.issue.workOrderLabel')}: <span className="font-medium text-primary">{record.workOrderNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.issue.partLabel')}: <span className="font-medium text-text">{record.partName} ({record.partCode})</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.issue.requestQtyLabel')}: <span className="font-medium text-text">{record.requestQty.toLocaleString()} {record.unit}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.issue.issuedLabel')}: <span className="font-medium text-text">{record.issuedQty.toLocaleString()} {record.unit}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.issue.remainingLabel')}: <span className="font-bold text-primary">{remaining.toLocaleString()} {record.unit}</span>
          </p>
        </div>

        <Input
          label={t('material.issue.issueQtyLabel')}
          type="number"
          placeholder="0"
          value={issueQty}
          onChange={(e) => setIssueQty(e.target.value)}
          fullWidth
        />
        {Number(issueQty) > remaining && (
          <p className="text-xs text-red-500">{t('material.issue.remainExceedError', { remaining: remaining.toLocaleString() })}</p>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={!issueQty || Number(issueQty) <= 0 || Number(issueQty) > remaining}
          >
            <CheckCircle className="w-4 h-4 mr-1" /> {t('material.issue.issueAction')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
