/**
 * @file src/modules/inventory/rules/product-storage.rules.ts
 * @description 제품재고 장기보관 판정 순수 규칙 — DB/서비스 의존 없음
 *
 * 초보자 가이드:
 * 1. 기산점은 제품라벨 발행일(FG_LABELS.ISSUED_AT = 생산 시점)이다.
 *    PRODUCT_STOCKS 는 품목×창고 집계행이라 현물 단위 체류일이 없고,
 *    PRODUCT_TRANSACTIONS.FG_IN 은 데이터가 사실상 없어 기산점으로 쓰지 않는다.
 * 2. 기준일수는 sys-config LONG_STOCK_DAYS(기본 90), 표시 여부는 LONG_STOCK_CHECK 가 정한다.
 * 3. 자재 유효기간(calcLotExpireDate)과는 다른 개념이다. 만료가 아니라 임계 체류일 비교다.
 * 4. 날짜 비교는 로컬 날짜 키(YYYY-MM-DD)로 한다. toISOString 은 UTC 라서 KST 오전에 전날이 되므로 쓰지 않는다.
 */

import { toDayKey, FifoDateValue } from '../../material/rules/fifo.rules';

/** LONG_STOCK_DAYS 미설정·비정상값일 때 쓰는 기본 기준일수 */
export const LONG_STOCK_DEFAULT_DAYS = 90;

/** 하루를 밀리초로 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 로컬 날짜 키를 자정 Date 로 되돌린다 */
function toLocalMidnight(value: FifoDateValue): Date | null {
  const key = toDayKey(value);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * 보관 경과일 — 제품라벨 발행일부터 오늘까지의 일수.
 * 발행일이 없으면 null, 미래 발행일은 0(음수 경과일을 만들지 않는다).
 */
export function calcStorageDays(issuedAt: FifoDateValue, today: Date): number | null {
  const base = toLocalMidnight(issuedAt);
  const todayMidnight = toLocalMidnight(today);
  if (!base || !todayMidnight) return null;
  const days = Math.round((todayMidnight.getTime() - base.getTime()) / DAY_MS);
  return days < 0 ? 0 : days;
}

/** sys-config LONG_STOCK_DAYS 문자열을 기준일수로. 비정상값이면 기본 90 */
export function resolveLongStockDays(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return LONG_STOCK_DEFAULT_DAYS;
  return parsed;
}

/** 장기보관 여부 — 경과일이 기준일수를 넘기면(초과) true. 발행일이 없으면 판정하지 않는다 */
export function isLongStored(issuedAt: FifoDateValue, thresholdDays: number, today: Date): boolean {
  const days = calcStorageDays(issuedAt, today);
  if (days === null) return false;
  return days > resolveLongStockDays(thresholdDays);
}
