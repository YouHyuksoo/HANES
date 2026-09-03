"use client";

/**
 * @file consumables/mount/consumableMountFieldHelp.tsx
 * @description 소모품 설비 장착관리 화면 필드/컬럼 도움말 사전 — 그리드 헤더와 장착 모달 라벨의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/consumable-master.entity.ts, consumable-mount-log.entity.ts(@Column name) 기준.
 *              목록은 GET /equipment/consumables (CONSUMABLE_MASTERS) 이고, 장착/해제 액션은 CONSUMABLE_MOUNT_LOGS 에 이력을 남긴다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const CONSUMABLE_MOUNT_FIELD_HELP = {
  consumableCode: { db: "CONSUMABLE_MASTERS.CONSUMABLE_CODE", description: "장착/해제 대상 소모품 마스터 코드입니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "현장에서 부르는 소모품 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다." },
  mountedEquipCode: { db: "CONSUMABLE_MASTERS.MOUNTED_EQUIP_ID", description: "현재 장착된 설비 코드입니다. 장착 처리 시 기록되고 해제하면 비워집니다. 이미 장착된 소모품은 다른 설비에 장착할 수 없습니다." },
  lifeProgress: { db: "(파생) CONSUMABLE_MASTERS.CURRENT_COUNT ÷ EXPECTED_LIFE", description: "마스터 기준 수명 소진율(%)입니다. 100% 이상이면 장착 설비에 인터락이 걸릴 수 있습니다." },
  location: { db: "CONSUMABLE_MASTERS.LOCATION", description: "창고 보관 시 위치입니다. 장착할 소모품을 찾으러 갈 때 참고합니다." },
  equipCode: { db: "CONSUMABLE_MASTERS.MOUNTED_EQUIP_ID / CONSUMABLE_MOUNT_LOGS.EQUIP_CODE", description: "소모품을 장착할 설비입니다. 저장하면 마스터의 장착 설비가 바뀌고 장착 이력이 남습니다." },
  remark: { db: "CONSUMABLE_MOUNT_LOGS.REMARK", description: "장착/해제/수리 처리 사유나 메모입니다. 이력 조회에서 함께 보입니다." },
} as const;

export type ConsumableMountFieldKey = keyof typeof CONSUMABLE_MOUNT_FIELD_HELP;

export const {
  Field,
  FieldInput,
  headerWithHelp,
} = createFieldHelp(CONSUMABLE_MOUNT_FIELD_HELP, "consumables.mount.fieldHelp");
