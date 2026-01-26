/**
 * @file packages/shared/src/types/enums.ts
 * @description 공정/상태 Enum 타입 정의
 * Oracle 예약어 회피를 위해 컬럼명 규칙 준수
 *
 * 초보자 가이드:
 * 1. **Enum 사용법**: ProcessType.CUTTING 형태로 사용
 * 2. **확장 시**: 새 값 추가 후 관련 상수(constants/)도 함께 업데이트
 */

/** 공정 유형 */
export enum ProcessType {
  CUTTING = 'CUTTING',           // 절단
  CRIMPING = 'CRIMPING',         // 압착
  ASSEMBLY = 'ASSEMBLY',         // 조립
  INSPECTION = 'INSPECTION',     // 검사
  PACKING = 'PACKING',           // 포장
}

/** 작업 상태 */
export enum WorkStatus {
  PENDING = 'PENDING',           // 대기
  IN_PROGRESS = 'IN_PROGRESS',   // 진행중
  COMPLETED = 'COMPLETED',       // 완료
  CANCELED = 'CANCELED',         // 취소
  ON_HOLD = 'ON_HOLD',           // 보류
}

/** 일반 상태 코드 */
export enum Status {
  ACTIVE = 'ACTIVE',             // 활성
  INACTIVE = 'INACTIVE',         // 비활성
  CANCELED = 'CANCELED',         // 취소됨
  COMPLETED = 'COMPLETED',       // 완료됨
  IN_PROGRESS = 'IN_PROGRESS',   // 진행중
  PENDING = 'PENDING',           // 대기중
}

/** 품질 판정 */
export enum QualityJudgment {
  PASS = 'PASS',                 // 합격
  FAIL = 'FAIL',                 // 불합격
  PENDING = 'PENDING',           // 판정대기
  CONDITIONAL = 'CONDITIONAL',   // 조건부합격
}

/** 불량 처리 유형 */
export enum DefectDisposition {
  REPAIR = 'REPAIR',             // 수리
  REWORK = 'REWORK',             // 재작업
  SCRAP = 'SCRAP',               // 폐기
  CONCESSION = 'CONCESSION',     // 특채
}

/** 재고 이동 유형 */
export enum InventoryMoveType {
  RECEIPT = 'RECEIPT',           // 입고
  ISSUE = 'ISSUE',               // 출고
  TRANSFER = 'TRANSFER',         // 이동
  ADJUSTMENT = 'ADJUSTMENT',     // 조정
  SCRAP = 'SCRAP',               // 폐기
}

/** 창고 유형 */
export enum WarehouseType {
  RAW_MATERIAL = 'RAW_MATERIAL', // 원자재
  WIP = 'WIP',                   // 재공품
  FINISHED = 'FINISHED',         // 완제품
  MRB = 'MRB',                   // 불량품 격리
  HOLD = 'HOLD',                 // 보류
}

/** 수리 상태 */
export enum RepairStatus {
  WAITING = 'WAITING',           // 대기
  IN_REPAIR = 'IN_REPAIR',       // 수리중
  COMPLETED = 'COMPLETED',       // 완료
  SCRAPPED = 'SCRAPPED',         // 폐기
}

/** ERP 인터페이스 상태 */
export enum InterfaceStatus {
  PENDING = 'PENDING',           // 전송대기
  SENT = 'SENT',                 // 전송완료
  FAILED = 'FAILED',             // 전송실패
  CONFIRMED = 'CONFIRMED',       // 확인완료
}

/** 설비 상태 */
export enum EquipmentStatus {
  RUNNING = 'RUNNING',           // 가동중
  IDLE = 'IDLE',                 // 대기
  MAINTENANCE = 'MAINTENANCE',   // 보전중
  BREAKDOWN = 'BREAKDOWN',       // 고장
  SETUP = 'SETUP',               // 셋업중
}

/** IQC 상태 */
export enum IqcStatus {
  WAITING = 'WAITING',           // 검사대기
  IN_PROGRESS = 'IN_PROGRESS',   // 검사중
  PASSED = 'PASSED',             // 합격
  FAILED = 'FAILED',             // 불합격
  HOLD = 'HOLD',                 // 보류
}

/** 트랜잭션 취소 유형 */
export enum CancelType {
  RECEIPT_CANCEL = 'RECEIPT_CANCEL',       // 입고취소
  ISSUE_CANCEL = 'ISSUE_CANCEL',           // 출고취소
  PRODUCTION_CANCEL = 'PRODUCTION_CANCEL', // 생산취소
  SHIPMENT_CANCEL = 'SHIPMENT_CANCEL',     // 출하취소
}

/** 품목 유형 */
export enum ItemType {
  RAW_MATERIAL = 'RAW_MATERIAL', // 원자재
  SEMI_PRODUCT = 'SEMI_PRODUCT', // 반제품
  FINISHED = 'FINISHED',         // 완제품
  CONSUMABLE = 'CONSUMABLE',     // 소모품
}

/** BOM 유형 */
export enum BomType {
  PRODUCTION = 'PRODUCTION',     // 생산용
  STANDARD = 'STANDARD',         // 표준
  ENGINEERING = 'ENGINEERING',   // 설계용
}

/** 작업지시 유형 */
export enum JobOrderType {
  NORMAL = 'NORMAL',             // 일반
  REWORK = 'REWORK',             // 재작업
  SAMPLE = 'SAMPLE',             // 샘플
  TRIAL = 'TRIAL',               // 시험
}

/** 검사 유형 */
export enum InspectionType {
  IQC = 'IQC',                   // 수입검사
  PQC = 'PQC',                   // 공정검사
  FQC = 'FQC',                   // 최종검사
  OQC = 'OQC',                   // 출하검사
}

/** 출하 상태 */
export enum ShipmentStatus {
  PLANNED = 'PLANNED',           // 계획
  PICKING = 'PICKING',           // 피킹중
  PACKED = 'PACKED',             // 포장완료
  SHIPPED = 'SHIPPED',           // 출하완료
  DELIVERED = 'DELIVERED',       // 배송완료
  CANCELED = 'CANCELED',         // 취소
}
