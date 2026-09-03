"use client";

/**
 * @file components/consumables/stockFieldHelp.tsx
 * @description 소모품 재고현황 그리드(StockTable) 컬럼 도움말 사전 — conUid 별 개별 인스턴스 기준.
 *              db 값은 apps/backend/src/entities/consumable-stock.entity.ts(@Column name) 기준.
 *              consumableName/category/expectedLife 는 GET /consumables/stocks 가 마스터를 조회해 붙이는 CONSUMABLE_MASTERS 값이다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const STOCK_FIELD_HELP = {
  conUid: { db: "CONSUMABLE_STOCKS.CON_UID", description: "라벨에 인쇄된 개별 인스턴스 UID입니다. 입고·출고·장착 스캔은 모두 이 값으로 처리됩니다." },
  qty: { db: "(파생) 인스턴스 1건 = 1개 고정", description: "UID 하나는 실물 1개를 뜻하므로 항상 1입니다. 소모품별 합계는 행 수를 세면 됩니다." },
  consumableCode: { db: "CONSUMABLE_STOCKS.CONSUMABLE_CODE", description: "인스턴스가 속한 소모품 마스터 코드입니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "소모품 코드에 연결된 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다." },
  status: { db: "CONSUMABLE_STOCKS.STATUS", description: "인스턴스 상태(공통코드 CON_STOCK_STATUS)입니다. PENDING(미입고)→ACTIVE(창고)→PROC_WAIT(공정 대기)→MOUNTED(장착) 순으로 흐릅니다." },
  currentCount: { db: "CONSUMABLE_STOCKS.CURRENT_COUNT / CONSUMABLE_MASTERS.EXPECTED_LIFE", description: "이 인스턴스의 누적 사용 타수와 마스터 수명 타수입니다. 80% 이상이면 주황, 100% 이상이면 빨강으로 교체 시점을 알립니다." },
  location: { db: "CONSUMABLE_STOCKS.LOCATION", description: "현재 보관 위치입니다. 입고 스캔 시 선택한 위치가 기록됩니다." },
  processCode: { db: "CONSUMABLE_STOCKS.PROCESS_CODE", description: "출고된 공정 코드입니다. 출고 스캔 시 선택한 공정이 들어가며, 출고취소하면 비워집니다." },
  mountedEquipCode: { db: "CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE", description: "현재 장착된 설비 코드입니다. 창고나 공정 대기 중이면 비어 있습니다." },
  recvDate: { db: "CONSUMABLE_STOCKS.RECV_DATE", description: "입고 확정(스캔)된 일자입니다. 미입고(PENDING) 인스턴스는 비어 있습니다." },
  vendorName: { db: "CONSUMABLE_STOCKS.VENDOR_NAME", description: "입고 시 기록된 거래처 이름입니다." },
  unitPrice: { db: "CONSUMABLE_STOCKS.UNIT_PRICE", description: "입고 시 기록된 인스턴스 단가입니다. 재고 금액 산출에 쓰입니다." },
} as const;

export type StockFieldKey = keyof typeof STOCK_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(STOCK_FIELD_HELP, "consumables.stock.fieldHelp");
