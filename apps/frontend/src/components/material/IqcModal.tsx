"use client";

/**
 * @file src/pages/material/iqc/components/IqcModal.tsx
 * @description IQC 검사결과 등록 모달 컴포넌트
 */
import { CheckCircle, XCircle } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import type { IqcItem, IqcResultForm } from '@/hooks/material/useIqcData';

interface IqcModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: IqcItem | null;
  form: IqcResultForm;
  setForm: React.Dispatch<React.SetStateAction<IqcResultForm>>;
  onSubmit: () => void;
}

const resultOptions = [
  { value: '', label: '결과 선택' },
  { value: 'PASSED', label: '합격' },
  { value: 'FAILED', label: '불합격' },
];

export default function IqcModal({ isOpen, onClose, selectedItem, form, setForm, onSubmit }: IqcModalProps) {
  if (!selectedItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="IQC 검사결과 등록" size="md">
      <div className="space-y-4">
        {/* 입하 정보 표시 */}
        <div className="p-3 bg-background rounded-lg space-y-1">
          <p className="text-sm text-text-muted">
            입하번호: <span className="font-medium text-text">{selectedItem.receiveNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            품목: <span className="font-medium text-text">{selectedItem.partName} ({selectedItem.partCode})</span>
          </p>
          <p className="text-sm text-text-muted">
            LOT: <span className="font-medium text-text">{selectedItem.lotNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            수량: <span className="font-medium text-text">{selectedItem.quantity.toLocaleString()} {selectedItem.unit}</span>
          </p>
          <p className="text-sm text-text-muted">
            공급업체: <span className="font-medium text-text">{selectedItem.supplierName}</span>
          </p>
        </div>

        {/* 검사결과 입력 */}
        <Select
          label="검사결과"
          options={resultOptions}
          value={form.result}
          onChange={(v) => setForm((prev) => ({ ...prev, result: v as IqcResultForm['result'] }))}
          fullWidth
        />
        <Input
          label="검사자"
          placeholder="검사자명 입력"
          value={form.inspector}
          onChange={(e) => setForm((prev) => ({ ...prev, inspector: e.target.value }))}
          fullWidth
        />
        <Input
          label="비고"
          placeholder="검사 비고사항"
          value={form.remark}
          onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
          fullWidth
        />

        {/* 버튼 (빠른 결정) */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <Button
            className="flex-1"
            variant="secondary"
            onClick={() => {
              setForm((prev) => ({ ...prev, result: 'FAILED' }));
              onSubmit();
            }}
          >
            <XCircle className="w-4 h-4 mr-1 text-red-500" /> 불합격
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setForm((prev) => ({ ...prev, result: 'PASSED' }));
              onSubmit();
            }}
          >
            <CheckCircle className="w-4 h-4 mr-1" /> 합격
          </Button>
        </div>
      </div>
    </Modal>
  );
}
