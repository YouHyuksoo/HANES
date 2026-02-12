"use client";

/**
 * @file src/pages/material/receiving/components/ReceivingConfirmModal.tsx
 * @description 입고확정 모달 - 창고/위치 선택 후 입고확정 처리
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { ReceivingItem, ReceivingConfirmForm } from '@/hooks/material/useReceivingData';
import { warehouseOptions } from '@/hooks/material/useReceivingData';

interface ReceivingConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: ReceivingItem | null;
  form: ReceivingConfirmForm;
  setForm: React.Dispatch<React.SetStateAction<ReceivingConfirmForm>>;
  onSubmit: () => void;
}

export default function ReceivingConfirmModal({
  isOpen,
  onClose,
  selectedItem,
  form,
  setForm,
  onSubmit,
}: ReceivingConfirmModalProps) {
  const { t } = useTranslation();
  if (!selectedItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.receive.modalTitle')} size="md">
      <div className="space-y-4">
        {/* 입하 정보 표시 */}
        <div className="p-3 bg-background rounded-lg space-y-1">
          <p className="text-sm text-text-muted">
            {t('material.receive.arrivalNoLabel')}: <span className="font-medium text-text">{selectedItem.receiveNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.receive.partLabel')}: <span className="font-medium text-text">{selectedItem.partName} ({selectedItem.partCode})</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.receive.lotLabel')}: <span className="font-medium text-text">{selectedItem.lotNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.receive.quantityLabel')}: <span className="font-medium text-text">{selectedItem.quantity.toLocaleString()} {selectedItem.unit}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.receive.supplierLabel')}: <span className="font-medium text-text">{selectedItem.supplierName}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.receive.iqcPassedLabel')}: <span className="font-medium text-primary">{selectedItem.iqcPassedAt}</span>
          </p>
        </div>

        {/* 창고/위치 선택 */}
        <Select
          label={t('material.receive.warehouseLabel')}
          options={warehouseOptions}
          value={form.warehouse}
          onChange={(v) => setForm((prev) => ({ ...prev, warehouse: v }))}
          fullWidth
        />
        <Input
          label={t('material.receive.locationLabel')}
          placeholder={t('material.receive.locationPlaceholder')}
          value={form.location}
          onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          fullWidth
        />
        <Input
          label={t('common.remark')}
          placeholder={t('material.receive.remarkPlaceholder')}
          value={form.remark}
          onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
          fullWidth
        />

        {/* 확정 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={!form.warehouse}>
            <CheckCircle className="w-4 h-4 mr-1" /> {t('material.receive.confirmReceiving')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
