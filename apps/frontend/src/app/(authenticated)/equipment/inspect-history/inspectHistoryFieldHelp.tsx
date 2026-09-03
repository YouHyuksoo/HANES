"use client";

/**
 * @file equipment/inspect-history/inspectHistoryFieldHelp.tsx
 * @description 점검이력조회 그리드 컬럼 도움말 사전(조회 전용 화면이라 폼 없음).
 *              행은 EQUIP_INSPECT_LOGS 를 EQUIP_MASTERS 와 조인한 결과(equipment/services/equip-inspect.service.ts findAll)라
 *              db 값은 equip-inspect-log.entity.ts, equip-master.entity.ts 중 실제 출처를 적는다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const INSPECT_HISTORY_FIELD_HELP = {
  inspectDate: { db: "EQUIP_INSPECT_LOGS.INSPECT_DATE", description: "점검을 수행한 날짜입니다. 설비·점검유형과 함께 이력을 구분하는 키입니다." },
  inspectType: { db: "EQUIP_INSPECT_LOGS.INSPECT_TYPE", description: "점검 구분(공통코드 INSPECT_CHECK_TYPE)입니다. 일상/정기/작업자점검 중 어떤 점검의 이력인지 나타냅니다." },
  equipCode: { db: "EQUIP_INSPECT_LOGS.EQUIP_CODE", description: "점검한 설비 코드입니다." },
  equipName: { db: "EQUIP_MASTERS.EQUIP_NAME (EQUIP_CODE 조인)", description: "점검한 설비 이름입니다. 설비 마스터에서 가져옵니다." },
  equipType: { db: "EQUIP_MASTERS.EQUIP_TYPE (EQUIP_CODE 조인)", description: "설비 유형(공통코드 EQUIP_TYPE)입니다. 설비 마스터에서 가져옵니다." },
  inspectorName: { db: "EQUIP_INSPECT_LOGS.INSPECTOR_NAME", description: "점검을 수행한 사람 이름입니다." },
  overallResult: { db: "EQUIP_INSPECT_LOGS.OVERALL_RESULT", description: "점검 종합 판정(공통코드 INSPECT_JUDGE)입니다. 항목 중 하나라도 NG면 종합 결과가 불합격으로 남습니다." },
  remark: { db: "EQUIP_INSPECT_LOGS.REMARK", description: "점검 시 남긴 특이사항입니다." },
} as const;

export type InspectHistoryFieldKey = keyof typeof INSPECT_HISTORY_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(INSPECT_HISTORY_FIELD_HELP, "equipment.inspectHistory.fieldHelp");
