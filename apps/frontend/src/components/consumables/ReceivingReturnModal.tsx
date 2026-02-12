"use client";

/**
 * @file src/pages/consumables/receiving/components/ReceivingReturnModal.tsx
 * @description 입고반품 모달 컴포넌트
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@/components/ui';

interface ReceivingReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReturnFormValues) => void;
}

interface ReturnFormValues {
  consumableId: string;
  qty: number;
  vendorCode: string;
  vendorName: string;
  returnReason: string;
  remark: string;
}

const defaultValues: ReturnFormValues = {
  consumableId: '',
  qty: 1,
  vendorCode: '',
  vendorName: '',
  returnReason: '',
  remark: '',
};

/** 소모품 목록 (TODO: API에서 로드) */
const consumableOptions = [
  { value: 'c1', label: 'MOLD-001 - 압착금형 A타입' },
  { value: 'c2', label: 'TOOL-001 - 절단날 표준형' },
  { value: 'c3', label: 'JIG-001 - 조립지그 001' },
];

function ReceivingReturnModal({ isOpen, onClose, onSubmit }: ReceivingReturnModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ReturnFormValues>(defaultValues);

  const handleChange = (field: keyof ReturnFormValues, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit(form);
    setForm(defaultValues);
    onClose();
  };

  const handleClose = () => {
    setForm(defaultValues);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('consumables.receiving.returnModalTitle')} size="md">
      <div className="space-y-4">
        <Select
          label={t('consumables.receiving.consumable')}
          options={consumableOptions}
          value={form.consumableId}
          onChange={(val) => handleChange('consumableId', val)}
          fullWidth
        />
        <Input
          label={t('common.quantity')}
          type="number"
          value={String(form.qty)}
          onChange={(e) => handleChange('qty', Number(e.target.value))}
          fullWidth
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('consumables.receiving.vendorCodeLabel')}
            value={form.vendorCode}
            onChange={(e) => handleChange('vendorCode', e.target.value)}
            fullWidth
          />
          <Input
            label={t('consumables.receiving.vendorNameLabel')}
            value={form.vendorName}
            onChange={(e) => handleChange('vendorName', e.target.value)}
            fullWidth
          />
        </div>
        <Input
          label={t('consumables.receiving.returnReasonLabel')}
          value={form.returnReason}
          onChange={(e) => handleChange('returnReason', e.target.value)}
          placeholder={t('consumables.receiving.returnReasonPlaceholder')}
          fullWidth
        />
        <Input
          label={t('common.remark')}
          value={form.remark}
          onChange={(e) => handleChange('remark', e.target.value)}
          placeholder={t('consumables.receiving.remarkPlaceholder')}
          fullWidth
        />
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
        <Button variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSubmit}>{t('common.register')}</Button>
      </div>
    </Modal>
  );
}

export default ReceivingReturnModal;
