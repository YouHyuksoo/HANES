"use client";

/**
 * @file consumables/master/consumableMasterFieldHelp.tsx
 * @description 소모품마스터 필드/컬럼 도움말 사전 — 등록 패널 라벨과 그리드 헤더의 ? 가 같은 사전을 쓴다.
 *              db 값은 apps/backend/src/entities/consumable-master.entity.ts(@Column name) 기준.
 */
import { createFieldHelp } from "@/components/shared/field-help/createFieldHelp";

export const CONSUMABLE_MASTER_FIELD_HELP = {
  consumableCode: { db: "CONSUMABLE_MASTERS.CONSUMABLE_CODE", description: "소모품(금형·지그·공구 등)을 식별하는 고유 코드입니다. 등록 후에는 바꿀 수 없습니다." },
  consumableName: { db: "CONSUMABLE_MASTERS.NAME", description: "현장에서 부르는 소모품 이름입니다." },
  category: { db: "CONSUMABLE_MASTERS.CATEGORY", description: "소모품 분류(공통코드 CONSUMABLE_CATEGORY)입니다. 금형/지그/공구 등 관리 방식이 갈리는 기준입니다." },
  expectedLife: { db: "CONSUMABLE_MASTERS.EXPECTED_LIFE", description: "교체 기준 타수(수명)입니다. 누적 타수가 이 값에 도달하면 교체 대상으로 표시됩니다." },
  warningCount: { db: "CONSUMABLE_MASTERS.WARNING_COUNT", description: "경고를 띄우기 시작할 타수입니다. 수명 타수보다 작게 설정합니다." },
  currentCount: { db: "CONSUMABLE_MASTERS.CURRENT_COUNT", description: "마스터 기준 누적 사용 타수입니다. 실적 저장 시 자동 누적됩니다." },
  stockQty: { db: "CONSUMABLE_MASTERS.STOCK_QTY", description: "현재 보유 수량입니다. 입고/출고 처리로 갱신됩니다." },
  safetyStock: { db: "CONSUMABLE_MASTERS.SAFETY_STOCK", description: "재고 부족 판단 기준 수량입니다. 보유 수량이 이 값 아래로 내려가면 부족으로 표시됩니다." },
  location: { db: "CONSUMABLE_MASTERS.LOCATION", description: "보관 위치(금형실, 선반 번호 등)입니다." },
  vendor: { db: "CONSUMABLE_MASTERS.VENDOR", description: "구매/제작 거래처입니다." },
  unitPrice: { db: "CONSUMABLE_MASTERS.UNIT_PRICE", description: "단가입니다. 재고 금액 산출과 구매 참고에 쓰입니다." },
  status: { db: "CONSUMABLE_MASTERS.STATUS", description: "수명 상태(정상/경고/교체)입니다. 누적 타수와 경고·수명 타수를 비교해 자동 판정됩니다." },
  operStatus: { db: "CONSUMABLE_MASTERS.OPER_STATUS", description: "운용 상태(창고 보관/설비 장착 등)입니다." },
  imageUrl: { db: "CONSUMABLE_MASTERS.IMAGE_URL", description: "소모품 사진 파일 경로입니다." },
  useYn: { db: "CONSUMABLE_MASTERS.USE_YN", description: "사용 여부입니다. N이면 신규 선택 목록에서 제외됩니다." },
} as const;

export type ConsumableMasterFieldKey = keyof typeof CONSUMABLE_MASTER_FIELD_HELP;

export const {
  Field,
  FieldLabel,
  FieldInput,
  FieldComCodeSelect,
  FieldQtyInput,
  HeaderHelp,
  headerWithHelp,
} = createFieldHelp(CONSUMABLE_MASTER_FIELD_HELP, "consumables.master.fieldHelp");
