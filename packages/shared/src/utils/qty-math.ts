/**
 * @file packages/shared/src/utils/qty-math.ts
 * @description 수량 산술 공통 규칙 — BOM 소요량 곱셈·재고 비교의 부동소수점 오차를 한 곳에서 흡수한다.
 *
 * 배경(2026-09-09 결함 17): 870 × 0.67 = 582.9000000000001 로 계산되어 장착 잔량 582.9 보다 크다고 판단,
 * 지시수량에 맞춰 출고한 자재를 끝까지 못 쓰고 "공정재고 부족" 으로 마지막 실적이 막혔다.
 * 소요량(qtyPer)이 소수인 자재(전선 M, 테이프·튜브 MM 등)는 모두 같은 위험이 있으므로
 * 곱셈은 mulQty, 비교는 ltQty/gtQty, 반올림은 roundQty 만 쓴다.
 */

/** 수량 소수 자릿수(6) — DB NUMBER 스케일보다 넉넉하고 float 오차(1e-13)는 흡수한다. */
export const QTY_SCALE = 6;

/** 수량을 QTY_SCALE 자리로 반올림한다. NaN/Infinity 는 0. */
export function roundQty(value: number, scale: number = QTY_SCALE): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

/** a × b 를 수량 규칙으로 반올림해 돌려준다(BOM 소요량 계산 전용). */
export function mulQty(a: number, b: number): number {
  return roundQty(Number(a) * Number(b));
}

/** a < b (수량 반올림 후 비교) — 재고 부족 판정에 사용. */
export function ltQty(a: number, b: number): boolean {
  return roundQty(a) < roundQty(b);
}

/** a > b (수량 반올림 후 비교). */
export function gtQty(a: number, b: number): boolean {
  return roundQty(a) > roundQty(b);
}

/** 올림 소요량 — Math.ceil(870.0000000001) = 871 같은 과대 계산을 막기 위해 반올림 후 올림한다. */
export function ceilQty(value: number): number {
  return Math.ceil(roundQty(value));
}
