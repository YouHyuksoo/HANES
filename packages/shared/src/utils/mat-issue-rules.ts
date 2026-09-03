/**
 * @file packages/shared/src/utils/mat-issue-rules.ts
 * @description 자재출고 공통 업무 규칙
 */

/** 생산(양산) 출고로 취급하는 ISSUE_TYPE 값. 생산 출고는 반드시 공정재고(PROC_MAT_STOCKS)로 적재된다(ADR 0002). */
export const PRODUCTION_ISSUE_TYPE_VALUES = ['PROD', 'PRODUCTION'] as const;
export type ProductionIssueTypeValue = typeof PRODUCTION_ISSUE_TYPE_VALUES[number];

export function isProductionIssueType(issueType?: string | null): boolean {
  const value = (issueType ?? '').trim().toUpperCase();
  return PRODUCTION_ISSUE_TYPE_VALUES.includes(value as ProductionIssueTypeValue);
}
