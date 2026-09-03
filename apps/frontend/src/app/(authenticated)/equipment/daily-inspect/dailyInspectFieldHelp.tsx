"use client";

/**
 * @file equipment/daily-inspect/dailyInspectFieldHelp.tsx
 * @description 일일/정기 설비점검 입력 화면 필드·컬럼 도움말 사전 — EquipListPanel·InspectEntryPanel 이
 *              daily-inspect 와 periodic-inspect 양쪽에서 재사용되므로 사전은 여기 한 곳만 둔다.
 *              db 값은 apps/backend/src/entities/equip-inspect-log.entity.ts(EQUIP_INSPECT_LOGS),
 *              equip-inspect-item-master.entity.ts(EQUIP_INSPECT_ITEM_MASTERS),
 *              equip-inspect-item-pool.entity.ts(EQUIP_INSPECT_ITEM_POOL), equip-master.entity.ts(EQUIP_MASTERS) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const DAILY_INSPECT_FIELD_HELP = {
  equipCode: { db: "EQUIP_INSPECT_ITEM_POOL.EQUIP_CODE", description: "점검항목이 배정된 설비 코드입니다. 설비별 점검항목(POOL)에 사용 중인 항목이 있는 설비만 목록에 나옵니다." },
  equipName: { db: "EQUIP_MASTERS.EQUIP_NAME", description: "설비마스터에 등록된 설비 이름입니다." },
  equipType: { db: "EQUIP_MASTERS.EQUIP_TYPE", description: "설비 유형입니다. 목록은 이 값으로 묶어서 보여줍니다." },
  status: { db: "(파생) EQUIP_INSPECT_LOGS.OVERALL_RESULT 기준", description: "선택한 날짜의 처리 상태입니다. 저장 이력이 없으면 미점검, 있으면 종합판정에 따라 완료(OK)/완료(NG)로 표시됩니다." },
  inspectDate: { db: "EQUIP_INSPECT_LOGS.INSPECT_DATE", description: "점검 기준일입니다. 상단 날짜를 바꾸면 그 날짜의 점검 이력으로 저장·조회됩니다." },
  inspectorName: { db: "EQUIP_INSPECT_LOGS.INSPECTOR_NAME", description: "점검을 수행한 작업자입니다. 작업자마스터에서 선택하며 저장 시 필수입니다." },
  startTime: { db: "(파생) 화면 진입 시각 — 저장 시 EQUIP_INSPECT_LOGS.INSPECT_AT 에는 저장 시각이 기록", description: "이 설비의 점검 입력을 시작한 시각(화면 기준)입니다. 참고용이며 그대로 저장되지는 않습니다." },
  overallResult: { db: "EQUIP_INSPECT_LOGS.OVERALL_RESULT", description: "종합판정입니다. 항목 중 하나라도 NG면 FAIL, 전부 OK면 PASS로 자동 판정되며 FAIL 저장 시 정비요청이 자동 등록됩니다." },
  seq: { db: "EQUIP_INSPECT_ITEM_POOL.SORT_SEQ", description: "점검항목 표시 순번입니다. 설비별 점검항목의 정렬순서를 따릅니다." },
  itemName: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_NAME", description: "점검할 항목 이름입니다. 설비점검항목 마스터에서 관리합니다." },
  itemType: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_TYPE", description: "항목 유형입니다. 측정형(MEASURE)은 숫자를 입력해 규격과 비교하고, 판정형(VISUAL)은 OK/NG를 직접 선택합니다." },
  criteria: { db: "(파생) EQUIP_INSPECT_ITEM_MASTERS.LSL_VALUE·USL_VALUE·UNIT·CRITERIA 기준", description: "판정 기준입니다. 측정형은 하한~상한(단위)으로, 판정형은 기준 문구로 표시됩니다." },
  measureValue: { db: "EQUIP_INSPECT_LOGS.DETAILS (items[].value)", description: "측정형은 측정한 숫자를 입력하면 규격과 비교해 자동 판정되고, 판정형은 OK/NG를 직접 선택합니다." },
  judge: { db: "EQUIP_INSPECT_LOGS.DETAILS (items[].result)", description: "항목별 판정 결과(OK/NG)입니다. 측정값 입력 또는 선택 결과에 따라 표시됩니다." },
  itemRemark: { db: "EQUIP_INSPECT_LOGS.DETAILS (items[].remark)", description: "항목별 비고입니다. NG일 때 불량 내용을 적어 두면 정비 시 참고할 수 있습니다." },
} as const;

export type DailyInspectFieldKey = keyof typeof DAILY_INSPECT_FIELD_HELP;

export const {
  Field,
  FieldLabel,
  FieldHelpIcon,
  HeaderHelp,
  headerWithHelp,
} = createFieldHelp(DAILY_INSPECT_FIELD_HELP, "equipment.dailyInspect.fieldHelp");
