/**
 * @file material/iqc-history/iqcDetailTypes.ts
 * @description IQC_LOGS.DETAILS / ITEM_RESULTS JSON 파싱 타입과 safe parse 함수.
 *              IqcDetailModal(상세 조회)과 IqcReportPrintModal(성적서 인쇄)이 공유한다.
 */

/** ITEM_RESULTS JSON 원소 — 검사항목별 AQL 판정 */
export interface ItemJudgeEntry {
  seq?: number;
  inspItemCode?: string;
  defectGrade?: string | null;
  inspectionLevel?: string | null;
  aql?: number | null;
  defectCount?: number;
  acceptQty?: number | null;
  rejectQty?: number | null;
  result?: string;
  reason?: string;
  inspectionType?: string;
  requiredQty?: number | null;
  inspectedQty?: number | null;
}

/** DETAILS.serials[].items[] — 시리얼별 검사항목 측정값 */
export interface InspectionItem {
  itemId?: string;
  inspectItem: string;
  spec?: string | null;
  lsl?: number | null;
  usl?: number | null;
  unit?: string | null;
  measuredValue?: string;
  judge?: string;
}

/** DETAILS.serials[] — 시리얼 단위 검사 결과 */
export interface SerialEntry {
  matUid: string;
  qty?: number | null;
  result?: string;
  items?: InspectionItem[];
}

/** DETAILS JSON 루트 */
export interface DetailsPayload {
  type?: string;
  serials?: SerialEntry[];
}

/** 상세/성적서 모달이 받는 IQC 이력 레코드 (IQC_LOGS 평탄화 응답) */
export interface IqcDetailRecord {
  inspectDate: string;
  seq?: number;
  matUid?: string | null;
  arrivalNo?: string | null;
  itemCode?: string;
  itemName?: string | null;
  unit?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  inspectType?: string;
  inspectClass?: string | null;
  result?: string;
  inspectorName?: string | null;
  sampleBarcode?: string | null;
  remark?: string | null;
  details?: string | null;
  itemResults?: string | null;
  lotQty?: number | null;
  aqlInspectionLevel?: string | null;
  aqlInspectionMode?: string | null;
  aqlSampleQty?: number | null;
  aqlMajorCode?: string | null;
  aqlMajorAc?: number | null;
  aqlMajorRe?: number | null;
  aqlMinorCode?: string | null;
  aqlMinorAc?: number | null;
  aqlMinorRe?: number | null;
  defectCritical?: number | null;
  defectMajor?: number | null;
  defectMinor?: number | null;
  aqlJudgeReason?: string | null;
  retestRound?: number | null;
}

/** DETAILS JSON safe parse — 실패/비어있음이면 null */
export function parseIqcDetails(raw?: string | null): DetailsPayload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as DetailsPayload;
  } catch {
    return null;
  }
}

/** ITEM_RESULTS JSON safe parse — 배열이 아니거나 실패하면 빈 배열 */
export function parseIqcItemResults(raw?: string | null): ItemJudgeEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ItemJudgeEntry[]) : [];
  } catch {
    return [];
  }
}

/** sampleBarcode 콤마 구분 문자열 → 시리얼 배열 (details 없을 때 fallback) */
export function parseSampleBarcodes(raw?: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((b) => b.trim()).filter(Boolean);
}
