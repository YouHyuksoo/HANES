"use client";

/**
 * @file quality/capa/components/TextInputModal.tsx
 * @description CAPA 텍스트 입력 모달 — 원인분석, 조치계획, 검증결과 입력용
 */
import { ConfirmModal } from "@/components/ui";

interface Props {
  isOpen: boolean;
  title: string;
  fieldLabel: string;
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function TextInputModal({ isOpen, title, fieldLabel, value, onChange, onConfirm, onClose }: Props) {
  return (
    <ConfirmModal isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} title={title}
      message={
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text">{fieldLabel}</label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900 text-text px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={value} onChange={e => onChange(e.target.value)} placeholder={fieldLabel} />
        </div>
      } />
  );
}
