"use client";

/**
 * @file components/consumables/barcodeScanFieldHelp.tsx
 * @description 소모품 입고 바코드 스캔 패널(BarcodeScanPanel)의 미입고(PENDING) UID 그리드 컬럼 도움말 사전.
 *              db 값은 apps/backend/src/entities/consumable-stock.entity.ts(@Column name) 기준.
 *              consumableName/category 는 GET /consumables/label/pending 이 마스터를 조회해 붙이는 CONSUMABLE_MASTERS 값이다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const BARCODE_SCAN_FIELD_HELP = {
  conUid: { db: "CONSUMABLE_STOCKS.CON_UID", description: "라벨에 인쇄된 개별 UID입니다. 이 값을 스캔하면 PENDING → ACTIVE 로 입고 확정됩니다." },
  consumableCode: { db: "CONSUMABLE_STOCKS.CONSUMABLE_CODE", description: "UID가 속한 소모품 마스터 코드입니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "소모품 코드에 연결된 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다." },
  labelPrintedAt: { db: "CONSUMABLE_STOCKS.LABEL_PRINTED_AT", description: "라벨(UID)이 발행된 일시입니다. 오래 남아 있는 미입고 건은 실물 도착 여부를 확인합니다." },
  vendorName: { db: "CONSUMABLE_STOCKS.VENDOR_NAME", description: "UID 발행 시 기록된 거래처 이름입니다. 없으면 비어 있습니다." },
} as const;

export type BarcodeScanFieldKey = keyof typeof BARCODE_SCAN_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(BARCODE_SCAN_FIELD_HELP, "consumables.receiving.scanFieldHelp");
