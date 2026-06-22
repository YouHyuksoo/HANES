"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui";
import { HelpTooltip } from "@/components/shared";

export const WORK_INSTRUCTION_FIELD_HELP = {
  itemCode: { db: "WORK_INSTRUCTIONS.ITEM_CODE", description: "작업지도서를 적용할 대상 품목 코드입니다. (ITEM_MASTERS.ITEM_CODE 참조)" },
  processCode: { db: "WORK_INSTRUCTIONS.PROCESS_CODE", description: "작업지도서가 적용되는 공정 코드입니다. 품목·리비전과 함께 문서를 식별하는 키입니다." },
  title: { db: "WORK_INSTRUCTIONS.TITLE", description: "작업지도서의 제목입니다. 현장에서 문서를 구분할 이름입니다." },
  revision: { db: "WORK_INSTRUCTIONS.REVISION", description: "작업지도서 사양의 리비전입니다. 비워두면 A로 처리됩니다." },
  imageUrl: { db: "WORK_INSTRUCTIONS.IMAGE_URL", description: "첨부 파일 대신 외부 이미지/문서 URL을 직접 입력할 때 사용합니다." },
  content: { db: "WORK_INSTRUCTIONS.CONTENT", description: "작업 순서, 주의사항 등 작업지도 본문 내용입니다." },
} as const;

export type WorkInstructionFieldKey = keyof typeof WORK_INSTRUCTION_FIELD_HELP;

type FieldBaseProps = {
  field: WorkInstructionFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = WORK_INSTRUCTION_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip
        description={t(`master.workInstruction.fieldHelp.${field}`, help.description)}
        db={help.db}
        dataField={field}
      />
    </label>
  );
}

export function Field({ field, label, required, className = "", children }: FieldBaseProps) {
  return (
    <div className={className}>
      <FieldLabel field={field} label={label} required={required} />
      {children}
    </div>
  );
}

type FieldInputProps = Omit<InputProps, "label"> & {
  field: WorkInstructionFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldInput({ field, label, required, wrapperClassName, ...props }: FieldInputProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <Input {...props} required={required} fullWidth />
    </Field>
  );
}
