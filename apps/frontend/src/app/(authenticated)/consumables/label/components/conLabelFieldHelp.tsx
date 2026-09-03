"use client";

/**
 * @file consumables/label/components/conLabelFieldHelp.tsx
 * @description 소모품 라벨(UID) 발행 화면 필드/컬럼 도움말 사전 — 발행 대상 마스터 그리드 헤더의 ? 가 이 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/consumable-master.entity.ts, consumable-stock.entity.ts(@Column name) 기준.
 *              instanceCount/pendingCount 는 GET /consumables/label/masters 에서 CONSUMABLE_STOCKS 를 집계한 파생값이다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const CON_LABEL_FIELD_HELP = {
  consumableCode: { db: "CONSUMABLE_MASTERS.CONSUMABLE_CODE", description: "라벨을 발행할 소모품 마스터 코드입니다. 발행된 UID는 이 코드에 묶여 관리됩니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "현장에서 부르는 소모품 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다. 상단 카테고리 필터와 라벨 템플릿 선택 기준이 됩니다." },
  stockQty: { db: "CONSUMABLE_MASTERS.STOCK_QTY", description: "마스터 기준 현재 보유 수량입니다. 입고 확정(스캔) 시 1씩 늘어납니다." },
  instanceCount: { db: "(파생) CONSUMABLE_STOCKS 의 CONSUMABLE_CODE 별 건수", description: "이 소모품으로 이미 발행된 UID(개별 인스턴스) 수입니다. 괄호 안 미입고는 라벨만 발행되고 아직 입고 스캔이 안 된 건수입니다." },
  pendingCount: { db: "(파생) CONSUMABLE_STOCKS.STATUS = 'PENDING' 건수", description: "라벨은 발행됐지만 아직 입고 확정되지 않은 UID 수입니다. 이 값이 남아 있으면 추가 발행 전에 입고 처리를 먼저 확인합니다." },
  qty: { db: "(입력) 발행 시 CONSUMABLE_STOCKS 에 생성될 행 수", description: "이번에 새로 발행할 UID 수량입니다(1~99). 입력한 수만큼 PENDING 상태 인스턴스가 만들어지고 라벨이 출력됩니다." },
} as const;

export type ConLabelFieldKey = keyof typeof CON_LABEL_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(CON_LABEL_FIELD_HELP, "consumables.label.fieldHelp");
