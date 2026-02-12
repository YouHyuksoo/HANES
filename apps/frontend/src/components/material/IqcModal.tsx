"use client";

/**
 * @file src/pages/material/iqc/components/IqcModal.tsx
 * @description IQC 검사결과 등록 모달 컴포넌트
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

export default function IqcModal({ isOpen, onClose, selectedItem, form, setForm, onSubmit }: IqcModalProps) {
  const { t } = useTranslation();
  const resultOptions = useMemo(() => [
    { value: '', label: t('material.iqc.resultSelect') },
    { value: 'PASSED', label: t('material.iqc.passed') },
    { value: 'FAILED', label: t('material.iqc.failed') },
  ], [t]);

  if (!selectedItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('material.iqc.modalTitle')} size="md">
      <div className="space-y-4">
        {/* 입하 정보 표시 */}
        <div className="p-3 bg-background rounded-lg space-y-1">
          <p className="text-sm text-text-muted">
            {t('material.iqc.arrivalNoLabel')}: <span className="font-medium text-text">{selectedItem.receiveNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.iqc.partLabel')}: <span className="font-medium text-text">{selectedItem.partName} ({selectedItem.partCode})</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.iqc.lotLabel')}: <span className="font-medium text-text">{selectedItem.lotNo}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.iqc.quantityLabel')}: <span className="font-medium text-text">{selectedItem.quantity.toLocaleString()} {selectedItem.unit}</span>
          </p>
          <p className="text-sm text-text-muted">
            {t('material.iqc.supplierLabel')}: <span className="font-medium text-text">{selectedItem.supplierName}</span>
          </p>
        </div>

        {/* 검사결과 입력 */}
        <Select
          label={t('material.iqc.resultLabel')}
          options={resultOptions}
          value={form.result}
          onChange={(v) => setForm((prev) => ({ ...prev, result: v as IqcResultForm['result'] }))}
          fullWidth
        />
        <Input
          label={t('material.iqc.inspectorLabel')}
          placeholder={t('material.iqc.inspectorPlaceholder')}
          value={form.inspector}
          onChange={(e) => setForm((prev) => ({ ...prev, inspector: e.target.value }))}
          fullWidth
        />
        <Input
          label={t('common.remark')}
          placeholder={t('material.iqc.remarkPlaceholder')}
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
            <XCircle className="w-4 h-4 mr-1 text-red-500" /> {t('material.iqc.failed')}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setForm((prev) => ({ ...prev, result: 'PASSED' }));
              onSubmit();
            }}
          >
            <CheckCircle className="w-4 h-4 mr-1" /> {t('material.iqc.passed')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
