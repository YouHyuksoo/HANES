"use client";

/**
 * @file equipment/pm-plan/pmPlanFieldHelp.tsx
 * @description PM계획 필드/컬럼 도움말 사전 — 등록 패널 라벨과 그리드 헤더의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/pm-plan.entity.ts, pm-plan-item.entity.ts(@Column name) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const PM_PLAN_FIELD_HELP = {
  planCode: { db: "PM_PLANS.PLAN_CODE", description: "예방보전 계획을 식별하는 고유 코드입니다. 등록 후에는 바꿀 수 없습니다." },
  equipCode: { db: "PM_PLANS.EQUIP_CODE", description: "이 계획으로 예방보전을 수행할 대상 설비입니다. 설비마스터에서 선택합니다." },
  equipName: { db: "(파생) EQUIP_MASTERS.EQUIP_NAME 기준", description: "대상 설비의 이름입니다. 설비코드로 설비마스터를 조회해 표시합니다." },
  planName: { db: "PM_PLANS.PLAN_NAME", description: "현장에서 부르는 계획 이름입니다. 예: 월간 윤활 점검." },
  description: { db: "PM_PLANS.DESCRIPTION", description: "계획에 대한 보충 설명입니다. 작업 범위나 주의사항을 적습니다." },
  pmType: { db: "PM_PLANS.PM_TYPE", description: "보전 유형(공통코드 PM_TYPE)입니다. 시간 기준은 주기마다, 사용량 기준은 가동 실적이 기준값에 도달하면 작업지시가 생성됩니다." },
  cycleType: { db: "PM_PLANS.CYCLE_TYPE", description: "반복 주기 종류(공통코드 PM_CYCLE_TYPE)입니다. 일/주/월/년 등 주기 값의 단위가 됩니다." },
  cycleValue: { db: "PM_PLANS.CYCLE_VALUE", description: "주기 종류에 곱해지는 반복 간격입니다. 예: 주기 종류가 월이고 값이 3이면 3개월마다 수행합니다." },
  estimatedTime: { db: "PM_PLANS.ESTIMATED_TIME", description: "계획 전체를 수행하는 데 걸리는 예상 시간(시간 단위)입니다. 작업 일정 배정에 참고합니다." },
  itemCount: { db: "(파생) PM_PLAN_ITEMS 건수 기준", description: "이 계획에 등록된 보전항목 개수입니다. 작업지시 실행 시 항목별로 결과를 입력합니다." },
  nextDueAt: { db: "PM_PLANS.NEXT_DUE_AT", description: "다음 예방보전 예정일입니다. 작업지시 생성과 완료 시 주기에 따라 자동 갱신됩니다." },
  useYn: { db: "PM_PLANS.USE_YN", description: "계획 사용 여부입니다. N이면 작업지시 자동 생성 대상에서 제외됩니다." },
  criteria: { db: "PM_PLAN_ITEMS.CRITERIA", description: "항목의 합격/불합격 판정 기준입니다. 작업자가 실행 화면에서 이 기준을 보고 결과를 입력합니다." },
  sparePartCode: { db: "PM_PLAN_ITEMS.SPARE_PART_CODE", description: "항목 수행 시 교체하는 예비부품입니다. 설비 BOM에 등록된 부품 중에서 선택합니다." },
  sparePartQty: { db: "PM_PLAN_ITEMS.SPARE_PART_QTY", description: "예비부품 교체 수량입니다." },
  estimatedMinutes: { db: "PM_PLAN_ITEMS.ESTIMATED_MINUTES", description: "이 항목 하나를 수행하는 데 걸리는 예상 시간(분)입니다." },
} as const;

export type PmPlanFieldKey = keyof typeof PM_PLAN_FIELD_HELP;

export const {
  FieldHelpIcon,
  FieldInput,
  FieldSelect,
  FieldComCodeSelect,
  FieldQtyInput,
  headerWithHelp,
} = createFieldHelp(PM_PLAN_FIELD_HELP, "equipment.pmPlan.fieldHelp");
