import type { SelectQueryBuilder } from 'typeorm';

/**
 * QueryBuilder 날짜 범위 필터 표준 헬퍼
 *
 * 원칙:
 * - 컬럼에 함수 미적용 → 인덱스 유지
 * - INTERVAL '1' DAY 사용 → DATE / TIMESTAMP 컬럼 모두 커버
 * - suffix 파라미터로 동일 QBuilder에서 여러 컬럼 사용 시 충돌 방지
 *
 * 사용 예:
 *   applyDateFilter(qb, 'log.inspectDate', fromDate, toDate);
 *   applyDateFilter(qb, 'jo.planDate', startDate, endDate, 'Plan');
 */
export function applyDateFilter<T>(
  qb: SelectQueryBuilder<T>,
  column: string,
  fromDate?: string | null,
  toDate?: string | null,
  suffix = '',
): void {
  if (fromDate) {
    const key = `dateFrom${suffix}`;
    qb.andWhere(`${column} >= TO_DATE(:${key}, 'YYYY-MM-DD')`, { [key]: fromDate });
  }
  if (toDate) {
    const key = `dateTo${suffix}`;
    qb.andWhere(`${column} < TO_DATE(:${key}, 'YYYY-MM-DD') + INTERVAL '1' DAY`, { [key]: toDate });
  }
}
