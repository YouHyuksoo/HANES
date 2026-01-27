/**
 * @file packages/shared/src/types/com-code.ts
 * @description 공통코드 중앙 타입 정의
 *
 * 초보자 가이드:
 * 1. **ComCodeItem**: DB com_codes 테이블의 단일 코드 항목
 * 2. **ComCodeMap**: groupCode별 코드 목록 (API 응답 형태)
 * 3. **COM_CODE_GROUPS**: 시스템에서 사용하는 모든 groupCode 상수
 */

/** 공통코드 단일 항목 */
export interface ComCodeItem {
  detailCode: string;
  codeName: string;
  codeDesc: string | null;
  sortOrder: number;
  /** Tailwind CSS 배지 색상 클래스 */
  attr1: string | null;
  /** 아이콘 이름 (lucide-react) */
  attr2: string | null;
  /** 영어 라벨 */
  attr3: string | null;
}

/** groupCode별 코드 목록 맵 (API 응답 형태) */
export type ComCodeMap = Record<string, ComCodeItem[]>;

/** 시스템에서 사용하는 모든 groupCode 상수 */
export const COM_CODE_GROUPS = {
  /** 작업지시 상태 */
  JOB_ORDER_STATUS: 'JOB_ORDER_STATUS',
  /** 작업지시 유형 */
  JOB_ORDER_TYPE: 'JOB_ORDER_TYPE',
  /** 반제품 상태 */
  SEMI_PRODUCT_STATUS: 'SEMI_PRODUCT_STATUS',
  /** BOX 상태 */
  BOX_STATUS: 'BOX_STATUS',
  /** 팔레트 상태 */
  PALLET_STATUS: 'PALLET_STATUS',
  /** 출하 상태 */
  SHIPMENT_STATUS: 'SHIPMENT_STATUS',
  /** 입하 상태 */
  RECEIVE_STATUS: 'RECEIVE_STATUS',
  /** 출고 상태 */
  ISSUE_STATUS: 'ISSUE_STATUS',
  /** 설비 상태 */
  EQUIP_STATUS: 'EQUIP_STATUS',
  /** 설비 PM 상태 */
  PM_STATUS: 'PM_STATUS',
  /** 불량 상태 */
  DEFECT_STATUS: 'DEFECT_STATUS',
  /** 불량 처리 유형 */
  DEFECT_DISPOSITION: 'DEFECT_DISPOSITION',
  /** 검사 결과 */
  INSPECT_RESULT: 'INSPECT_RESULT',
  /** 검사 유형 */
  INSPECT_TYPE: 'INSPECT_TYPE',
  /** IQC 유형 */
  IQC_TYPE: 'IQC_TYPE',
  /** 품질 판정 */
  QUALITY_JUDGMENT: 'QUALITY_JUDGMENT',
  /** 승인 상태 */
  APPROVAL_STATUS: 'APPROVAL_STATUS',
  /** 인터페이스 상태 */
  INTERFACE_STATUS: 'INTERFACE_STATUS',
  /** 검사기 연결 상태 */
  CONNECTION_STATUS: 'CONNECTION_STATUS',
  /** 공정 유형 */
  PROCESS_TYPE: 'PROCESS_TYPE',
  /** 품목 유형 */
  ITEM_TYPE: 'ITEM_TYPE',
  /** BOM 유형 */
  BOM_TYPE: 'BOM_TYPE',
  /** 창고 유형 */
  WAREHOUSE_TYPE: 'WAREHOUSE_TYPE',
  /** 재고 이동 유형 */
  INVENTORY_MOVE_TYPE: 'INVENTORY_MOVE_TYPE',
  /** 금형 상태 */
  MOLD_STATUS: 'MOLD_STATUS',
  /** 일반 상태 */
  GENERAL_STATUS: 'GENERAL_STATUS',
  /** 사용여부 */
  USE_YN: 'USE_YN',
} as const;

export type ComCodeGroupKey = keyof typeof COM_CODE_GROUPS;
export type ComCodeGroupValue = typeof COM_CODE_GROUPS[ComCodeGroupKey];
