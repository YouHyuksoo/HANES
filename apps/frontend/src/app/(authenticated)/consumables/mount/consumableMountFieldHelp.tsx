"use client";

/**
 * @file consumables/mount/consumableMountFieldHelp.tsx
 * @description 소모품 장착관리 화면 필드/컬럼 도움말 사전 — 그리드 헤더와 액션 모달 라벨의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/consumable-stock.entity.ts(실물 롯트),
 *              consumable-master.entity.ts(코드 공통정보), consumable-mount-log.entity.ts(이력) 기준.
 *              목록은 GET /consumables/stocks (CONSUMABLE_STOCKS) 이고,
 *              강제해제/수리 액션은 CONSUMABLE_MOUNT_LOGS 에 이력을 남긴다.
 *              (2026-09 전환: 마스터 코드 단위 → 실물 롯트 conUid 단위)
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const CONSUMABLE_MOUNT_FIELD_HELP = {
  conUid: { db: "CONSUMABLE_STOCKS.CON_UID", description: "소모품 실물 1개의 고유 UID입니다. 라벨에 인쇄되며 현장 스캔 장착의 기준이 됩니다. 같은 소모품 코드라도 실물마다 줄이 따로 나옵니다." },
  consumableCode: { db: "CONSUMABLE_STOCKS.CONSUMABLE_CODE", description: "이 실물이 속한 소모품 마스터 코드입니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "현장에서 부르는 소모품 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다." },
  status: { db: "CONSUMABLE_STOCKS.STATUS", description: "실물 롯트의 현재 상태입니다. 미입고 → 사용가능 → 공정대기 → 장착중 순으로 흐르고, 수리중·폐기가 따로 있습니다. 장착은 현장 키오스크 스캔에서만 일어납니다." },
  mountedEquipCode: { db: "CONSUMABLE_STOCKS.MOUNTED_EQUIP_CODE", description: "현재 장착된 설비 코드입니다. 키오스크 스캔 장착 시 기록되고 해제하면 비워집니다." },
  processCode: { db: "CONSUMABLE_STOCKS.PROCESS_CODE", description: "공정출고 시 배정된 공정입니다. 출고 공정과 작업지시 공정이 달라도 장착이 차단됩니다." },
  lifeStatus: { db: "CONSUMABLE_STOCKS.LIFE_STATUS", description: "실물 개체의 수명 상태입니다. 누적 타수가 마스터의 경고 타수·기대수명에 도달하면 생산실적 저장 시 자동으로 주의·교체필요로 바뀝니다. 교체필요가 되면 장착 설비에 인터락이 걸립니다." },
  lifeProgress: { db: "(파생) CONSUMABLE_STOCKS.CURRENT_COUNT ÷ CONSUMABLE_MASTERS.EXPECTED_LIFE", description: "이 실물의 수명 소진율(%)입니다. 누적 타수는 생산실적 저장 시 소요량 × 실적수량만큼 올라갑니다." },
  location: { db: "CONSUMABLE_STOCKS.LOCATION", description: "창고 보관 시 위치입니다." },
  returnTo: { db: "CONSUMABLE_STOCKS.STATUS", description: "강제 해제한 뒤 되돌릴 상태입니다. 공정대기는 같은 공정에서 바로 재장착할 때, 창고 반납은 공정 배정까지 풀 때, 수리중은 설비에서 내려 정비할 때 고릅니다." },
  remark: { db: "CONSUMABLE_MOUNT_LOGS.REMARK", description: "강제해제/수리 처리 사유나 메모입니다. 이력 조회에서 함께 보입니다." },
} as const;

export type ConsumableMountFieldKey = keyof typeof CONSUMABLE_MOUNT_FIELD_HELP;

export const {
  Field,
  FieldInput,
  headerWithHelp,
} = createFieldHelp(CONSUMABLE_MOUNT_FIELD_HELP, "consumables.mount.fieldHelp");
