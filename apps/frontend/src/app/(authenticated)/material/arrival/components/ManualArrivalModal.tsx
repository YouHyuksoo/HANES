"use client";

/**
 * @file src/app/(authenticated)/material/arrival/components/ManualArrivalModal.tsx
 * @description 수동 입하 등록 모달 - PO 없이 직접 품목/수량 지정
 *
 * 초보자 가이드:
 * 1. **품목 선택**: PartSelect 공유 컴포넌트 사용
 * 2. **창고 선택**: WarehouseSelect 공유 컴포넌트 사용
 * 3. **LOT 번호**: 미입력 시 서버에서 자동 생성
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input } from '@/components/ui';
import { PartSelect, WarehouseSelect } from '@/components/shared';
import api from '@/services/api';

interface ManualArrivalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  itemCode: string;
  warehouseCode: string;
  qty: string;
  supUid: string;
  manufactureDate: string;
  vendor: string;
  remark: string;
}

const INITIAL_FORM: FormState = {
  itemCode: '',
  warehouseCode: '',
  qty: '',
  supUid: '',
  manufactureDate: '',
  vendor: '',
  remark: '',
};

export default function ManualArrivalModal({ isOpen, onClose, onSuccess }: ManualArrivalModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(INITIAL_FORM);
  }, [isOpen]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.itemCode || !form.warehouseCode || !form.qty) return;
    setSubmitting(true);
    try {
      await api.post('/material/arrivals/manual', {
        itemCode: form.itemCode,
        warehouseCode: form.warehouseCode,
        qty: Number(form.qty),
        supUid: form.supUid || undefined,
        manufactureDate: form.manufactureDate || undefined,
        vendor: form.vendor || undefined,
        remark: form.remark || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('수동 입하 등록 실패:', err);
    }
    setSubmitting(false);
  };

  const isValid = form.itemCode && form.warehouseCode && Number(form.qty) > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.arrival.manualArrival')} size="xl">
      <div className="space-y-4">
        <PartSelect
          label={t('common.partName')}
          value={form.itemCode}
          onChange={(v) => handleChange('itemCode', v)}
          placeholder={t('material.arrival.selectPart')}
          fullWidth
        />
        <WarehouseSelect
          label={t('material.arrival.col.warehouse')}
          value={form.warehouseCode}
          onChange={(v) => handleChange('warehouseCode', v)}
          placeholder={t('material.arrival.selectWarehouse')}
          fullWidth
        />
        <Input
          label={t('common.quantity')}
          type="number"
          min={1}
          placeholder="0"
          value={form.qty}
          onChange={(e) => handleChange('qty', e.target.value)}
          fullWidth
        />
        <Input
          label={t('material.col.supUid')}
          placeholder={t('material.arrival.supUidPlaceholder')}
          value={form.supUid}
          onChange={(e) => handleChange('supUid', e.target.value)}
          fullWidth
        />
        <Input
          label={t('material.arrival.col.manufactureDate')}
          type="date"
          value={form.manufactureDate}
          onChange={(e) => handleChange('manufactureDate', e.target.value)}
          fullWidth
        />
        <Input
          label={t('material.arrival.col.vendor')}
          placeholder={t('material.arrival.vendorPlaceholder')}
          value={form.vendor}
          onChange={(e) => handleChange('vendor', e.target.value)}
          fullWidth
        />
        <Input
          label={t('common.remark')}
          placeholder={t('material.arrival.remarkPlaceholder')}
          value={form.remark}
          onChange={(e) => handleChange('remark', e.target.value)}
          fullWidth
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? t('common.processing') : t('common.register')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
