"use client";

/**
 * @file src/pages/consumables/receiving/components/ReceivingReturnModal.tsx
 * @description 입고반품 모달 컴포넌트
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { ConsumableSearchModal } from '@/components/shared';

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

function ReceivingReturnModal({ isOpen, onClose, onSubmit }: ReceivingReturnModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ReturnFormValues>(defaultValues);
  const [consumableSearchOpen, setConsumableSearchOpen] = useState(false);
  const [consumableLabel, setConsumableLabel] = useState('');

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
    setConsumableLabel('');
    onClose();
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title={t('consumables.receiving.returnModalTitle')} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            {t('consumables.receiving.consumable')}
          </label>
          <div className="flex gap-1.5">
            <Input
              value={consumableLabel}
              readOnly
              placeholder={t('consumables.search.placeholder')}
              fullWidth
            />
            <button
              type="button"
              onClick={() => setConsumableSearchOpen(true)}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-[var(--radius)] border border-gray-400 dark:border-gray-500 bg-surface hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
              title={t('consumables.search.title')}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
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

    <ConsumableSearchModal
      isOpen={consumableSearchOpen}
      onClose={() => setConsumableSearchOpen(false)}
      onSelect={(item) => {
        handleChange('consumableId', item.id);
        setConsumableLabel(`${item.consumableCode} - ${item.consumableName}`);
      }}
    />
    </>
  );
}

export default ReceivingReturnModal;
