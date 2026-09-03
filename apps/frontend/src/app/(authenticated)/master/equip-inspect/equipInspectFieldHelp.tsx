"use client";

/**
 * @file master/equip-inspect/equipInspectFieldHelp.tsx
 * @description 설비점검항목(설비별 할당) 그리드 컬럼 도움말 사전.
 *              행은 EQUIP_INSPECT_ITEM_POOL 을 EQUIP_INSPECT_ITEM_MASTERS 와 조인한 결과(master/services/equip-inspect.service.ts findAll)라
 *              db 값은 컬럼별로 두 엔티티(equip-inspect-item-pool.entity.ts, equip-inspect-item-master.entity.ts) 중 실제 출처를 적는다.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const EQUIP_INSPECT_FIELD_HELP = {
  itemCode: { db: "EQUIP_INSPECT_ITEM_POOL.ITEM_CODE", description: "이 설비에 할당된 점검항목 코드입니다. 점검항목 마스터의 코드와 같습니다." },
  itemName: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_NAME (ITEM_CODE 조인)", description: "점검항목 이름입니다. 점검항목 마스터에서 가져오며 여기서는 수정할 수 없습니다." },
  criteria: { db: "EQUIP_INSPECT_ITEM_MASTERS.CRITERIA (ITEM_CODE 조인)", description: "점검 시 확인할 기준 문구입니다. 점검항목 마스터에서 관리합니다." },
  cycle: { db: "EQUIP_INSPECT_ITEM_MASTERS.CYCLE (ITEM_CODE 조인)", description: "점검 주기(일/주/월 등)입니다. 점검항목 마스터에서 관리합니다." },
  sortSeq: { db: "EQUIP_INSPECT_ITEM_POOL.SORT_SEQ", description: "점검 화면에서 항목이 나열되는 순서입니다. 작을수록 위에 표시됩니다." },
  useYn: { db: "EQUIP_INSPECT_ITEM_POOL.USE_YN", description: "이 설비에서 해당 항목을 점검 대상으로 쓸지 여부입니다. N이면 점검 화면에 나타나지 않습니다." },
} as const;

export type EquipInspectFieldKey = keyof typeof EQUIP_INSPECT_FIELD_HELP;

export const { headerWithHelp } = createFieldHelp(EQUIP_INSPECT_FIELD_HELP, "master.equipInspect.fieldHelp");
