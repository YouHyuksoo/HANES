"use client";

/**
 * @file master/equip-inspect-item/equipInspectItemFieldHelp.tsx
 * @description 점검항목 마스터 필드/컬럼 도움말 사전 — 우측 등록 패널 라벨과 그리드 헤더의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/equip-inspect-item-master.entity.ts(@Column name) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const EQUIP_INSPECT_ITEM_FIELD_HELP = {
  itemCode: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE", description: "점검항목을 식별하는 고유 코드입니다. 등록 후에는 바꿀 수 없으며 QR 라벨에도 이 코드가 인쇄됩니다." },
  equipType: { db: "EQUIP_INSPECT_ITEM_MASTERS.EQUIP_TYPE", description: "이 점검항목이 적용되는 설비 유형(공통코드 EQUIP_TYPE)입니다. 설비에 항목을 할당할 때 유형별로 골라 쓰는 기준입니다." },
  itemName: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_NAME", description: "점검자가 화면에서 보는 점검항목 이름입니다." },
  inspectType: { db: "EQUIP_INSPECT_ITEM_MASTERS.INSPECT_TYPE", description: "점검 구분(일상/정기/예방보전/작업자점검)입니다. 어느 점검 화면에 나타날지 결정합니다." },
  itemType: { db: "EQUIP_INSPECT_ITEM_MASTERS.ITEM_TYPE", description: "판정 방식입니다. 판정형(VISUAL)은 OK/NG로, 측정형(MEASURE)은 값을 입력해 상·하한으로 판정합니다." },
  criteria: { db: "EQUIP_INSPECT_ITEM_MASTERS.CRITERIA", description: "점검 시 확인할 기준 문구입니다. 측정형은 상·하한값이 우선하고 이 문구는 보조 설명으로 쓰입니다." },
  cycle: { db: "EQUIP_INSPECT_ITEM_MASTERS.CYCLE", description: "점검 주기(일/주/월/분기/반기/연)입니다. 정기점검 예정 대상을 뽑는 기준입니다." },
  unit: { db: "EQUIP_INSPECT_ITEM_MASTERS.UNIT", description: "측정형 항목의 측정 단위(공통코드 UNIT_TYPE)입니다." },
  lslValue: { db: "EQUIP_INSPECT_ITEM_MASTERS.LSL_VALUE", description: "측정형 항목의 하한값입니다. 측정값이 이 값보다 작으면 NG로 판정합니다." },
  uslValue: { db: "EQUIP_INSPECT_ITEM_MASTERS.USL_VALUE", description: "측정형 항목의 상한값입니다. 측정값이 이 값보다 크면 NG로 판정합니다." },
  imageUrl: { db: "EQUIP_INSPECT_ITEM_MASTERS.IMAGE_URL", description: "점검 위치나 기준을 보여주는 사진 파일 경로입니다. 점검 화면에서 참고 이미지로 표시됩니다." },
  useYn: { db: "EQUIP_INSPECT_ITEM_MASTERS.USE_YN", description: "사용 여부입니다. N이면 설비에 새로 할당할 수 없고 점검 대상에서 제외됩니다." },
  remark: { db: "EQUIP_INSPECT_ITEM_MASTERS.REMARK", description: "점검항목에 대한 참고 사항입니다." },
} as const;

export type EquipInspectItemFieldKey = keyof typeof EQUIP_INSPECT_ITEM_FIELD_HELP;

export const {
  Field,
  FieldHelpIcon,
  FieldInput,
  FieldSelect,
  FieldComCodeSelect,
  headerWithHelp,
} = createFieldHelp(EQUIP_INSPECT_ITEM_FIELD_HELP, "master.equipInspectItem.fieldHelp");
