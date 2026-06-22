"use client";

/**
 * @file master/work-calendar/components/WorkCalendarFieldHelp.tsx
 * @description 작업달력(근무캘린더) 화면 입력 필드별 ? 도움말 정의 + Field 래퍼.
 *              품목관리(part)의 PartFieldHelp 패턴을 복제했다.
 *
 * 초보자 가이드:
 * 1. WORK_CALENDAR_FIELD_HELP: 필드키 → { db, description } 매핑. db는 실제 Oracle 컬럼.
 * 2. Field / FieldLabel: 라벨 옆에 HelpTooltip(? 아이콘)을 붙이는 래퍼.
 * 3. FieldInput: @/components/ui 의 Input 을 감싼 편의 래퍼.
 *    native <select>, <input type="time"> 등은 Field 로 감싸 children 으로 둔다.
 * 4. 대상 테이블: WORK_CALENDARS / WORK_CALENDAR_DAYS / SHIFT_PATTERNS.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui";
import type { InputProps } from "@/components/ui";
import { HelpTooltip } from "@/components/shared";

export const WORK_CALENDAR_FIELD_HELP = {
  // ── WORK_CALENDARS (캘린더 헤더) ──
  calendarId: { db: "WORK_CALENDARS.CALENDAR_ID", description: "근무캘린더를 식별하는 고유 ID입니다. 연도와 공장 조합의 자연키입니다(예: WC-2026-PLANT01)." },
  calendarYear: { db: "WORK_CALENDARS.CALENDAR_YEAR", description: "이 캘린더가 적용되는 연도(4자리)입니다." },
  processCd: { db: "WORK_CALENDARS.PROCESS_CD", description: "특정 공정 전용 캘린더일 때 지정합니다. 비워두면 공장 공통 캘린더로 등록됩니다." },
  defaultShiftCount: { db: "WORK_CALENDARS.DEFAULT_SHIFT_COUNT", description: "캘린더 생성 시 일자별 기본 교대수입니다(1~3)." },
  defaultShifts: { db: "WORK_CALENDARS.DEFAULT_SHIFTS", description: "기본 교대 패턴 코드를 콤마로 나열한 값입니다(예: DAY,NIGHT)." },
  status: { db: "WORK_CALENDARS.STATUS", description: "캘린더 상태입니다. 확정(CONFIRMED) 시 편집·생성·복사가 제한됩니다." },
  remark: { db: "WORK_CALENDARS.REMARK", description: "캘린더 관리 참고사항입니다." },

  // ── WORK_CALENDAR_DAYS (일자별 상세) ──
  dayType: { db: "WORK_CALENDAR_DAYS.DAY_TYPE", description: "해당 날짜의 근무 유형입니다(근무/휴무/반일 등, 공통코드 WORK_DAY_TYPE)." },
  offReason: { db: "WORK_CALENDAR_DAYS.OFF_REASON", description: "휴무일 때의 사유입니다(공휴일/연차 등, 공통코드 DAY_OFF_TYPE). 근무 유형이 휴무(OFF)일 때만 사용됩니다." },
  shiftCount: { db: "WORK_CALENDAR_DAYS.SHIFT_COUNT", description: "해당 날짜에 운영할 교대수입니다(1~3)." },
  shifts: { db: "WORK_CALENDAR_DAYS.SHIFTS", description: "해당 날짜에 적용할 교대 패턴을 다중 선택합니다. 선택값은 콤마로 묶여 저장됩니다." },
  otMinutes: { db: "WORK_CALENDAR_DAYS.OT_MINUTES", description: "해당 날짜의 잔업 시간(분)입니다." },

  // ── SHIFT_PATTERNS (교대 패턴 마스터) ──
  shiftCode: { db: "SHIFT_PATTERNS.SHIFT_CODE", description: "교대 패턴을 식별하는 코드입니다(예: DAY, NIGHT). 등록 후에는 변경할 수 없습니다." },
  shiftName: { db: "SHIFT_PATTERNS.SHIFT_NAME", description: "교대 패턴의 표시 이름입니다(예: 주간, 야간)." },
  startTime: { db: "SHIFT_PATTERNS.START_TIME", description: "교대 시작 시각입니다(HH:MM 형식)." },
  endTime: { db: "SHIFT_PATTERNS.END_TIME", description: "교대 종료 시각입니다(HH:MM 형식)." },
  breakMinutes: { db: "SHIFT_PATTERNS.BREAK_MINUTES", description: "교대 중 휴게 시간(분)입니다." },
  workMinutes: { db: "SHIFT_PATTERNS.WORK_MINUTES", description: "휴게를 제외한 실작업 시간(분)입니다." },
} as const;

export type WorkCalendarFieldKey = keyof typeof WORK_CALENDAR_FIELD_HELP;

type FieldBaseProps = {
  field: WorkCalendarFieldKey;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ field, label, required }: Omit<FieldBaseProps, "children" | "className">) {
  const { t } = useTranslation();
  const help = WORK_CALENDAR_FIELD_HELP[field];

  return (
    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-text-muted dark:text-gray-400">
      <span>{label}</span>
      {required && <span className="text-red-500">*</span>}
      <HelpTooltip description={t(`master.workCalendar.fieldHelp.${field}`, help.description)} db={help.db} dataField={field} />
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
  field: WorkCalendarFieldKey;
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
