"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { HelpTooltip, LineSelect, ProcessSelect } from "@/components/shared";

export const WAREHOUSE_FIELD_HELP = {
  // 창고 마스터 (WAREHOUSES)
  warehouseCode: { db: "WAREHOUSES.WAREHOUSE_CODE", description: "창고를 식별하는 고유 코드입니다. 등록 후에는 변경할 수 없습니다." },
  warehouseName: { db: "WAREHOUSES.WAREHOUSE_NAME", description: "현장에서 식별할 창고명입니다." },
  warehouseType: { db: "WAREHOUSES.WAREHOUSE_TYPE", description: "원자재, 제품, 재공, 불용 등 창고의 용도 분류입니다." },
  lineCode: { db: "WAREHOUSES.LINE_CODE", description: "현장(FLOOR) 창고가 소속된 생산라인입니다." },
  processCode: { db: "WAREHOUSES.PROCESS_CODE", description: "현장(FLOOR) 창고가 소속된 공정입니다." },
  isDefault: { db: "WAREHOUSES.IS_DEFAULT", description: "동일 유형에서 기본으로 사용할 창고 여부입니다." },

  // 로케이션 (WAREHOUSE_LOCATIONS)
  locationWarehouse: { db: "WAREHOUSE_LOCATIONS.WAREHOUSE_CODE", description: "이 로케이션이 속한 창고입니다. 등록 후에는 변경할 수 없습니다." },
  locationCode: { db: "WAREHOUSE_LOCATIONS.LOCATION_CODE", description: "창고 내 세부위치를 식별하는 코드입니다. 등록 후에는 변경할 수 없습니다." },
  locationName: { db: "WAREHOUSE_LOCATIONS.LOCATION_NAME", description: "현장에서 식별할 로케이션명입니다." },
  zone: { db: "WAREHOUSE_LOCATIONS.ZONE", description: "창고 내 구역(zone) 구분 값입니다." },
  rowNo: { db: "WAREHOUSE_LOCATIONS.ROW_NO", description: "랙/선반의 행(row) 번호입니다." },
  colNo: { db: "WAREHOUSE_LOCATIONS.COL_NO", description: "랙/선반의 열(column) 번호입니다." },
  levelNo: { db: "WAREHOUSE_LOCATIONS.LEVEL_NO", description: "랙/선반의 단(level) 번호입니다." },
  locationRemark: { db: "WAREHOUSE_LOCATIONS.REMARK", description: "로케이션 관리 참고사항입니다." },

  // 이동 규칙 (WAREHOUSE_TRANSFER_RULES)
  fromWarehouse: { db: "WAREHOUSE_TRANSFER_RULES.FROM_WAREHOUSE_ID", description: "이동 규칙의 출발 창고입니다." },
  toWarehouse: { db: "WAREHOUSE_TRANSFER_RULES.TO_WAREHOUSE_ID", description: "이동 규칙의 도착 창고입니다." },
  allowYn: { db: "WAREHOUSE_TRANSFER_RULES.ALLOW_YN", description: "출발 창고에서 도착 창고로의 이동 허용 여부입니다." },
  ruleRemark: { db: "WAREHOUSE_TRANSFER_RULES.REMARK", description: "이동 규칙 관리 참고사항입니다." },
} as const;

export type WarehouseFieldKey = keyof typeof WAREHOUSE_FIELD_HELP;

type FieldBaseProps = {
  field: WarehouseFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = WAREHOUSE_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.warehouse.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: WarehouseFieldKey;
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
  field: WarehouseFieldKey;
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

type FieldLineSelectProps = Omit<ComponentProps<typeof LineSelect>, "label"> & {
  field: WarehouseFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldLineSelect({ field, label, required, wrapperClassName, ...props }: FieldLineSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <LineSelect {...props} fullWidth />
    </Field>
  );
}

type FieldProcessSelectProps = Omit<ComponentProps<typeof ProcessSelect>, "label"> & {
  field: WarehouseFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldProcessSelect({ field, label, required, wrapperClassName, ...props }: FieldProcessSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <ProcessSelect {...props} fullWidth />
    </Field>
  );
}
