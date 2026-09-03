"use client";

/**
 * @file equipment/pm-calendar/pmCalendarFieldHelp.tsx
 * @description PM캘린더(작업지시 실행 모달) 필드/컬럼 도움말 사전.
 *              db 값은 apps/backend/src/entities/pm-work-order.entity.ts, pm-wo-result.entity.ts(@Column name) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const PM_CALENDAR_FIELD_HELP = {
  workOrderNo: { db: "PM_WORK_ORDERS.WORK_ORDER_NO", description: "실행 중인 예방보전 작업지시(WO) 번호입니다." },
  equipCode: { db: "PM_WORK_ORDERS.EQUIP_CODE", description: "예방보전 대상 설비입니다. 설비코드와 설비명을 함께 표시합니다." },
  assignedWorker: { db: "PM_WORK_ORDERS.ASSIGNED_WORKER_ID", description: "작업을 수행한 작업자입니다. 작업자마스터에서 선택하며 완료 처리에 필수입니다." },
  seq: { db: "PM_WO_RESULTS.SEQ", description: "보전항목 순번입니다. PM 계획에 등록된 항목 순서를 따릅니다." },
  itemName: { db: "PM_WO_RESULTS.ITEM_NAME", description: "점검 또는 교체할 보전항목 이름입니다. PM 계획의 보전항목에서 복사됩니다." },
  itemType: { db: "PM_WO_RESULTS.ITEM_TYPE", description: "항목 유형(공통코드 PM_ITEM_TYPE)입니다. 점검/교체/청소 등 작업 성격을 구분합니다." },
  criteria: { db: "PM_WO_RESULTS.CRITERIA", description: "항목의 합격/불합격 판정 기준입니다. 이 기준을 보고 결과를 입력합니다." },
  result: { db: "PM_WO_RESULTS.RESULT", description: "항목별 판정 결과(PASS/FAIL)입니다. 모든 항목을 입력해야 완료 처리할 수 있습니다." },
  itemRemark: { db: "PM_WO_RESULTS.REMARK", description: "항목별 비고입니다. FAIL로 판정한 항목은 원인을 반드시 적어야 합니다." },
  overallResult: { db: "PM_WORK_ORDERS.OVERALL_RESULT", description: "작업 종합 결과입니다. 항목 중 하나라도 FAIL이면 전체 FAIL로 자동 판정됩니다." },
  completedAt: { db: "PM_WORK_ORDERS.COMPLETED_AT", description: "작업을 완료 처리한 일시입니다." },
  remark: { db: "PM_WORK_ORDERS.REMARK", description: "작업 전체에 대한 비고입니다. 특이사항이나 후속 조치를 적습니다." },
} as const;

export type PmCalendarFieldKey = keyof typeof PM_CALENDAR_FIELD_HELP;

export const {
  FieldHelpIcon,
  FieldInput,
  FieldSelect,
  HeaderHelp,
} = createFieldHelp(PM_CALENDAR_FIELD_HELP, "equipment.pmCalendar.fieldHelp");
