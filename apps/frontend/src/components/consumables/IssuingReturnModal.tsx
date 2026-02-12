"use client";

/**
 * @file src/pages/consumables/issuing/components/IssuingReturnModal.tsx
 * @description 출고반품 모달 컴포넌트
 */
import { useState } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';

interface IssuingReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReturnFormValues) => void;
}

interface ReturnFormValues {
  consumableId: string;
  qty: number;
  returnReason: string;
  remark: string;
}

const defaultValues: ReturnFormValues = {
  consumableId: '',
  qty: 1,
  returnReason: '',
  remark: '',
};

/** 소모품 목록 (TODO: API에서 로드) */
const consumableOptions = [
  { value: 'c1', label: 'MOLD-001 - 압착금형 A타입' },
  { value: 'c2', label: 'TOOL-001 - 절단날 표준형' },
  { value: 'c3', label: 'JIG-001 - 조립지그 001' },
];

function IssuingReturnModal({ isOpen, onClose, onSubmit }: IssuingReturnModalProps) {
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
    <Modal isOpen={isOpen} onClose={handleClose} title="출고반품 등록" size="md">
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
        <Input
          label="반품사유"
          value={form.returnReason}
          onChange={(e) => handleChange('returnReason', e.target.value)}
          placeholder="반품사유 입력"
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

export default IssuingReturnModal;
