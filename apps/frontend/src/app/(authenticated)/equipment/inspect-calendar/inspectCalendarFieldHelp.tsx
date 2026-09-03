"use client";

/**
 * @file equipment/inspect-calendar/inspectCalendarFieldHelp.tsx
 * @description 점검 캘린더 화면 필드·컬럼 도움말 사전 — InspectCalendar·DaySchedulePanel·InspectExecuteModal 이
 *              inspect-calendar(일상) 와 periodic-inspect-calendar(정기) 양쪽에서 재사용되므로 사전은 여기 한 곳만 둔다.
 *              db 값은 apps/backend/src/entities/equip-inspect-log.entity.ts(EQUIP_INSPECT_LOGS),
 *              equip-inspect-item-master.entity.ts(EQUIP_INSPECT_ITEM_MASTERS),
 *              equip-inspect-item-pool.entity.ts(EQUIP_INSPECT_ITEM_POOL), equip-master.entity.ts(EQUIP_MASTERS) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const INSPECT_CALENDAR_FIELD_HELP = {
  dayStatus: { db: "(파생) EQUIP_INSPECT_ITEM_MASTERS.CYCLE + EQUIP_INSPECT_LOGS.OVERALL_RESULT 기준", description: "날짜별 점검 상태입니다. 점검항목 주기(매일/매주/매월)로 대상 설비를 계산하고 저장된 점검 이력과 비교해 전부합격·진행중·불합격·미시작·기한초과로 표시하며, 칸 안의 숫자는 완료 설비 수/대상 설비 수입니다." },
  equip: { db: "EQUIP_MASTERS.EQUIP_CODE / EQUIP_NAME", description: "점검 대상 설비의 코드와 이름입니다. 설비마스터 기준입니다." },
  inspectDate: { db: "EQUIP_INSPECT_LOGS.INSPECT_DATE", description: "점검 기준일입니다. 캘린더에서 선택한 날짜로 저장됩니다." },
  inspectorName: { db: "EQUIP_INSPECT_LOGS.INSPECTOR_NAME", description: "점검을 수행한 작업자입니다. 작업자마스터에서 선택하며 저장 시 필수입니다." },
  seq: { db: "(파생) EQUIP_INSPECT_ITEM_POOL.SORT_SEQ 정렬 순번", description: "점검항목 표시 순번입니다. 설비별 점검항목의 정렬순서를 따릅니다." },
  itemName: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_NAME", description: "점검할 항목 이름입니다. 설비점검항목 마스터에서 관리합니다." },
  criteria: { db: "EQUIP_INSPECT_ITEM_MASTERS.CRITERIA", description: "항목의 판정 기준 문구입니다. 이 기준에 맞으면 합격, 벗어나면 불합격을 선택합니다." },
  itemResult: { db: "EQUIP_INSPECT_LOGS.DETAILS (items[].result)", description: "항목별 판정입니다. 합격(PASS) 또는 불합격(FAIL)을 선택하며 모든 항목을 입력해야 저장할 수 있습니다." },
  failCause: { db: "EQUIP_INSPECT_LOGS.DETAILS (items[].remark)", description: "항목별 비고입니다. 불합격(FAIL)으로 판정한 항목은 불합격 사유를 반드시 입력해야 합니다." },
  overallResult: { db: "EQUIP_INSPECT_LOGS.OVERALL_RESULT", description: "종합판정입니다. 항목 중 하나라도 불합격이면 FAIL, 전부 합격이면 PASS로 자동 계산됩니다." },
  remark: { db: "EQUIP_INSPECT_LOGS.REMARK", description: "이번 점검 전체에 대한 비고입니다. 특이사항이나 조치 내용을 적습니다." },
} as const;

export type InspectCalendarFieldKey = keyof typeof INSPECT_CALENDAR_FIELD_HELP;

export const {
  Field,
  FieldLabel,
  FieldHelpIcon,
  FieldInput,
  FieldSelect,
  HeaderHelp,
} = createFieldHelp(INSPECT_CALENDAR_FIELD_HELP, "equipment.inspectCalendar.fieldHelp");
