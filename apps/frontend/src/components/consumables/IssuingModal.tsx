"use client";

/**
 * @file src/pages/consumables/issuing/components/IssuingModal.tsx
 * @description 출고등록 모달 컴포넌트
 */
import { useState } from 'react';
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
  equipmentId: string;
  issueReason: string;
  remark: string;
}

const defaultValues: IssuingFormValues = {
  consumableId: '',
  qty: 1,
  department: '',
  lineId: '',
  equipmentId: '',
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
    <Modal isOpen={isOpen} onClose={handleClose} title="출고 등록" size="md">
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
          label="출고부서"
          value={form.department}
          onChange={(e) => handleChange('department', e.target.value)}
          placeholder="출고부서 입력"
          fullWidth
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="라인"
            value={form.lineId}
            onChange={(e) => handleChange('lineId', e.target.value)}
            placeholder="라인 입력"
            fullWidth
          />
          <Input
            label="설비"
            value={form.equipmentId}
            onChange={(e) => handleChange('equipmentId', e.target.value)}
            placeholder="설비 입력"
            fullWidth
          />
        </div>
        <Select
          label="출고사유"
          options={[
            { value: 'PRODUCTION', label: '생산투입' },
            { value: 'REPAIR', label: '수리' },
            { value: 'OTHER', label: '기타' },
          ]}
          value={form.issueReason}
          onChange={(val) => handleChange('issueReason', val)}
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

export default IssuingModal;
