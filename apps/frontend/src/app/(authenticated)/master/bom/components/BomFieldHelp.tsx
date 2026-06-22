"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui";
import { ComCodeSelect, ProcessSelect, HelpTooltip } from "@/components/shared";

export const BOM_FIELD_HELP = {
  parentPart: { db: "BOM_MASTERS.PARENT_ITEM_CODE", description: "이 BOM의 기준이 되는 상위(부모) 품목입니다." },
  childPartCode: { db: "BOM_MASTERS.CHILD_ITEM_CODE", description: "상위 품목에 투입되는 하위(자) 품목입니다. 품목코드로 검색해 선택합니다." },
  qtyPer: { db: "BOM_MASTERS.QTY_PER", description: "상위 품목 1개를 만들 때 투입되는 자품목 수량(소요량)입니다." },
  seq: { db: "BOM_MASTERS.SEQ", description: "BOM 목록에서의 표시 순서입니다." },
  revision: { db: "BOM_MASTERS.REVISION", description: "이 BOM 구성의 리비전입니다. 같은 부모·자품목이라도 리비전으로 구분합니다." },
  processCode: { db: "BOM_MASTERS.OPER", description: "이 자품목이 투입되는 공정입니다." },
  side: { db: "BOM_MASTERS.SIDE", description: "투입 위치(사이드) 구분입니다." },
  remark: { db: "BOM_MASTERS.REMARK", description: "BOM 구성 참고사항입니다." },
  validFrom: { db: "BOM_MASTERS.VALID_FROM", description: "이 BOM 구성이 적용되기 시작하는 날짜입니다." },
  validTo: { db: "BOM_MASTERS.VALID_TO", description: "이 BOM 구성의 적용이 끝나는 날짜입니다." },
} as const;

export type BomFieldKey = keyof typeof BOM_FIELD_HELP;

type FieldBaseProps = {
  field: BomFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = BOM_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.bom.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: BomFieldKey;
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

type FieldComCodeSelectProps = Omit<ComponentProps<typeof ComCodeSelect>, "label"> & {
  field: BomFieldKey;
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

type FieldProcessSelectProps = Omit<ComponentProps<typeof ProcessSelect>, "label"> & {
  field: BomFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldProcessSelect({ field, label, required, wrapperClassName, ...props }: FieldProcessSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <ProcessSelect {...props} required={required} fullWidth />
    </Field>
  );
}
