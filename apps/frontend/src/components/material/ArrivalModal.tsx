"use client";

/**
 * @file src/pages/material/arrival/components/ArrivalModal.tsx
 * @description 입하 등록 모달 컴포넌트
 */
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="입하 등록" size="md">
      <div className="space-y-4">
        <Select
          label="공급업체"
          options={supplierOptions.slice(1)}
          value={form.supplier}
          onChange={(v) => setForm((prev) => ({ ...prev, supplier: v }))}
          fullWidth
        />
        <Input
          label="품목코드"
          placeholder="품목코드 입력"
          value={form.partCode}
          onChange={(e) => setForm((prev) => ({ ...prev, partCode: e.target.value }))}
          fullWidth
        />
        <Input
          label="LOT번호"
          placeholder="LOT번호 입력 (자동생성 가능)"
          value={form.lotNo}
          onChange={(e) => setForm((prev) => ({ ...prev, lotNo: e.target.value }))}
          fullWidth
        />
        <Input
          label="수량"
          type="number"
          placeholder="0"
          value={form.quantity}
          onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
          fullWidth
        />
        <Input
          label="비고"
          placeholder="비고 입력"
          value={form.remark}
          onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
          fullWidth
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onSubmit}>
            <Plus className="w-4 h-4 mr-1" /> 등록
          </Button>
        </div>
      </div>
    </Modal>
  );
}
