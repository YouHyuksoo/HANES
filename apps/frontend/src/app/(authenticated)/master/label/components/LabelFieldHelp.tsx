"use client";

/**
 * @file src/app/(authenticated)/master/label/components/LabelFieldHelp.tsx
 * @description 라벨 템플릿 기본정보 입력 필드별 도움말(? 툴팁) 정의 + Field 래퍼.
 *              품목관리 PartFieldHelp.tsx 패턴을 그대로 따른다.
 *              ⚠️ 캔버스/디자이너/ZPL 에디터 등 특수 위젯은 대상이 아니다.
 *              현재 화면(page.tsx)에 실제로 노출되는 단순 입력 필드는
 *              "템플릿 이름"(templateName) 하나뿐이다.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HelpTooltip } from "@/components/shared";

export const LABEL_FIELD_HELP = {
  templateName: {
    db: "LABEL_TEMPLATES.TEMPLATE_NAME",
    description: "라벨 템플릿을 식별할 이름입니다. 같은 카테고리 안에서 중복될 수 없습니다.",
  },
} as const;

export type LabelFieldKey = keyof typeof LABEL_FIELD_HELP;

type FieldLabelProps = {
  field: LabelFieldKey;
  label: string;
  required?: boolean;
};

export function FieldLabel({ field, label, required }: FieldLabelProps) {
  const { t } = useTranslation();
  const help = LABEL_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.label.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
    </label>
  );
}

type FieldProps = FieldLabelProps & {
  className?: string;
  children: ReactNode;
};

export function Field({ field, label, required, className = "", children }: FieldProps) {
  return (
    <div className={className}>
      <FieldLabel field={field} label={label} required={required} />
      {children}
    </div>
  );
}
