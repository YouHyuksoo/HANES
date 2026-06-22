"use client";

/**
 * @file master/process-capa/components/ProcessCapaFieldHelp.tsx
 * @description 공정 CAPA(설비 능력) 폼의 입력 필드별 도움말(? 툴팁) 정의 + Field 래퍼.
 *              part/components/PartFieldHelp.tsx 패턴을 동일하게 적용한다.
 *
 * - PROCESS_CAPA_FIELD_HELP: 필드키 → { db 컬럼, 설명 } 매핑
 * - FieldLabel: 라벨 옆 ? 도움말 (특수 위젯에서 라벨만 재사용)
 * - Field / FieldInput / FieldSelect: 기존 @/components/ui 컴포넌트를 그대로 감싸는 래퍼
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input, Select } from "@/components/ui";
import type { InputProps, SelectProps } from "@/components/ui";
import { HelpTooltip } from "@/components/shared";

export const PROCESS_CAPA_FIELD_HELP = {
  processCode: { db: "PROCESS_CAPAS.PROCESS_CODE", description: "이 CAPA가 적용되는 공정입니다. 공정+품목 조합으로 생산능력을 관리합니다." },
  itemCode: { db: "PROCESS_CAPAS.ITEM_CODE", description: "이 공정에서 생산하는 품목입니다. 공정+품목 조합이 CAPA의 키가 됩니다." },
  stdTactTime: { db: "PROCESS_CAPAS.STD_TACT_TIME", description: "1개를 생산하는 데 걸리는 표준 택트타임(초)입니다. 입력하면 UPH가 자동 계산됩니다." },
  stdUph: { db: "PROCESS_CAPAS.STD_UPH", description: "시간당 생산량(Units Per Hour)입니다. 3600 / 택트타임으로 자동 계산됩니다." },
  workerCnt: { db: "PROCESS_CAPAS.WORKER_CNT", description: "이 공정에 투입하는 표준 작업자 수입니다. 설비 수가 없을 때 일일 CAPA 계산의 배수로 사용됩니다." },
  boardCnt: { db: "PROCESS_CAPAS.BOARD_CNT", description: "이 공정에서 사용하는 작업 보드(지그·판) 수입니다." },
  equipCnt: { db: "PROCESS_CAPAS.EQUIP_CNT", description: "이 공정에 투입하는 설비 수입니다. 값이 있으면 일일 CAPA 계산에 작업자 수 대신 우선 적용됩니다." },
  setupTime: { db: "PROCESS_CAPAS.SETUP_TIME", description: "모델 전환 등 작업 준비에 걸리는 전환시간(분)입니다." },
  balanceEff: { db: "PROCESS_CAPAS.BALANCE_EFF", description: "라인 밸런싱 효율(%)입니다. 일일 CAPA에 곱해지는 가동 효율로, 기본 85% 기준입니다." },
  dailyCapa: { db: "PROCESS_CAPAS.DAILY_CAPA", description: "일 생산능력입니다. UPH × 8시간 × (설비 수 또는 작업자 수) × 밸런싱 효율로 자동 계산됩니다." },
  useYn: { db: "PROCESS_CAPAS.USE_YN", description: "이 CAPA의 사용 여부입니다. 조회·선택 대상에 포함할지 결정합니다." },
  remark: { db: "PROCESS_CAPAS.REMARK", description: "공정 CAPA 관리 참고사항입니다." },
} as const;

export type ProcessCapaFieldKey = keyof typeof PROCESS_CAPA_FIELD_HELP;

type FieldBaseProps = {
  field: ProcessCapaFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = PROCESS_CAPA_FIELD_HELP[field];

  return (
    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.processCapa.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: ProcessCapaFieldKey;
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
  field: ProcessCapaFieldKey;
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
