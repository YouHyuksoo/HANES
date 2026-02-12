"use client";

/**
 * @file src/pages/consumables/receiving/components/ReceivingModal.tsx
 * @description 입고등록 모달 컴포넌트
 */
import { useState } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';

interface ReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReceivingFormValues) => void;
}

interface ReceivingFormValues {
  consumableId: string;
  qty: number;
  vendorCode: string;
  vendorName: string;
  unitPrice: number | null;
  incomingType: string;
  remark: string;
}

const defaultValues: ReceivingFormValues = {
  consumableId: '',
  qty: 1,
  vendorCode: '',
  vendorName: '',
  unitPrice: null,
  incomingType: 'NEW',
  remark: '',
};

/** 소모품 목록 (TODO: API에서 로드) */
const consumableOptions = [
  { value: 'c1', label: 'MOLD-001 - 압착금형 A타입' },
  { value: 'c2', label: 'TOOL-001 - 절단날 표준형' },
  { value: 'c3', label: 'JIG-001 - 조립지그 001' },
];

function ReceivingModal({ isOpen, onClose, onSubmit }: ReceivingModalProps) {
  const [form, setForm] = useState<ReceivingFormValues>(defaultValues);

  const handleChange = (field: keyof ReceivingFormValues, value: string | number | null) => {
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
    <Modal isOpen={isOpen} onClose={handleClose} title="입고 등록" size="md">
      <div className="space-y-4">
        <Select
          label="소모품"
          options={consumableOptions}
          value={form.consumableId}
          onChange={(val) => handleChange('consumableId', val)}
          fullWidth
        />
        <Input
          label="수량"
          type="number"
          value={String(form.qty)}
          onChange={(e) => handleChange('qty', Number(e.target.value))}
          fullWidth
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="공급업체코드"
            value={form.vendorCode}
            onChange={(e) => handleChange('vendorCode', e.target.value)}
            fullWidth
          />
          <Input
            label="공급업체명"
            value={form.vendorName}
            onChange={(e) => handleChange('vendorName', e.target.value)}
            fullWidth
          />
        </div>
        <Input
          label="단가"
          type="number"
          value={form.unitPrice != null ? String(form.unitPrice) : ''}
          onChange={(e) => handleChange('unitPrice', e.target.value ? Number(e.target.value) : null)}
          placeholder="단가 입력"
          fullWidth
        />
        <Select
          label="입고구분"
          options={[
            { value: 'NEW', label: '신규' },
            { value: 'REPLACEMENT', label: '교체' },
          ]}
          value={form.incomingType}
          onChange={(val) => handleChange('incomingType', val)}
          fullWidth
        />
        <Input
          label="비고"
          value={form.remark}
          onChange={(e) => handleChange('remark', e.target.value)}
          placeholder="비고 입력"
          fullWidth
        />
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
        <Button variant="secondary" onClick={handleClose}>취소</Button>
        <Button onClick={handleSubmit}>등록</Button>
      </div>
    </Modal>
  );
}

export default ReceivingModal;
