/**
 * @file packages/shared/src/utils/routing-material-rules.ts
 * @description 라우팅 공정별 자재 투입수량 규칙 — 소비(auto-issue, subprocess-kitting)와 화면(라우팅 편집)이 함께 쓴다.
 *
 * 배경: BOM 소요량은 제품 1개 기준 총량이다(예: 터미널 2개 = 좌·우 끝단).
 *       한 공정에서 한쪽만 작업하는 라우팅이면 그 공정은 1개만 소비해야 하므로,
 *       공정 배정(ROUTING_MATERIALS.ALLOC_QTY)에 투입수량이 있으면 그 값을 우선한다.
 */

/**
 * 공정에서 실제 차감할 제품 1개당 소요량.
 * - allocQty > 0 → 공정 배정 투입수량
 * - 그 외(0/미설정) → BOM 소요량 (기존 동작 유지)
 */
export function resolveRoutingConsumeQty(bomQtyPer: number | string | null | undefined, allocQty?: number | string | null): number {
  const alloc = Number(allocQty ?? 0);
  if (Number.isFinite(alloc) && alloc > 0) return alloc;
  const bom = Number(bomQtyPer ?? 0);
  return Number.isFinite(bom) ? bom : 0;
}

/**
 * 같은 자재를 여러 공정에 나눠 배정했을 때, 공정별 투입수량 합계와 BOM 소요량의 관계.
 * - 'match'  : 합계 = BOM (정상)
 * - 'under'  : 합계 < BOM (일부 공정에서 소비 누락 가능)
 * - 'over'   : 합계 > BOM (과다 소비)
 * - 'bomOnly': 배정 전부가 0(미설정)이라 각 공정이 BOM 전량을 소비 — 여러 공정 배정이면 과다 소비
 */
export type AllocSumStatus = 'match' | 'under' | 'over' | 'bomOnly';

export function evaluateAllocSum(bomQtyPer: number, allocQtys: Array<number | null | undefined>): { sum: number; status: AllocSumStatus } {
  const positives = allocQtys.map((a) => Number(a ?? 0)).filter((a) => Number.isFinite(a) && a > 0);
  if (positives.length === 0) return { sum: 0, status: 'bomOnly' };
  const sum = Math.round(positives.reduce((s, a) => s + a, 0) * 10000) / 10000;
  const bom = Number(bomQtyPer ?? 0);
  if (Math.abs(sum - bom) < 1e-9) return { sum, status: 'match' };
  return { sum, status: sum < bom ? 'under' : 'over' };
}
