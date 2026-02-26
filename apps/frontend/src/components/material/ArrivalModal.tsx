"use client";

/**
 * @file src/pages/material/arrival/components/ArrivalModal.tsx
 * @description 입하 등록 모달 컴포넌트
 */
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { ArrivalCreateForm } from '@/hooks/material/useArrivalData';
import { supplierOptions } from '@/hooks/material/useArrivalData';

interface ArrivalModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: ArrivalCreateForm;
  setForm: React.Dispatch<React.SetStateAction<ArrivalCreateForm>>;
  onSubmit: () => void;
}

export default function ArrivalModal({ isOpen, onClose, form, setForm, onSubmit }: ArrivalModalProps) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.modalTitle')} size="md">
      <div className="space-y-4">
        <Select
          label={t('material.col.supplier')}
          options={supplierOptions.slice(1)}
          value={form.supplier}
          onChange={(v) => setForm((prev) => ({ ...prev, supplier: v }))}
          fullWidth
        />
        <Input
          label={t('common.partCode')}
          placeholder={t('material.arrival.partCodePlaceholder')}
          value={form.itemCode}
          onChange={(e) => setForm((prev) => ({ ...prev, itemCode: e.target.value }))}
          fullWidth
        />
        <Input
          label={t('material.col.lotNo')}
          placeholder={t('material.arrival.lotNoPlaceholder')}
          value={form.lotNo}
          onChange={(e) => setForm((prev) => ({ ...prev, lotNo: e.target.value }))}
          fullWidth
        />
        <Input
          label={t('common.quantity')}
          type="number"
          placeholder="0"
          value={form.quantity}
          onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
          fullWidth
        />
        <Input
          label={t('common.remark')}
          placeholder={t('material.arrival.remarkPlaceholder')}
          value={form.remark}
          onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
          fullWidth
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit}>
            <Plus className="w-4 h-4 mr-1" /> {t('common.register')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
