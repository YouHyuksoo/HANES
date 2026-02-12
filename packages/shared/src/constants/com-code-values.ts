/**
 * @file packages/shared/src/constants/com-code-values.ts
 * @description 공통코드 그룹별 허용 값 상수 (Backend DTO validation, Frontend 타입 용도)
 *
 * 초보자 가이드:
 * 1. **as const**: 리터럴 타입 추론을 위해 필수
 * 2. **_VALUES 배열**: DTO의 @IsIn() 데코레이터에서 사용
 * 3. **Value 타입**: 해당 그룹의 union 타입 (예: 'WAITING' | 'RUNNING' | 'DONE')
 */

// ===== 작업지시 상태 =====
export const JOB_ORDER_STATUS_VALUES = ['WAITING', 'RUNNING', 'PAUSED', 'DONE', 'CANCELED'] as const;
export type JobOrderStatusValue = typeof JOB_ORDER_STATUS_VALUES[number];

// ===== 작업지시 유형 =====
export const JOB_ORDER_TYPE_VALUES = ['NORMAL', 'REWORK', 'SAMPLE', 'TRIAL'] as const;
export type JobOrderTypeValue = typeof JOB_ORDER_TYPE_VALUES[number];

// ===== 반제품 상태 =====
export const SEMI_PRODUCT_STATUS_VALUES = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'MOVED'] as const;
export type SemiProductStatusValue = typeof SEMI_PRODUCT_STATUS_VALUES[number];

// ===== BOX 상태 =====
export const BOX_STATUS_VALUES = ['OPEN', 'CLOSED', 'SHIPPED'] as const;
export type BoxStatusValue = typeof BOX_STATUS_VALUES[number];

// ===== 팔레트 상태 =====
export const PALLET_STATUS_VALUES = ['OPEN', 'CLOSED', 'LOADED', 'SHIPPED'] as const;
export type PalletStatusValue = typeof PALLET_STATUS_VALUES[number];

// ===== 출하 상태 =====
export const SHIPMENT_STATUS_VALUES = ['PREPARING', 'LOADED', 'SHIPPED', 'DELIVERED', 'CANCELED'] as const;
export type ShipmentStatusValue = typeof SHIPMENT_STATUS_VALUES[number];

// ===== 입하 상태 =====
export const RECEIVE_STATUS_VALUES = ['PENDING', 'IQC_IN_PROGRESS', 'PASSED', 'FAILED'] as const;
export type ReceiveStatusValue = typeof RECEIVE_STATUS_VALUES[number];

// ===== 출고 상태 =====
export const ISSUE_STATUS_VALUES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export type IssueStatusValue = typeof ISSUE_STATUS_VALUES[number];

// ===== 설비 상태 =====
export const EQUIP_STATUS_VALUES = ['NORMAL', 'MAINT', 'STOP'] as const;
export type EquipStatusValue = typeof EQUIP_STATUS_VALUES[number];

// ===== PM 상태 =====
export const PM_STATUS_VALUES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as const;
export type PmStatusValue = typeof PM_STATUS_VALUES[number];

// ===== 불량 상태 =====
export const DEFECT_STATUS_VALUES = ['PENDING', 'REPAIRING', 'COMPLETED', 'SCRAPPED'] as const;
export type DefectStatusValue = typeof DEFECT_STATUS_VALUES[number];

// ===== 불량 처리 유형 =====
export const DEFECT_DISPOSITION_VALUES = ['REPAIR', 'REWORK', 'SCRAP', 'CONCESSION'] as const;
export type DefectDispositionValue = typeof DEFECT_DISPOSITION_VALUES[number];

// ===== 검사 결과 =====
export const INSPECT_RESULT_VALUES = ['PASS', 'FAIL'] as const;
export type InspectResultValue = typeof INSPECT_RESULT_VALUES[number];

// ===== 검사 유형 =====
export const INSPECT_TYPE_VALUES = ['CONTINUITY', 'INSULATION', 'HI_POT', 'VISUAL'] as const;
export type InspectTypeValue = typeof INSPECT_TYPE_VALUES[number];

// ===== 품질 판정 =====
export const QUALITY_JUDGMENT_VALUES = ['PASS', 'FAIL', 'PENDING', 'CONDITIONAL'] as const;
export type QualityJudgmentValue = typeof QUALITY_JUDGMENT_VALUES[number];

// ===== 승인 상태 =====
export const APPROVAL_STATUS_VALUES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatusValue = typeof APPROVAL_STATUS_VALUES[number];

// ===== 인터페이스 상태 =====
export const INTERFACE_STATUS_VALUES = ['PENDING', 'SENT', 'FAILED', 'CONFIRMED'] as const;
export type InterfaceStatusValue = typeof INTERFACE_STATUS_VALUES[number];

// ===== 검사기 연결 상태 =====
export const CONNECTION_STATUS_VALUES = ['CONNECTED', 'DISCONNECTED', 'ERROR'] as const;
export type ConnectionStatusValue = typeof CONNECTION_STATUS_VALUES[number];

// ===== 공정 유형 =====
export const PROCESS_TYPE_VALUES = ['CUTTING', 'CRIMPING', 'ASSEMBLY', 'INSPECTION', 'PACKING'] as const;
export type ProcessTypeValue = typeof PROCESS_TYPE_VALUES[number];

// ===== 품목 유형 =====
export const ITEM_TYPE_VALUES = ['RAW_MATERIAL', 'SEMI_PRODUCT', 'FINISHED', 'CONSUMABLE'] as const;
export type ItemTypeValue = typeof ITEM_TYPE_VALUES[number];

// ===== BOM 유형 =====
export const BOM_TYPE_VALUES = ['PRODUCTION', 'STANDARD', 'ENGINEERING'] as const;
export type BomTypeValue = typeof BOM_TYPE_VALUES[number];

// ===== 창고 유형 =====
export const WAREHOUSE_TYPE_VALUES = ['RAW_MATERIAL', 'WIP', 'FINISHED', 'MRB', 'HOLD'] as const;
export type WarehouseTypeValue = typeof WAREHOUSE_TYPE_VALUES[number];

// ===== 재고 이동 유형 =====
export const INVENTORY_MOVE_TYPE_VALUES = ['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'SCRAP'] as const;
export type InventoryMoveTypeValue = typeof INVENTORY_MOVE_TYPE_VALUES[number];

// ===== 금형 상태 =====
export const MOLD_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'REPAIR', 'SCRAPPED'] as const;
export type MoldStatusValue = typeof MOLD_STATUS_VALUES[number];

// ===== 일반 상태 =====
export const GENERAL_STATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;
export type GeneralStatusValue = typeof GENERAL_STATUS_VALUES[number];

// ===== 사용 여부 =====
export const USE_YN_VALUES = ['Y', 'N'] as const;
export type UseYnValue = typeof USE_YN_VALUES[number];

// ===== 공장/조직 유형 =====
export const PLANT_TYPE_VALUES = ['PLANT', 'SHOP', 'LINE', 'CELL'] as const;
export type PlantTypeValue = typeof PLANT_TYPE_VALUES[number];

// ===== 품목 분류 (DTO용) =====
export const PART_TYPE_VALUES = ['RAW', 'WIP', 'FG'] as const;
export type PartTypeValue = typeof PART_TYPE_VALUES[number];

// ===== 자재 LOT IQC 상태 =====
export const IQC_STATUS_VALUES = ['PENDING', 'PASS', 'FAIL', 'HOLD'] as const;
export type IqcStatusValue = typeof IQC_STATUS_VALUES[number];

// ===== 자재 LOT 상태 =====
export const MAT_LOT_STATUS_VALUES = ['NORMAL', 'HOLD', 'DEPLETED'] as const;
export type MatLotStatusValue = typeof MAT_LOT_STATUS_VALUES[number];

// ===== 출고 유형 =====
export const ISSUE_TYPE_VALUES = ['PROD', 'SUBCON', 'SAMPLE', 'ADJ'] as const;
export type IssueTypeValue = typeof ISSUE_TYPE_VALUES[number];

// ===== 생산실적 상태 =====
export const PROD_RESULT_STATUS_VALUES = ['RUNNING', 'DONE', 'CANCELED'] as const;
export type ProdResultStatusValue = typeof PROD_RESULT_STATUS_VALUES[number];

// ===== 설비 유형 =====
export const EQUIP_TYPE_VALUES = [
  'AUTO_CRIMP', 'SINGLE_CUT', 'MULTI_CUT', 'TWIST', 'SOLDER',
  'HOUSING', 'TESTER', 'LABEL_PRINTER', 'INSPECTION', 'PACKING', 'OTHER',
] as const;
export type EquipTypeValue = typeof EQUIP_TYPE_VALUES[number];

// ===== 통신 유형 =====
export const COMM_TYPE_VALUES = ['MQTT', 'SERIAL', 'TCP', 'OPC_UA', 'MODBUS'] as const;
export type CommTypeValue = typeof COMM_TYPE_VALUES[number];

// ===== 통신설정 - 시리얼 옵션 =====
export const BAUD_RATE_VALUES = [9600, 19200, 38400, 57600, 115200] as const;
export type BaudRateValue = typeof BAUD_RATE_VALUES[number];

export const DATA_BITS_VALUES = [7, 8] as const;
export type DataBitsValue = typeof DATA_BITS_VALUES[number];

export const STOP_BITS_VALUES = ['1', '1.5', '2'] as const;
export type StopBitsValue = typeof STOP_BITS_VALUES[number];

export const PARITY_VALUES = ['NONE', 'EVEN', 'ODD'] as const;
export type ParityValue = typeof PARITY_VALUES[number];

export const FLOW_CONTROL_VALUES = ['NONE', 'XONXOFF', 'RTSCTS'] as const;
export type FlowControlValue = typeof FLOW_CONTROL_VALUES[number];

// ===== 소모품 카테고리 =====
export const CONSUMABLE_CATEGORY_VALUES = ['MOLD', 'JIG', 'TOOL'] as const;
export type ConsumableCategoryValue = typeof CONSUMABLE_CATEGORY_VALUES[number];

// ===== 소모품 상태 =====
export const CONSUMABLE_STATUS_VALUES = ['NORMAL', 'WARNING', 'REPLACE'] as const;
export type ConsumableStatusValue = typeof CONSUMABLE_STATUS_VALUES[number];

// ===== 소모품 이력 유형 =====
export const CONSUMABLE_LOG_TYPE_VALUES = ['IN', 'IN_RETURN', 'OUT', 'OUT_RETURN'] as const;
export type ConsumableLogTypeValue = typeof CONSUMABLE_LOG_TYPE_VALUES[number];

// ===== 소모품 이력 유형 그룹 =====
export const CONSUMABLE_LOG_TYPE_GROUP_VALUES = ['RECEIVING', 'ISSUING'] as const;
export type ConsumableLogTypeGroupValue = typeof CONSUMABLE_LOG_TYPE_GROUP_VALUES[number];

// ===== 소모품 입고 구분 =====
export const INCOMING_TYPE_VALUES = ['NEW', 'REPLACEMENT'] as const;
export type IncomingTypeValue = typeof INCOMING_TYPE_VALUES[number];

// ===== 소모품 출고 사유 =====
export const ISSUE_REASON_VALUES = ['PRODUCTION', 'REPAIR', 'OTHER'] as const;
export type IssueReasonValue = typeof ISSUE_REASON_VALUES[number];

// ===== 통관 입항 상태 =====
export const CUSTOMS_ENTRY_STATUS_VALUES = ['PENDING', 'CLEARED', 'RELEASED'] as const;
export type CustomsEntryStatusValue = typeof CUSTOMS_ENTRY_STATUS_VALUES[number];

// ===== 통관 LOT 상태 =====
export const CUSTOMS_LOT_STATUS_VALUES = ['BONDED', 'PARTIAL', 'RELEASED'] as const;
export type CustomsLotStatusValue = typeof CUSTOMS_LOT_STATUS_VALUES[number];

// ===== 사용보고서 상태 =====
export const USAGE_REPORT_STATUS_VALUES = ['DRAFT', 'REPORTED', 'CONFIRMED'] as const;
export type UsageReportStatusValue = typeof USAGE_REPORT_STATUS_VALUES[number];

// ===== 거래처 유형 =====
export const PARTNER_TYPE_VALUES = ['SUPPLIER', 'CUSTOMER'] as const;
export type PartnerTypeValue = typeof PARTNER_TYPE_VALUES[number];

// ===== 협력사 유형 =====
export const VENDOR_TYPE_VALUES = ['SUBCON', 'SUPPLIER'] as const;
export type VendorTypeValue = typeof VENDOR_TYPE_VALUES[number];

// ===== 외주 발주 상태 =====
export const SUBCON_ORDER_STATUS_VALUES = ['ORDERED', 'DELIVERED', 'PARTIAL_RECV', 'RECEIVED', 'CLOSED', 'CANCELED'] as const;
export type SubconOrderStatusValue = typeof SUBCON_ORDER_STATUS_VALUES[number];

// ===== 외주 검수 결과 =====
export const SUBCON_INSPECT_RESULT_VALUES = ['PASS', 'FAIL', 'PARTIAL'] as const;
export type SubconInspectResultValue = typeof SUBCON_INSPECT_RESULT_VALUES[number];

// ===== 인터페이스 방향 =====
export const INTERFACE_DIRECTION_VALUES = ['IN', 'OUT'] as const;
export type InterfaceDirectionValue = typeof INTERFACE_DIRECTION_VALUES[number];

// ===== 인터페이스 로그 상태 =====
export const IF_LOG_STATUS_VALUES = ['PENDING', 'SUCCESS', 'FAIL', 'RETRY'] as const;
export type IfLogStatusValue = typeof IF_LOG_STATUS_VALUES[number];

// ===== 불량 로그 상태 (DTO) =====
export const DEFECT_LOG_STATUS_VALUES = ['WAIT', 'REPAIR', 'REWORK', 'SCRAP', 'DONE'] as const;
export type DefectLogStatusValue = typeof DEFECT_LOG_STATUS_VALUES[number];

// ===== 수리 결과 =====
export const REPAIR_RESULT_VALUES = ['PASS', 'FAIL', 'SCRAP'] as const;
export type RepairResultValue = typeof REPAIR_RESULT_VALUES[number];

// ===== 창고 유형 (DTO) =====
export const WAREHOUSE_TYPE_DTO_VALUES = ['RAW', 'WIP', 'FG', 'FLOOR', 'DEFECT', 'SCRAP', 'SUBCON'] as const;
export type WarehouseTypeDtoValue = typeof WAREHOUSE_TYPE_DTO_VALUES[number];

// ===== 재고 트랜잭션 유형 =====
export const TRANSACTION_TYPE_VALUES = [
  'MAT_IN', 'MAT_IN_CANCEL', 'MAT_OUT', 'MAT_OUT_CANCEL',
  'WIP_IN', 'WIP_IN_CANCEL', 'WIP_OUT', 'WIP_OUT_CANCEL',
  'FG_IN', 'FG_IN_CANCEL', 'FG_OUT', 'FG_OUT_CANCEL',
  'SUBCON_OUT', 'SUBCON_OUT_CANCEL', 'SUBCON_IN', 'SUBCON_IN_CANCEL',
  'PROD_CONSUME', 'PROD_CONSUME_CANCEL',
  'TRANSFER', 'TRANSFER_CANCEL',
  'ADJ_PLUS', 'ADJ_MINUS', 'SCRAP',
] as const;
export type TransactionTypeValue = typeof TRANSACTION_TYPE_VALUES[number];

// ===== 참조 유형 =====
export const REF_TYPE_VALUES = ['JOB_ORDER', 'SUBCON_ORDER', 'SHIPMENT', 'CUSTOMS', 'ADJUST', 'PROD_RESULT'] as const;
export type RefTypeValue = typeof REF_TYPE_VALUES[number];
