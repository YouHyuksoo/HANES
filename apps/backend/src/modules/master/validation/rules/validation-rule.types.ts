/**
 * @file src/modules/master/validation/rules/validation-rule.types.ts
 * @description 기준정보 검증 규칙 타입 정의
 */

/** 규칙 카테고리 */
/** TXN_INVARIANT: 트랜잭션 테이블 간 항상 성립해야 하는 등식(집계=원장 합계 등). 위반=코드 결함 신호 */
export const RULE_CATEGORIES = ['REF_INTEGRITY', 'INACTIVE_REF', 'DATA_QUALITY', 'BIZ_REVERSE_REF', 'TXN_INVARIANT'] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

/** 심각도 */
export const RULE_SEVERITIES = ['ERROR', 'WARN'] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

/**
 * 기준정보 검증 규칙 1건.
 * 규칙 추가는 해당 도메인 rules 파일에 1건 append로 끝낸다.
 */
export interface ValidationRule {
  /** '{CATEGORY}-{DOMAIN}-{NNN}' 형식, 전역 유일 */
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  /** 한글 규칙명 */
  title: string;
  /** 무엇이 문제이고 어떻게 고치는지 */
  description: string;
  /** 결과 행에서 이동할 마스터 화면 경로 */
  targetPath: string;
  /** 기본 true. false면 :company/:plantCd 바인드 생략 (비테넌트 테이블용) */
  tenantScoped?: boolean;
  /**
   * 오류 행만 반환하는 SELECT. 컨벤션:
   * - SELECT 첫 컬럼은 대표 키 `AS REF_KEY`
   * - tenantScoped 규칙은 COMPANY = :company AND PLANT_CD = :plantCd 조건 포함
   * - 조인 대상 마스터도 같은 tenant로 매칭
   */
  sql: string;
}
