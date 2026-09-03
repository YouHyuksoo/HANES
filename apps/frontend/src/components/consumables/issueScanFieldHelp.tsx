"use client";

/**
 * @file components/consumables/issueScanFieldHelp.tsx
 * @description 소모품 출고 바코드 스캔 패널(IssueScanPanel) 입력 필드 도움말 사전.
 *              db 값은 apps/backend/src/entities/consumable-stock.entity.ts, consumable-log.entity.ts(@Column name) 기준.
 *              POST /consumables/label/issue 가 CONSUMABLE_STOCKS.PROCESS_CODE 와 CONSUMABLE_LOGS.PROCESS_CODE 에 같이 기록한다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const ISSUE_SCAN_FIELD_HELP = {
  processCode: { db: "CONSUMABLE_STOCKS.PROCESS_CODE / CONSUMABLE_LOGS.PROCESS_CODE", description: "UID를 출고할 대상 공정입니다. 출고 모드에서는 공정을 먼저 골라야 스캔이 열리고, 스캔된 인스턴스는 이 공정의 재고(PROC_WAIT)가 됩니다." },
} as const;

export type IssueScanFieldKey = keyof typeof ISSUE_SCAN_FIELD_HELP;

export const { Field } = createFieldHelp(ISSUE_SCAN_FIELD_HELP, "consumables.issuing.scanFieldHelp");
