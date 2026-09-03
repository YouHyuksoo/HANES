"use client";

/**
 * @file equipment/pm-result/pmResultFieldHelp.tsx
 * @description PM결과 그리드 컬럼 도움말 사전.
 *              db 값은 apps/backend/src/entities/pm-work-order.entity.ts(@Column name) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const PM_RESULT_FIELD_HELP = {
  workOrderNo: { db: "PM_WORK_ORDERS.WORK_ORDER_NO", description: "예방보전 작업지시(WO) 번호입니다. 캘린더에서 월별 생성 시 자동 채번됩니다." },
  scheduledDate: { db: "PM_WORK_ORDERS.SCHEDULED_DATE", description: "작업을 수행하기로 예정된 날짜입니다. PM 계획의 다음 예정일을 기준으로 정해집니다." },
  equipCode: { db: "PM_WORK_ORDERS.EQUIP_CODE", description: "예방보전 대상 설비의 코드입니다." },
  equipName: { db: "(파생) EQUIP_MASTERS.EQUIP_NAME 기준", description: "대상 설비의 이름입니다. 설비코드로 설비마스터를 조회해 표시합니다." },
  overallResult: { db: "PM_WORK_ORDERS.OVERALL_RESULT", description: "작업 종합 결과입니다. 항목 중 하나라도 FAIL이면 전체 FAIL로 판정됩니다." },
  priority: { db: "PM_WORK_ORDERS.PRIORITY", description: "작업 우선순위(공통코드 PM_PRIORITY)입니다. HIGH일수록 먼저 처리해야 합니다." },
  completedAt: { db: "PM_WORK_ORDERS.COMPLETED_AT", description: "작업을 완료 처리한 일시입니다. 실행 화면에서 완료 버튼을 누른 시점입니다." },
  remark: { db: "PM_WORK_ORDERS.REMARK", description: "작업 전체에 대한 비고입니다. 실행 화면에서 입력한 특이사항이 표시됩니다." },
} as const;

export type PmResultFieldKey = keyof typeof PM_RESULT_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(PM_RESULT_FIELD_HELP, "equipment.pmResult.fieldHelp");
