/**
 * @file quality/ncr/types.ts
 * @description 부적합 보고서(NCR) 화면 타입
 */

export type NcrTargetType = 'RAW_MATERIAL' | 'SEMI_PRODUCT' | 'FINISHED' | 'WIP';
export type NcrFoundStage = 'IQC' | 'PROCESS' | 'FINAL' | 'OQC' | 'CUSTOMER';
export type NcrDisposition = 'CONCESSION' | 'REPAIR' | 'REWORK' | 'SCRAP' | 'RETURN';
export type NcrStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

/** 인쇄 양식에서 5종을 모두 찍기 위한 순서 고정 배열 */
export const NCR_DISPOSITION_CODES: NcrDisposition[] = ['CONCESSION', 'REPAIR', 'REWORK', 'SCRAP', 'RETURN'];

export const NCR_CAUSE_CATEGORIES = ['MAN', 'MACHINE', 'METHOD', 'MEASUREMENT', 'ENVIRONMENT'] as const;

export interface NcrReport {
  ncrNo: string;
  issuedAt: string;
  dueDate: string | null;
  issueDept: string | null;
  writerCode: string | null;

  targetType: NcrTargetType;
  foundStage: NcrFoundStage;
  sourceType: string | null;
  sourceId: string | null;

  itemCode: string;
  lotNo: string | null;
  serialNo: string | null;
  orderNo: string | null;
  poNo: string | null;
  vendorCode: string | null;
  inspectQty: number | null;
  defectQty: number | null;

  defectCode: string | null;
  categoryCode: string | null;
  defectGrade: string | null;
  description: string | null;
  imageUrl: string | null;

  disposition: NcrDisposition | null;
  dispositionDetail: string | null;
  dueActionDate: string | null;
  responsibleCode: string | null;

  causeCategory: string | null;
  rootCause: string | null;
  preventiveAction: string | null;

  approverCode: string | null;
  approvedAt: string | null;
  status: NcrStatus;
  closedAt: string | null;
  capaNo: string | null;
  remark: string | null;
}

/**
 * 대상구분별로 먼저 보여줄 처리방안.
 * 강제하지 않고 순서만 바꾼다 — 원자재인데 특채 같은 예외가 실제로 있다.
 */
export const DISPOSITION_PRIORITY: Record<NcrTargetType, NcrDisposition[]> = {
  RAW_MATERIAL: ['RETURN', 'CONCESSION', 'SCRAP', 'REWORK', 'REPAIR'],
  SEMI_PRODUCT: ['REWORK', 'REPAIR', 'SCRAP', 'CONCESSION', 'RETURN'],
  WIP: ['REWORK', 'REPAIR', 'SCRAP', 'CONCESSION', 'RETURN'],
  FINISHED: ['REWORK', 'SCRAP', 'REPAIR', 'CONCESSION', 'RETURN'],
};
