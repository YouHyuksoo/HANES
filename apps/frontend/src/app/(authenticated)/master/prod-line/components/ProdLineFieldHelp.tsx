"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui";
import { HelpTooltip } from "@/components/shared";

export const PROD_LINE_FIELD_HELP = {
  lineCode: { db: "PROD_LINE_MASTERS.LINE_CODE", description: "MES 내부에서 생산라인을 식별하는 고유 코드입니다. 등록 후에는 변경할 수 없습니다." },
  lineName: { db: "PROD_LINE_MASTERS.LINE_NAME", description: "현장에서 식별할 생산라인 이름입니다." },
  oper: { db: "PROD_LINE_MASTERS.OPER", description: "이 라인에 매핑되는 ERP 공정코드입니다." },
  lineType: { db: "PROD_LINE_MASTERS.LINE_TYPE", description: "조립, 포장 등 라인 유형을 구분하는 분류입니다." },
  whLoc: { db: "PROD_LINE_MASTERS.WH_LOC", description: "이 라인에 연계되는 기본 창고 로케이션입니다." },
  erpCode: { db: "PROD_LINE_MASTERS.ERP_CODE", description: "ERP 시스템에서 사용하는 라인 연계 코드입니다." },
  remark: { db: "PROD_LINE_MASTERS.REMARK", description: "생산라인 관리 참고사항입니다." },
} as const;

export type ProdLineFieldKey = keyof typeof PROD_LINE_FIELD_HELP;

type FieldBaseProps = {
  field: ProdLineFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = PROD_LINE_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.prodLine.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: ProdLineFieldKey;
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
