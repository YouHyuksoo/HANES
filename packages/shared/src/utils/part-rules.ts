/**
 * @file packages/shared/src/utils/part-rules.ts
 * @description 품목마스터 공통 업무 규칙
 */

export const IQC_NO_INSPECTION_METHOD_VALUES = ['SKIP', 'NONE'] as const;
export type IqcNoInspectionMethodValue = typeof IQC_NO_INSPECTION_METHOD_VALUES[number];

export function isIqcNoInspectionMethod(inspectMethod?: string | null): boolean {
  const method = (inspectMethod ?? '').trim().toUpperCase();
  return IQC_NO_INSPECTION_METHOD_VALUES.includes(method as IqcNoInspectionMethodValue);
}

export function requiresIqcAqlPolicy(iqcYn?: string | null, inspectMethod?: string | null): boolean {
  const isIqcTarget = (iqcYn ?? 'Y').trim().toUpperCase() === 'Y';
  return isIqcTarget && !isIqcNoInspectionMethod(inspectMethod);
}
