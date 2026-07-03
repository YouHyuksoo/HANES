"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui";
import { HelpTooltip } from "@/components/shared";

export const ROUTING_FIELD_HELP = {
  // 라우팅 그룹 (ROUTING_GROUPS)
  routingCode: { db: "ROUTING_GROUPS.ROUTING_CODE", description: "라우팅 그룹을 식별하는 고유 코드입니다. 등록 후에는 변경할 수 없습니다." },
  routingName: { db: "ROUTING_GROUPS.ROUTING_NAME", description: "라우팅 그룹을 식별할 명칭입니다." },
  itemCode: { db: "ROUTING_GROUPS.ITEM_CODE", description: "이 라우팅이 적용될 대상 품목입니다." },
  description: { db: "ROUTING_GROUPS.DESCRIPTION", description: "라우팅 관리 참고 설명입니다." },
  // 공정 순서 (ROUTING_PROCESSES)
  seq: { db: "ROUTING_PROCESSES.SEQ", description: "공정의 진행 순서입니다. 보통 10 단위로 부여해 중간 삽입 여지를 둡니다." },
  processCode: { db: "ROUTING_PROCESSES.PROCESS_CODE", description: "이 단계에서 수행할 공정을 선택합니다. 공정 마스터에서 등록된 코드입니다." },
  processName: { db: "ROUTING_PROCESSES.PROCESS_NAME", description: "선택한 공정의 명칭입니다. 공정 코드 선택 시 자동으로 표시됩니다." },
  processType: { db: "ROUTING_PROCESSES.PROCESS_TYPE", description: "선택한 공정의 유형입니다. 공정 코드 선택 시 자동으로 표시됩니다." },
  equipType: { db: "ROUTING_PROCESSES.EQUIP_TYPE", description: "이 공정에서 사용할 설비 유형입니다." },
  executionType: { db: "ROUTING_PROCESSES.EXECUTION_TYPE", description: "이 공정을 사내에서 수행할지 외주처로 보낼지 지정합니다." },
  jobOrderYn: { db: "ROUTING_PROCESSES.JOB_ORDER_YN", description: "이 공정에 대해 생산 작업지시를 생성할지 지정합니다. 검사/참조 공정은 끄면 됩니다." },
  subconVendorCode: { db: "ROUTING_PROCESSES.SUBCON_VENDOR_CODE", description: "외주 공정일 때 기본 외주처를 지정합니다." },
  stdTime: { db: "ROUTING_PROCESSES.STD_TIME", description: "단위 작업 1회에 소요되는 표준 작업시간(초)입니다." },
  setupTime: { db: "ROUTING_PROCESSES.SETUP_TIME", description: "공정 시작 전 준비(셋업)에 소요되는 시간(초)입니다." },
  sampleInspectYn: { db: "ROUTING_PROCESSES.SAMPLE_INSPECT_YN", description: "이 공정에서 샘플검사(자주검사)를 수행할지 여부입니다." },
  issueLabelType: { db: "ROUTING_PROCESSES.ISSUE_LABEL_TYPE", description: "이 공정 완료 시 발행할 라벨 종류입니다(없음/묶음/SG/FG). 한 공정은 한 종류만 발행합니다." },
  labelIssue: {
    db: "ROUTING_PROCESSES.ISSUE_LABEL_TYPE",
    description: "이 공정 완료 시 발행할 라벨 종류를 지정합니다. 없음·묶음 추적 라벨·반제품(SFG)·완제품(FG) 중 하나를 선택합니다(한 공정 한 종류).",
  },
} as const;

export type RoutingFieldKey = keyof typeof ROUTING_FIELD_HELP;

/**
 * 라벨 + ? 도움말 툴팁. native select·체크박스·읽기전용 표시 등
 * 다양한 입력 위젯 위에 라벨만 붙이는 경우에 사용한다.
 */
export function FieldLabel({
  field,
  label,
  required,
  className = "block text-sm font-medium text-text dark:text-gray-300 mb-1",
}: {
  field: RoutingFieldKey;
  label: string;
  required?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const help = ROUTING_FIELD_HELP[field];

  return (
    <label className={`flex items-center gap-1 ${className}`}>
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.routing.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
    </label>
  );
}

export function Field({
  field,
  label,
  required,
  className = "",
  children,
}: {
  field: RoutingFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <FieldLabel field={field} label={label} required={required} />
      {children}
    </div>
  );
}

type FieldInputProps = Omit<InputProps, "label"> & {
  field: RoutingFieldKey;
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
