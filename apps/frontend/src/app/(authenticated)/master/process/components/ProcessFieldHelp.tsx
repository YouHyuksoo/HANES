"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { ComCodeSelect, HelpTooltip } from "@/components/shared";

export const PROCESS_FIELD_HELP = {
  processCode: { db: "PROCESS_MASTERS.PROCESS_CODE", description: "MES 내부에서 공정을 식별하는 고유 코드입니다. 등록 후에는 변경할 수 없습니다." },
  processType: { db: "PROCESS_MASTERS.PROCESS_TYPE", description: "공정의 유형을 구분하는 코드입니다." },
  processName: { db: "PROCESS_MASTERS.PROCESS_NAME", description: "현장에서 식별할 공정명입니다." },
  processCategory: { db: "PROCESS_MASTERS.PROCESS_CATEGORY", description: "공정 대분류(조립, 검사 등)를 나타내는 코드입니다." },
  lineType: { db: "PROCESS_MASTERS.LINE_TYPE", description: "공정 라인구분입니다. 저전압/고전압/공통 등으로 구분합니다." },
  sortOrder: { db: "PROCESS_MASTERS.SORT_ORDER", description: "목록에서의 정렬 순서입니다. 작은 값이 먼저 표시됩니다." },
  remark: { db: "PROCESS_MASTERS.REMARK", description: "공정 관리 참고사항입니다." },
} as const;

export type ProcessFieldKey = keyof typeof PROCESS_FIELD_HELP;

type FieldBaseProps = {
  field: ProcessFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = PROCESS_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.process.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: ProcessFieldKey;
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

type FieldSelectProps = Omit<SelectProps, "label"> & {
  field: ProcessFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldSelect({ field, label, required, wrapperClassName, ...props }: FieldSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <Select {...props} required={required} fullWidth />
    </Field>
  );
}

type FieldComCodeSelectProps = Omit<ComponentProps<typeof ComCodeSelect>, "label"> & {
  field: ProcessFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldComCodeSelect({ field, label, required, wrapperClassName, ...props }: FieldComCodeSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <ComCodeSelect {...props} required={required} fullWidth />
    </Field>
  );
}
