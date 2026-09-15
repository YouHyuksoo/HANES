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

/** 첨부파일 (문서·이미지) */
export interface NcrAttachment {
  ncrNo: string;
  seq: number;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  /** IMAGE=인쇄 양식에 사진으로 싣는다 / DOC=링크로만 노출 */
  kind: 'IMAGE' | 'DOC';
  remark: string | null;
  createdAt: string;
}

/** 저장 경로에서 정적 서빙 URL 을 만든다 (백엔드 main.ts 가 uploads 를 /uploads 로 서빙) */
export function attachmentUrl(filePath: string): string {
  const name = filePath.replace(/\\/g, '/').split('/').pop();
  return name ? `/uploads/ncr-attachments/${name}` : '';
}

/**
 * IQC 검사이력 1건을 가리키는 정본 출처 키.
 *
 * IQC_LOGS 의 PK 는 (INSPECT_DATE, SEQ) 인데 INSPECT_DATE 는 TIMESTAMP 라
 * 문자열 표현이 경로마다 다르다(UTC ISO / 밀리초 자릿수 / 오프셋 표기).
 * 문자열을 그대로 키로 쓰면 표현이 한 번만 달라져도 중복발행 차단이 조용히 풀린다.
 * 그래서 문자열이 아니라 **순간(instant)** 에서 파생한 값으로 만든다 —
 * 같은 시각이면 어떤 표현으로 와도 같은 키가 나온다.
 */
export function iqcSourceId(inspectDate: string, seq: number): string {
  const d = new Date(inspectDate);
  if (Number.isNaN(d.getTime())) return `${inspectDate}:${seq}`;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const ymd = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const hms = `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}`;
  return `${ymd}-${hms}:${seq}`;
}
