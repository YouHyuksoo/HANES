"use client";

/**
 * @file components/consumables/issuingFieldHelp.tsx
 * @description 소모품 출고 화면 필드/컬럼 도움말 사전 — 출고 이력 그리드(IssuingTable) 헤더의 ? 가 이 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/consumable-log.entity.ts(@Column name) 기준.
 *              consumableName 은 GET /consumables/logs 가 master relation 으로 붙이는 CONSUMABLE_MASTERS.NAME 이다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const ISSUING_FIELD_HELP = {
  createdAt: { db: "CONSUMABLE_LOGS.CREATED_AT", description: "출고 또는 출고취소가 처리된 일시입니다. 기간 필터와 당일 집계 기준이 됩니다." },
  consumableCode: { db: "CONSUMABLE_LOGS.CONSUMABLE_CODE", description: "출고된 소모품 마스터 코드입니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "소모품 코드에 연결된 이름입니다." },
  conUid: { db: "CONSUMABLE_LOGS.CON_UID", description: "스캔 출고한 개별 UID입니다. 어느 인스턴스가 공정으로 나갔는지 추적하는 키입니다." },
  logType: { db: "CONSUMABLE_LOGS.LOG_TYPE", description: "OUT(출고)/OUT_RETURN(출고취소) 구분입니다. 출고취소는 인스턴스를 다시 창고 재고(ACTIVE)로 되돌립니다." },
  qty: { db: "CONSUMABLE_LOGS.QTY", description: "출고 수량입니다. 출고는 -, 출고취소는 + 로 표시되며 스캔 출고는 UID 1건당 1입니다." },
  lineCode: { db: "CONSUMABLE_LOGS.LINE_CODE", description: "출고 대상 라인 코드입니다. 수동 출고에서 지정한 경우에만 값이 있습니다." },
  processCode: { db: "CONSUMABLE_LOGS.PROCESS_CODE", description: "출고 대상 공정 코드입니다. 스캔 출고 시 선택한 공정이 기록되고, 해당 공정 재고(PROC_WAIT)로 이동합니다." },
  equipCode: { db: "CONSUMABLE_LOGS.EQUIP_CODE", description: "출고 대상 설비 코드입니다. 수동 출고에서 지정한 경우에만 값이 있습니다." },
  remark: { db: "CONSUMABLE_LOGS.REMARK", description: "출고 관련 메모입니다." },
} as const;

export type IssuingFieldKey = keyof typeof ISSUING_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(ISSUING_FIELD_HELP, "consumables.issuing.fieldHelp");
