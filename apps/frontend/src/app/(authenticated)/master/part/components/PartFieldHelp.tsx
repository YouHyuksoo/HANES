"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { ComCodeSelect, HelpTooltip } from "@/components/shared";

export const PART_FIELD_HELP = {
  itemCode: { db: "ITEM_MASTERS.ITEM_CODE", description: "MES 내부에서 품목을 식별하는 고유 코드입니다." },
  itemNo: { db: "ITEM_MASTERS.PART_NO", description: "도면, ERP, 고객 문서에서 쓰는 품번입니다." },
  itemName: { db: "ITEM_MASTERS.ITEM_NAME", description: "현장에서 식별할 품목명입니다." },
  custPartNo: { db: "ITEM_MASTERS.CUST_PART_NO", description: "고객사가 사용하는 품번입니다." },
  rev: { db: "ITEM_MASTERS.REV", description: "품목 도면 또는 사양의 리비전입니다." },
  markingText: { db: "ITEM_MASTERS.MARKING_TEXT", description: "라벨, 마킹 설비 등에 전달할 표시 문구입니다." },
  itemType: { db: "ITEM_MASTERS.ITEM_TYPE", description: "원자재, 반제품, 완제품 등 MES 흐름 분류입니다." },
  productType: { db: "ITEM_MASTERS.PRODUCT_TYPE", description: "품목군 또는 제품 계열을 나타내는 코드입니다." },
  modelName: { db: "ITEM_MASTERS.MODEL_NAME", description: "차량 모델 또는 차종을 구분하는 품목 관리 특성입니다." },
  spec: { db: "ITEM_MASTERS.SPEC", description: "품목 규격, 사양, 치수 등 보조 설명입니다." },
  color: { db: "ITEM_MASTERS.COLOR", description: "전선색 등 품목 색상 정보입니다." },
  unit: { db: "ITEM_MASTERS.UNIT", description: "수량을 해석하는 기본 단위입니다." },
  iqcYn: { db: "ITEM_MASTERS.IQC_FLAG", description: "수입검사 기준 적용 대상 여부입니다." },
  inspectMethod: { db: "ITEM_MASTERS.INSPECT_METHOD", description: "IQC 검사 또는 무검사 적용 방식을 구분합니다." },
  sampleQty: { db: "ITEM_MASTERS.SAMPLE_QTY", description: "IQC 검사 시 사용할 기본시료수입니다. AQL 산출 샘플수량과 별개입니다." },
  iqcAqlPolicyCode: { db: "ITEM_MASTERS.IQC_AQL_POLICY_CODE", description: "품목에 적용할 IQC AQL 정책 기준정보 코드입니다." },
  useYn: { db: "ITEM_MASTERS.USE_YN", description: "신규 조회, 선택, 사용 가능 여부입니다." },
  boxQty: { db: "ITEM_MASTERS.BOX_QTY", description: "박스 하나에 장입하는 기준 수량입니다. 10 단위 후보를 선택하거나 직접 입력할 수 있습니다." },
  minPackQty: { db: "ITEM_MASTERS.MIN_PACK_QTY", description: "자재 불출 시 최소 단위로 취급할 수량입니다." },
  lotUnitQty: { db: "ITEM_MASTERS.LOT_UNIT_QTY", description: "생산 공정품을 묶음 단위로 처리할 기준 수량입니다." },
  safetyStock: { db: "ITEM_MASTERS.SAFETY_STOCK", description: "재고 부족 판단에 쓰는 기준 수량입니다." },
  expiryDate: { db: "ITEM_MASTERS.EXPIRY_DATE", description: "입고 또는 제조 기준 유효기간 일수입니다." },
  expiryExtDays: { db: "ITEM_MASTERS.EXPIRY_EXT_DAYS", description: "품질 판단 후 유효기간을 연장할 수 있는 최대 일수입니다." },
  packUnit: { db: "ITEM_MASTERS.PACK_UNIT", description: "팔레트 또는 상위 포장 단위 구성 기준입니다." },
  storageLocation: { db: "ITEM_MASTERS.STORAGE_LOCATION", description: "품목별로 고정해 둘 기본 적재 로케이션입니다." },
  imageUrl: { db: "ITEM_MASTERS.IMAGE_URL", description: "품목 사진 파일 경로입니다." },
  remark: { db: "ITEM_MASTERS.REMARK", description: "품목 관리 참고사항입니다." },
} as const;

export type PartFieldKey = keyof typeof PART_FIELD_HELP;

type FieldBaseProps = {
  field: PartFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const help = PART_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={help.description} db={help.db} dataField={field} />
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
  field: PartFieldKey;
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
  field: PartFieldKey;
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
  field: PartFieldKey;
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

type FieldYnRadioProps = {
  field: PartFieldKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function FieldYnRadio({ field, label, value, onChange }: FieldYnRadioProps) {
  return (
    <Field field={field} label={label}>
      <div className="flex h-10 items-center gap-3">
        {[
          { v: "Y", l: "Y", cls: "text-green-600 dark:text-green-400" },
          { v: "N", l: "N", cls: "text-red-500 dark:text-red-400" },
        ].map(opt => (
          <label key={opt.v} className={`flex cursor-pointer items-center gap-1.5 text-xs ${value === opt.v ? `${opt.cls} font-semibold` : "text-text-muted"}`}>
            <input
              type="radio"
              checked={value === opt.v}
              onChange={() => onChange(opt.v)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {opt.l}
          </label>
        ))}
      </div>
    </Field>
  );
}
