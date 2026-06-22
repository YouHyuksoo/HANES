"use client";

/**
 * @file components/IqcItemFieldHelp.tsx
 * @description 검사항목마스터 등록/수정 폼의 필드별 ? 도움말 정의 + Field 래퍼.
 *  - 다른 기준정보 화면(Part/Bom/Equip)과 동일하게 HelpTooltip로 필드 옆 ? 노출.
 *  - 설명은 i18n master.iqcItem.fieldHelp.{field}, 없으면 아래 한글 fallback.
 */
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { ComCodeSelect, HelpTooltip } from "@/components/shared";

export const IQC_ITEM_FIELD_HELP = {
  itemCode: {
    db: "IQC_ITEM_POOL.INSP_ITEM_CODE",
    description:
      "검사항목을 식별하는 고유 코드입니다. 품목별 IQC 기준에서 이 코드로 항목을 참조하며, 등록 후에는 변경할 수 없습니다.",
  },
  judgeMethod: {
    db: "IQC_ITEM_POOL.JUDGE_METHOD",
    description:
      "검사 결과 판정 방식입니다.\n" +
      "• 육안(VISUAL): 눈으로 합/불 판정(외관 등)\n" +
      "• 계측(MEASURE): 측정기 값으로 규격과 비교(치수 등). 단위 지정을 권장합니다.",
  },
  itemName: {
    db: "IQC_ITEM_POOL.INSP_ITEM_NAME",
    description: "검사항목 이름입니다. 예: 외관, 치수, 인장강도. 현장 검사자가 보는 명칭입니다.",
  },
  unit: {
    db: "IQC_ITEM_POOL.UNIT",
    description:
      "계측 항목의 측정 단위입니다(mm, g 등). 공통코드 UNIT_TYPE에서 선택하며, 육안 항목은 비워도 됩니다.",
  },
} as const;

export type IqcItemFieldKey = keyof typeof IQC_ITEM_FIELD_HELP;

type FieldBaseProps = {
  field: IqcItemFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = IQC_ITEM_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.iqcItem.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: IqcItemFieldKey;
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
  field: IqcItemFieldKey;
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
  field: IqcItemFieldKey;
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
