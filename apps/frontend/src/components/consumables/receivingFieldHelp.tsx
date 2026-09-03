"use client";

/**
 * @file components/consumables/receivingFieldHelp.tsx
 * @description 소모품 입고 화면 필드/컬럼 도움말 사전 — 입고 이력 그리드(ReceivingTable) 헤더와 입고등록 패널(ReceivingFormPanel) 라벨의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/consumable-log.entity.ts(@Column name) 기준.
 *              consumableName 은 GET /consumables/logs 가 master relation 으로 붙이는 CONSUMABLE_MASTERS.NAME 이다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const RECEIVING_FIELD_HELP = {
  createdAt: { db: "CONSUMABLE_LOGS.CREATED_AT", description: "입고 또는 입고반납이 처리된 일시입니다. 기간 필터와 당일 집계 기준이 됩니다." },
  consumableCode: { db: "CONSUMABLE_LOGS.CONSUMABLE_CODE", description: "입고 대상 소모품 마스터 코드입니다. 등록 패널에서는 검색 버튼으로 선택합니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "소모품 코드에 연결된 이름입니다." },
  conUid: { db: "CONSUMABLE_LOGS.CON_UID", description: "바코드 스캔으로 입고한 경우 라벨의 개별 UID입니다. 수동 입고는 UID 없이 수량만 기록됩니다." },
  logType: { db: "CONSUMABLE_LOGS.LOG_TYPE", description: "IN(입고)/IN_RETURN(입고반납) 구분입니다. 반납이면 수량이 재고에서 빠집니다." },
  qty: { db: "CONSUMABLE_LOGS.QTY", description: "입고 수량입니다. 입고는 +, 입고반납은 - 로 마스터 보유 수량에 반영됩니다." },
  vendorCode: { db: "CONSUMABLE_LOGS.VENDOR_CODE", description: "납품한 거래처 코드입니다. 거래처별 입고 실적 조회에 쓰입니다." },
  vendorName: { db: "CONSUMABLE_LOGS.VENDOR_NAME", description: "납품한 거래처 이름입니다." },
  unitPrice: { db: "CONSUMABLE_LOGS.UNIT_PRICE", description: "입고 단가입니다. 입고 금액(단가×수량) 집계에 쓰입니다." },
  incomingType: { db: "CONSUMABLE_LOGS.INCOMING_TYPE", description: "NEW(신규 구매)/REPLACEMENT(교체용) 구분입니다. 교체용 입고는 수명 만료 교체 실적으로 구분해 봅니다." },
  remark: { db: "CONSUMABLE_LOGS.REMARK", description: "입고 관련 메모(납품서 번호, 특이사항 등)입니다." },
} as const;

export type ReceivingFieldKey = keyof typeof RECEIVING_FIELD_HELP;

export const {
  Field,
  FieldInput,
  FieldSelect,
  headerWithHelp,
} = createFieldHelp(RECEIVING_FIELD_HELP, "consumables.receiving.fieldHelp");
