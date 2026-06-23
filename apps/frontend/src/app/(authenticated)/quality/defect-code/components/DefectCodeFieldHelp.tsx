"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { ComCodeSelect, HelpTooltip } from "@/components/shared";

export const DEFECT_CODE_FIELD_HELP = {
  defectCode: {
    db: "DEFECT_CODES.DEFECT_CODE",
    description: "불량코드 마스터에서 이 불량을 식별하는 고유 코드입니다.\n등록 후에는 변경할 수 없습니다.",
  },
  defectName: {
    db: "DEFECT_CODES.DEFECT_NAME",
    description: "불량의 이름입니다. 현장에서 바로 식별할 수 있도록 명확하게 입력하세요.",
  },
  level1: {
    db: "DEFECT_CODE_CATEGORIES.CATEGORY_CODE (LEVEL=1)",
    description: "1레벨(최상위) 분류입니다.\n검사단계(수입/공정/출하 등)나 발생 영역을 구분합니다.",
  },
  level2: {
    db: "DEFECT_CODE_CATEGORIES.CATEGORY_CODE (LEVEL=2)",
    description:
      "2레벨 분류입니다.\n모델군(저전압/고전압 등)이나 부품 계열을 구분합니다.\n불량코드의 적용 모델이 이 레벨로 결정됩니다.",
  },
  level3: {
    db: "DEFECT_CODE_CATEGORIES.CATEGORY_CODE (LEVEL=3)",
    description:
      "3레벨(최하위) 분류입니다.\n불량코드가 실제로 연결되는 분류 항목입니다.\n1·2레벨을 먼저 선택해야 목록이 나타납니다.",
  },
  defectGrade: {
    db: "DEFECT_CODES.DEFECT_GRADE",
    description:
      "불량의 심각도 등급입니다.\n\n" +
      "• CRITICAL(치명): 안전·법규에 영향하거나 제품 기능 전체 불가. 즉시 생산 중단 필요.\n" +
      "• MAJOR(중): 제품 기능에 영향하나 치명적이지 않음. 재작업·수리 필요.\n" +
      "• MINOR(경): 외관 또는 경미한 품질 영향. 고객 합의 수준에서 허용 가능.",
  },
  defectScope: {
    db: "DEFECT_CODES.DEFECT_SCOPE",
    description:
      "이 불량코드를 적용할 검사 단계 또는 영역입니다.\n\n" +
      "• COMMON(공통): 모든 영역에 공통 적용.\n" +
      "• RAW_MATERIAL(원자재): 수입검사(IQC) 단계에서만 사용.\n" +
      "• PROCESS(공정): 생산 공정 중 발생 불량에 사용.\n" +
      "• PRODUCT(제품): 완제품 출하검사 단계에서만 사용.",
  },
  useYn: {
    db: "DEFECT_CODES.USE_YN",
    description:
      "비활성화된 불량코드는 신규 불량 등록 시 선택 목록에 나타나지 않습니다.",
  },
  description: {
    db: "DEFECT_CODES.DESCRIPTION",
    description:
      "불량코드에 대한 보충 설명입니다.\n발생 원인, 판정 기준 등을 기록하세요.",
  },
  categoryLevel: {
    db: "DEFECT_CODE_CATEGORIES.LEVEL_NO",
    description:
      "분류 계층입니다. 1→2→3 순서로 상위→하위 관계를 구성합니다.\n2·3레벨 추가 시 상위 분류를 먼저 선택하세요.",
  },
  parentCategory: {
    db: "DEFECT_CODE_CATEGORIES.PARENT_CATEGORY_CODE",
    description:
      "상위 분류 코드입니다.\n2·3레벨 분류를 추가할 때 소속될 상위 분류를 지정합니다.",
  },
  categoryCode: {
    db: "DEFECT_CODE_CATEGORIES.CATEGORY_CODE",
    description:
      "분류를 식별하는 코드입니다.\n대문자 영문·숫자로 입력하세요. 등록 후에는 변경할 수 없습니다.",
  },
  categoryName: {
    db: "DEFECT_CODE_CATEGORIES.CATEGORY_NAME",
    description: "분류 이름입니다. 현장에서 식별 가능한 한글 명칭을 입력하세요.",
  },
} as const;

export type DefectCodeFieldKey = keyof typeof DEFECT_CODE_FIELD_HELP;

type FieldBaseProps = {
  field: DefectCodeFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = DEFECT_CODE_FIELD_HELP[field];
  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip
        description={t(`quality.defectCode.fieldHelp.${field}`, help.description)}
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
  field: DefectCodeFieldKey;
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
  field: DefectCodeFieldKey;
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
  field: DefectCodeFieldKey;
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
