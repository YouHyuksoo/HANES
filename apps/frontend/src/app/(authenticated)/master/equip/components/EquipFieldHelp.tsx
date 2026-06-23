"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui";
import { ComCodeSelect, LineSelect, HelpTooltip } from "@/components/shared";

export const EQUIP_FIELD_HELP = {
  equipCode: { db: "EQUIP_MASTERS.EQUIP_CODE", description: "MES 내부에서 설비를 식별하는 고유 코드입니다. 등록 후에는 변경할 수 없습니다." },
  equipName: { db: "EQUIP_MASTERS.EQUIP_NAME", description: "현장에서 설비를 식별할 설비명입니다." },
  equipType: { db: "EQUIP_MASTERS.EQUIP_TYPE", description: "단선절단, 검사기 등 설비 유형 분류입니다." },
  commType: { db: "EQUIP_MASTERS.COMM_TYPE", description: "MES와 설비가 데이터를 주고받는 통신 방식입니다(TCP, MQTT, Serial, 없음)." },
  lineCode: { db: "EQUIP_MASTERS.LINE_CODE", description: "설비가 배치된 생산 라인입니다." },
  ipAddress: { db: "EQUIP_MASTERS.IP_ADDRESS", description: "TCP·MQTT 통신 시 설비에 접속할 IP 주소입니다." },
  port: { db: "EQUIP_MASTERS.PORT", description: "TCP·MQTT 통신 시 설비에 접속할 포트 번호입니다." },
  // 아래 통신 상세값은 EQUIP_MASTERS.COMM_CONFIG(CLOB) JSON 안에 저장됩니다.
  mqttTopic: { db: "EQUIP_MASTERS.COMM_CONFIG (mqttTopic)", description: "MQTT 통신 시 메시지를 주고받을 토픽 경로입니다." },
  serialPort: { db: "EQUIP_MASTERS.COMM_CONFIG (serialPort)", description: "시리얼 통신 시 사용할 포트(예: COM1)입니다." },
  baudRate: { db: "EQUIP_MASTERS.COMM_CONFIG (baudRate)", description: "시리얼 통신 속도(통신 보율)입니다." },
  maker: { db: "EQUIP_MASTERS.MAKER", description: "설비를 제작한 제조사입니다." },
  modelName: { db: "EQUIP_MASTERS.MODEL_NAME", description: "설비의 모델명입니다." },
  imageUrl: { db: "EQUIP_MASTERS.IMAGE_URL", description: "설비 사진 파일 경로입니다." },
} as const;

export type EquipFieldKey = keyof typeof EQUIP_FIELD_HELP;

type FieldBaseProps = {
  field: EquipFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = EQUIP_FIELD_HELP[field];

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.equip.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: EquipFieldKey;
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
  field: EquipFieldKey;
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

type FieldLineSelectProps = Omit<ComponentProps<typeof LineSelect>, "label"> & {
  field: EquipFieldKey;
  label: string;
  wrapperClassName?: string;
};

export function FieldLineSelect({ field, label, required, wrapperClassName, ...props }: FieldLineSelectProps) {
  return (
    <Field field={field} label={label} required={required} className={wrapperClassName}>
      <LineSelect {...props} required={required} fullWidth />
    </Field>
  );
}
