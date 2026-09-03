"use client";

/**
 * @file consumables/life/consumableLifeFieldHelp.tsx
 * @description 소모품 수명관리 그리드 컬럼 도움말 사전 — conUid 별 인스턴스 수명 현황.
 *              db 값은 apps/backend/src/entities/consumable-stock.entity.ts, consumable-master.entity.ts(@Column name) 기준.
 *              데이터는 GET /consumables/stocks 응답을 page.tsx 에서 가공한 것으로, status 는 화면에서 계산하고
 *              lastReplaceAt 은 CONSUMABLE_STOCKS.RECV_DATE 를 그대로 옮긴 값이다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const CONSUMABLE_LIFE_FIELD_HELP = {
  conUid: { db: "CONSUMABLE_STOCKS.CON_UID", description: "라벨에 인쇄된 개별 인스턴스 UID입니다. 수명은 마스터가 아니라 이 UID 단위로 관리됩니다." },
  consumableCode: { db: "CONSUMABLE_STOCKS.CONSUMABLE_CODE", description: "인스턴스가 속한 소모품 마스터 코드입니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "소모품 코드에 연결된 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다." },
  location: { db: "CONSUMABLE_STOCKS.LOCATION", description: "현재 보관 위치입니다. 교체 대상을 찾으러 갈 때 참고합니다." },
  mountedEquipCode: { db: "CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE", description: "현재 장착된 설비 코드입니다. 장착 중인 인스턴스가 교체 상태면 해당 설비 정지 여부를 확인합니다." },
  lifePercentage: { db: "(파생) CONSUMABLE_STOCKS.CURRENT_COUNT ÷ CONSUMABLE_MASTERS.EXPECTED_LIFE", description: "수명 소진율(%)입니다. 80% 이상 노랑(경고), 100% 이상 빨강(교체)으로 표시됩니다." },
  currentCount: { db: "CONSUMABLE_STOCKS.CURRENT_COUNT / CONSUMABLE_MASTERS.EXPECTED_LIFE", description: "이 인스턴스의 누적 사용 타수와 마스터에 설정된 수명 타수입니다. 실적 저장 시 누적됩니다." },
  remainingLife: { db: "(파생) CONSUMABLE_MASTERS.EXPECTED_LIFE − CONSUMABLE_STOCKS.CURRENT_COUNT", description: "교체까지 남은 타수입니다. 수명을 넘기면 초과분이 + 로 빨갛게 표시됩니다." },
  lastReplaceAt: { db: "CONSUMABLE_STOCKS.RECV_DATE", description: "이 인스턴스가 입고 확정된 일자입니다. 교체 후 새 UID로 입고되므로 마지막 교체 시점으로 봅니다." },
} as const;

export type ConsumableLifeFieldKey = keyof typeof CONSUMABLE_LIFE_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(CONSUMABLE_LIFE_FIELD_HELP, "consumables.life.fieldHelp");
