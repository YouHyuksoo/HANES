"use client";

/**
 * @file equipment/mold-mgmt/moldMgmtFieldHelp.tsx
 * @description 금형관리 필드/컬럼 도움말 사전 — 등록 패널 라벨, 그리드 헤더, 사용이력 인라인 폼의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/mold-master.entity.ts, mold-usage-log.entity.ts(@Column name) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const MOLD_MGMT_FIELD_HELP = {
  // ── MOLD_MASTERS (금형 마스터)
  moldCode: { db: "MOLD_MASTERS.MOLD_CODE", description: "금형을 식별하는 고유 코드입니다. 등록 후에는 바꿀 수 없습니다." },
  moldName: { db: "MOLD_MASTERS.MOLD_NAME", description: "현장에서 부르는 금형 이름입니다." },
  moldType: { db: "MOLD_MASTERS.MOLD_TYPE", description: "금형 유형(공통코드 MOLD_TYPE)입니다. 압착/사출 등 용도 분류 기준입니다." },
  itemCode: { db: "MOLD_MASTERS.ITEM_CODE", description: "이 금형으로 생산하는 품목 코드입니다. 품목 검색으로 선택합니다." },
  cavity: { db: "MOLD_MASTERS.CAVITY", description: "1회 타수(shot)로 생산되는 개수(캐비티 수)입니다. 타수 대비 생산 수량 환산에 쓰입니다." },
  currentShots: { db: "MOLD_MASTERS.CURRENT_SHOTS", description: "누적 사용 타수입니다. 사용이력을 등록하면 자동으로 더해집니다." },
  guaranteedShots: { db: "MOLD_MASTERS.GUARANTEED_SHOTS", description: "제조사가 보증하는 수명 타수입니다. 누적 타수가 이 값에 도달하면 설비 인터록이 걸리고 교체 대상으로 봅니다." },
  shotRate: { db: "(파생) MOLD_MASTERS.CURRENT_SHOTS / GUARANTEED_SHOTS 기준", description: "누적 타수를 보증 타수로 나눈 사용률(%)입니다. 90% 초과는 주의, 100% 초과는 교체 시점입니다." },
  status: { db: "MOLD_MASTERS.STATUS", description: "금형 상태(공통코드 MOLD_STATUS)입니다. 폐기 처리하면 RETIRED로 바뀌고 더 이상 사용할 수 없습니다." },
  maintenanceCycle: { db: "MOLD_MASTERS.MAINTENANCE_CYCLE", description: "보전(정비) 주기 타수입니다. 이 타수마다 정비가 필요하다고 판단해 보전 예정 목록에 올라갑니다." },
  lastMaintenanceDate: { db: "MOLD_MASTERS.LAST_MAINTENANCE_DATE", description: "마지막으로 보전(정비)을 수행한 날짜입니다." },
  nextMaintenanceDate: { db: "MOLD_MASTERS.NEXT_MAINTENANCE_DATE", description: "다음 보전 예정일입니다. 이 날짜가 가까워지면 보전 예정 목록에 표시됩니다." },
  location: { db: "MOLD_MASTERS.LOCATION", description: "금형 보관 위치(금형실, 선반 번호 등)입니다." },
  maker: { db: "MOLD_MASTERS.MAKER", description: "금형 제작사입니다." },
  purchaseDate: { db: "MOLD_MASTERS.PURCHASE_DATE", description: "금형을 구매(도입)한 날짜입니다." },
  remark: { db: "MOLD_MASTERS.REMARK", description: "금형에 대한 참고 사항입니다." },
  // ── MOLD_USAGE_LOGS (금형 사용이력)
  usageDate: { db: "MOLD_USAGE_LOGS.USAGE_DATE", description: "금형을 사용한 날짜입니다." },
  shotCount: { db: "MOLD_USAGE_LOGS.SHOT_COUNT", description: "해당 사용에서 발생한 타수입니다. 등록하면 금형의 누적 타수에 더해집니다." },
  orderNo: { db: "MOLD_USAGE_LOGS.ORDER_NO", description: "금형을 사용한 작업지시 번호입니다. 생산 추적에 쓰입니다." },
  equipCode: { db: "MOLD_USAGE_LOGS.EQUIP_CODE", description: "금형을 장착해 사용한 설비입니다. 보증 타수 초과 시 이 설비에 인터록이 걸립니다." },
  workerCode: { db: "MOLD_USAGE_LOGS.WORKER_CODE", description: "금형을 사용한 작업자입니다." },
  usageRemark: { db: "MOLD_USAGE_LOGS.REMARK", description: "사용이력에 대한 참고 사항입니다." },
} as const;

export type MoldMgmtFieldKey = keyof typeof MOLD_MGMT_FIELD_HELP;

export const {
  Field,
  FieldHelpIcon,
  FieldInput,
  FieldComCodeSelect,
  FieldQtyInput,
  HeaderHelp,
  headerWithHelp,
} = createFieldHelp(MOLD_MGMT_FIELD_HELP, "equipment.mold.fieldHelp");
