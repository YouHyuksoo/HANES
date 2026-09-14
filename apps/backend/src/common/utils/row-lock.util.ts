/**
 * @file common/utils/row-lock.util.ts
 * @description Oracle 행 잠금 — TypeORM `findOne({ lock })` 우회
 *
 * 초보자 가이드:
 * 1. TypeORM 의 `findOne({ lock: { mode: 'pessimistic_write' } })` 는 자동으로 `take: 1` 을 붙여
 *    `... FETCH FIRST 1 ROWS ONLY FOR UPDATE` 를 생성한다. Oracle 은 이 조합을 거부한다(ORA-02014).
 * 2. 그래서 잠금은 raw `SELECT ... FOR UPDATE` 로 먼저 걸고, 조회는 lock 없는 `findOne` 으로 한다.
 *    (menu-favorites.service / continuity-inspect.service 가 쓰던 방식을 공용화한 것)
 * 3. `where` 의 키는 **DB 컬럼명**이다(엔티티 프로퍼티명이 아니다). 값이 `{ between: [from, to] }` 면
 *    BETWEEN 으로, `null`/`undefined` 면 조건에서 뺀다(테넌트 미지정 호출과 같은 의미).
 * 4. 트랜잭션(QueryRunner) 안에서만 의미가 있다 — 잠금은 그 트랜잭션이 끝날 때 풀린다.
 */
import { QueryRunner } from 'typeorm';

type LockValue = string | number | Date | null | undefined | { between: [Date | string | number, Date | string | number] };

/** `SELECT 1 FROM <table> WHERE ... FOR UPDATE` 를 실행해 조건에 맞는 행을 잠근다. 잠근 행 수를 돌려준다. */
export async function lockRowsForUpdate(
  qr: QueryRunner,
  table: string,
  where: Record<string, LockValue>,
): Promise<number> {
  const { sql, params } = buildLockSql(table, where);
  const rows: unknown = await qr.query(sql, params);
  return Array.isArray(rows) ? rows.length : 0;
}

/** SQL 조립만 분리 — 테스트와 로그용. */
export function buildLockSql(table: string, where: Record<string, LockValue>): { sql: string; params: unknown[] } {
  if (!/^[A-Z][A-Z0-9_]*$/.test(table)) throw new Error(`잠금 대상 테이블명이 올바르지 않습니다: ${table}`);
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of Object.entries(where)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(column)) throw new Error(`잠금 조건 컬럼명이 올바르지 않습니다: ${column}`);
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !(value instanceof Date) && 'between' in value) {
      params.push(value.between[0], value.between[1]);
      clauses.push(`${column} BETWEEN :${params.length - 1} AND :${params.length}`);
      continue;
    }
    params.push(value);
    clauses.push(`${column} = :${params.length}`);
  }
  if (clauses.length === 0) throw new Error(`잠금 조건이 비어 있습니다: ${table}`);
  return { sql: `SELECT 1 FROM ${table} WHERE ${clauses.join(' AND ')} FOR UPDATE`, params };
}
