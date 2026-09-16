/**
 * @file raw-rows.ts
 * @description 관리계획 문서 시스템이 raw SQL(`QueryRunner.query`)로 읽는 행 타입 — 단일 출처
 *
 * 초보자 가이드:
 * 1. `QueryRunner.query`의 반환 타입은 TypeORM에서 `any`다. 그대로 쓰면 컬럼명 오타가
 *    컴파일에 잡히지 않고 런타임에 `undefined`로 조용히 흘러간다. 여기 선언한 타입을
 *    조회 결과에 **주석(annotation)으로** 붙여 쓴다 — `as` 단언은 쓰지 않는다.
 * 2. Oracle 드라이버는 컬럼명을 대문자 그대로 돌려주므로 프로퍼티도 대문자다.
 * 3. `SELECT *` 결과 중 **코드가 실제로 읽는 컬럼만** 선언한다. 전 컬럼을 옮겨 적으면
 *    테이블이 바뀔 때마다 두 곳을 고쳐야 하고, 읽지도 않는 컬럼이 거짓 계약이 된다.
 */

/** 관리계획 문서 3종 */
export type QualityPlanDocumentType = 'PFD' | 'PFMEA' | 'CONTROL_PLAN';

/** raw row의 문자열이 실제 문서유형인지 좁힌다 — 모르는 값은 통과시키지 않는다. */
export function isQualityPlanDocumentType(value: unknown): value is QualityPlanDocumentType {
  return value === 'PFD' || value === 'PFMEA' || value === 'CONTROL_PLAN';
}

/** 문서 행 3종(PFD/PFMEA/Control Plan)의 공통 키 */
export interface QualityPlanRawRowBase {
  ROW_ID: number;
  ROW_SEQ?: number | null;
}

/** QUALITY_PROCESS_FLOW_ROWS */
export interface ProcessFlowRawRow extends QualityPlanRawRowBase {
  PROCESS_NO?: string | null;
  PROCESS_CODE?: string | null;
  PROCESS_NAME?: string | null;
  FLOW_LANE?: string | null;
  /** 프론트가 camelCase로 받은 행을 되돌려 보내는 경로가 있어 함께 허용한다. */
  rowId?: number | null;
}

/** QUALITY_PFMEA_ROWS */
export interface PfmeaRawRow extends QualityPlanRawRowBase {
  PROCESS_FLOW_ROW_ID: number;
  SPECIAL_CHAR_CODE?: string | null;
  SEVERITY?: number | null;
  OCCURRENCE?: number | null;
  DETECTION?: number | null;
  RPN?: number | null;
  RECOMMENDED_ACTION?: string | null;
}

/** QUALITY_CONTROL_PLAN_ROWS — 필수 관리정보 4종은 이름으로 순회하므로 키가 고정돼야 한다. */
export interface ControlPlanRawRow extends QualityPlanRawRowBase {
  PROCESS_FLOW_ROW_ID: number;
  PFMEA_ROW_ID?: number | null;
  SAMPLE_SIZE?: string | null;
  SAMPLE_FREQUENCY?: string | null;
  SPECIFICATION?: string | null;
  EVALUATION_METHOD?: string | null;
  CONTROL_METHOD?: string | null;
  REACTION_PLAN?: string | null;
  EQUIPMENT_CODE?: string | null;
  CALIBRATION_CONFIRMED?: string | null;
}

/** Control Plan 필수 관리정보 — 누락 검증이 이 키만 순회한다. */
export const CONTROL_PLAN_REQUIRED_FIELDS = [
  'SPECIFICATION',
  'EVALUATION_METHOD',
  'CONTROL_METHOD',
  'REACTION_PLAN',
] as const satisfies readonly (keyof ControlPlanRawRow)[];

/** 검증 시작 시 읽는 Revision + 참조 문서 컨텍스트 */
export interface RevisionContextRawRow {
  PACKAGE_ID: number;
  DOCUMENT_TYPE?: string | null;
  /** Oracle 설정에 따라 소문자로 내려오는 경우가 있어 함께 허용한다. */
  document_type?: string | null;
  REVISION_CODE?: string | null;
  CHANGE_REASON?: string | null;
  CHANGE_DESCRIPTION?: string | null;
  REF_PFD_REVISION_ID?: number | null;
  REF_PFMEA_REVISION_ID?: number | null;
  REF_PFD_STATUS?: string | null;
  REF_PFD_PACKAGE_ID?: number | null;
  REF_PFD_TYPE?: string | null;
  REF_PFMEA_STATUS?: string | null;
  REF_PFMEA_PACKAGE_ID?: number | null;
  REF_PFMEA_TYPE?: string | null;
}

/** Revision 상태 확인용 (PFD DRAFT 여부 판정) */
export interface RevisionStatusRawRow {
  STATUS?: string | null;
  DOCUMENT_TYPE?: string | null;
}

/** 자동 초안 생성이 읽는 DRAFT 문서패키지 컨텍스트 */
export interface DraftGenerationContextRawRow {
  PACKAGE_ID: number;
  ITEM_CODE: string;
  PFD_REVISION_ID?: number | null;
  PFMEA_REVISION_ID?: number | null;
  CP_REVISION_ID?: number | null;
}

/** ROUTING_PROCESSES + COM_CODES(EQUIP_TYPE) 조인 결과 */
export interface RoutingProcessRawRow {
  SEQ: number;
  PROCESS_CODE?: string | null;
  PROCESS_NAME?: string | null;
  EQUIP_TYPE?: string | null;
  EQUIPMENT_NAME?: string | null;
  EXECUTION_TYPE?: string | null;
  SAMPLE_INSPECT_YN?: string | null;
}

/** PROCESS_QUALITY_CONDITIONS */
export interface ProcessQualityConditionRawRow {
  SEQ: number;
  CONDITION_SEQ?: number | null;
  CONDITION_CODE?: string | null;
  MIN_VALUE?: number | string | null;
  MAX_VALUE?: number | string | null;
  UNIT?: string | null;
}

/** INSPECT_ITEM_SPECS — HIPOT은 전용 규격 문구를 만들고, 나머지는 원본을 그대로 남긴다. */
export interface InspectItemSpecRawRow {
  INSPECT_TYPE?: string | null;
  TEST_VOLTAGE_KV?: number | string | null;
  MAX_CURRENT_MA?: number | string | null;
}

/** TERMINAL_CRIMP_SPECS */
export interface TerminalCrimpSpecRawRow {
  CRIMP_HEIGHT_LSL?: number | string | null;
  CRIMP_HEIGHT_USL?: number | string | null;
}

/** 출력 모델이 문서유형별로 갈라 쓰는 발행 Revision 행 */
export interface PublishedDocumentRawRow {
  DOCUMENT_ID: number;
  DOCUMENT_TYPE: string;
  REVISION_ID: number;
}

/** 시퀀스·집계 스칼라 조회 결과 (`SELECT ... AS "NEXT_SEQ" FROM DUAL` 류) */
export interface ScalarRawRow {
  NEXT_SEQ?: number | null;
  next_seq?: number | null;
  NEXT_ROW_SEQ?: number | null;
  next_row_seq?: number | null;
  CNT?: number | null;
}
