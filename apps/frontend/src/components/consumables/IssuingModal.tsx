"use client";

/**
 * @file src/pages/consumables/issuing/components/IssuingModal.tsx
 * @description 출고등록 모달 컴포넌트
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@/components/ui';

interface IssuingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: IssuingFormValues) => void;
}

interface IssuingFormValues {
  consumableId: string;
  qty: number;
  department: string;
  lineId: string;
  equipId: string;
  issueReason: string;
  remark: string;
}

const defaultValues: IssuingFormValues = {
  consumableId: '',
  qty: 1,
  department: '',
  lineId: '',
  equipId: '',
  issueReason: 'PRODUCTION',
  remark: '',
};

/** 소모품 목록 (TODO: API에서 로드) */
const consumableOptions = [
  { value: 'c1', label: 'MOLD-001 - 압착금형 A타입' },
  { value: 'c2', label: 'TOOL-001 - 절단날 표준형' },
  { value: 'c3', label: 'JIG-001 - 조립지그 001' },
];

function IssuingModal({ isOpen, onClose, onSubmit }: IssuingModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<IssuingFormValues>(defaultValues);

  const handleChange = (field: keyof IssuingFormValues, value: string | number) => {
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
    <Modal isOpen={isOpen} onClose={handleClose} title={t('consumables.issuing.modalTitle')} size="md">
      <div className="space-y-4">
        <Select
          label={t('consumables.issuing.consumable')}
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
        <Input
          label={t('consumables.issuing.departmentLabel')}
          value={form.department}
          onChange={(e) => handleChange('department', e.target.value)}
          placeholder={t('consumables.issuing.departmentPlaceholder')}
          fullWidth
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('consumables.issuing.lineLabel')}
            value={form.lineId}
            onChange={(e) => handleChange('lineId', e.target.value)}
            placeholder={t('consumables.issuing.linePlaceholder')}
            fullWidth
          />
          <Input
            label={t('consumables.issuing.equipmentLabel')}
            value={form.equipId}
            onChange={(e) => handleChange('equipId', e.target.value)}
            placeholder={t('consumables.issuing.equipmentPlaceholder')}
            fullWidth
          />
        </div>
        <Select
          label={t('consumables.issuing.issueReasonLabel')}
          options={[
            { value: 'PRODUCTION', label: t('consumables.issuing.reasonProduction') },
            { value: 'REPAIR', label: t('consumables.issuing.reasonRepair') },
            { value: 'OTHER', label: t('consumables.issuing.reasonOther') },
          ]}
          value={form.issueReason}
          onChange={(val) => handleChange('issueReason', val)}
          fullWidth
        />
        <Input
          label={t('common.remark')}
          value={form.remark}
          onChange={(e) => handleChange('remark', e.target.value)}
          placeholder={t('consumables.issuing.remarkPlaceholder')}
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

export default IssuingModal;
