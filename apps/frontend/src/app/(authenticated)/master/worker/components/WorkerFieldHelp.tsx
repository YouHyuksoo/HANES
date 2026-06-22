"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { ComCodeSelect, DepartmentSelect, HelpTooltip } from "@/components/shared";

export const WORKER_FIELD_HELP = {
  workerCode: { db: "WORKER_MASTERS.WORKER_CODE", description: "작업자를 식별하는 고유 코드(사번)입니다. 등록 후에는 변경할 수 없습니다." },
  workerName: { db: "WORKER_MASTERS.WORKER_NAME", description: "작업자의 이름입니다." },
  engName: { db: "WORKER_MASTERS.ENG_NAME", description: "작업자의 영문 이름입니다." },
  dept: { db: "WORKER_MASTERS.DEPT", description: "작업자가 소속된 부서입니다." },
  position: { db: "WORKER_MASTERS.POSITION", description: "작업자의 직급입니다." },
  phone: { db: "WORKER_MASTERS.PHONE", description: "작업자의 연락처(전화번호)입니다." },
  email: { db: "WORKER_MASTERS.EMAIL", description: "작업자의 이메일 주소입니다." },
  qrCode: { db: "WORKER_MASTERS.QR_CODE", description: "키오스크 등에서 작업자를 식별하는 QR 스캔용 코드입니다." },
  hireDate: { db: "WORKER_MASTERS.HIRE_DATE", description: "작업자의 입사일입니다." },
  quitDate: { db: "WORKER_MASTERS.QUIT_DATE", description: "작업자의 퇴사일입니다. 재직 중이면 비워둡니다." },
  useYn: { db: "WORKER_MASTERS.USE_YN", description: "신규 조회, 선택, 사용 가능 여부입니다." },
  remark: { db: "WORKER_MASTERS.REMARK", description: "작업자 관리 참고사항입니다." },
} as const;

export type WorkerFieldKey = keyof typeof WORKER_FIELD_HELP;

type FieldBaseProps = {
  field: WorkerFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = WORKER_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.worker.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: WorkerFieldKey;
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
  field: WorkerFieldKey;
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
  field: WorkerFieldKey;
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

type FieldDepartmentSelectProps = Omit<ComponentProps<typeof DepartmentSelect>, "label"> & {
  field: WorkerFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldDepartmentSelect({ field, label, required, wrapperClassName, ...props }: FieldDepartmentSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <DepartmentSelect {...props} required={required} fullWidth />
    </Field>
  );
}
