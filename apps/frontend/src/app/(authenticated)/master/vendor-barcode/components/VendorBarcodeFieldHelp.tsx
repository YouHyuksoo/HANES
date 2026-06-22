"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { HelpTooltip } from "@/components/shared";

export const VENDOR_BARCODE_FIELD_HELP = {
  vendorBarcode: { db: "VENDOR_BARCODE_MAPPINGS.VENDOR_BARCODE", description: "제조사가 부착한 바코드를 스캔한 원본 값입니다. 이 화면의 자연키(PK)입니다." },
  matchType: { db: "VENDOR_BARCODE_MAPPINGS.MATCH_TYPE", description: "스캔 값과 등록 값을 비교하는 방식입니다. 정확 일치, 접두사, 정규식 중 하나입니다." },
  useYn: { db: "VENDOR_BARCODE_MAPPINGS.USE_YN", description: "신규 조회, 선택, 사용 가능 여부입니다." },
  partCode: { db: "VENDOR_BARCODE_MAPPINGS.ITEM_CODE", description: "이 바코드가 가리키는 MES 품목코드입니다. (ITEM_MASTERS.ITEM_CODE 참조)" },
  partName: { db: "VENDOR_BARCODE_MAPPINGS.ITEM_NAME", description: "조회 편의를 위해 저장하는 품명입니다." },
  vendorCode: { db: "VENDOR_BARCODE_MAPPINGS.VENDOR_CODE", description: "이 바코드를 발행한 제조사 코드입니다. (VENDOR_MASTERS 참조)" },
  vendorName: { db: "VENDOR_BARCODE_MAPPINGS.VENDOR_NAME", description: "조회 편의를 위해 저장하는 제조사명입니다." },
  mappingRule: { db: "VENDOR_BARCODE_MAPPINGS.MAPPING_RULE", description: "매칭 규칙에 대한 설명입니다. 예: 접두사 패턴, 정규식 식별 규칙 등." },
  remark: { db: "VENDOR_BARCODE_MAPPINGS.REMARK", description: "매핑 관리 참고사항입니다." },
} as const;

export type VendorBarcodeFieldKey = keyof typeof VENDOR_BARCODE_FIELD_HELP;

type FieldBaseProps = {
  field: VendorBarcodeFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = VENDOR_BARCODE_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.vendorBarcode.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: VendorBarcodeFieldKey;
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
  field: VendorBarcodeFieldKey;
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
