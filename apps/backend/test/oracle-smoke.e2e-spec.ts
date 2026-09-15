/**
 * @file test/oracle-smoke.e2e-spec.ts
 * @description 실 Oracle 스모크 — 단위 테스트(mock)로는 절대 드러나지 않는 부류를 잡는다.
 *
 * 왜 필요한가 (2026-09-14 실사례):
 * - `findOne({ lock })` 이 만드는 `FETCH FIRST + FOR UPDATE` 를 Oracle 이 거부(ORA-02014)해
 *   수리 기능이 한 번도 동작한 적이 없었다. 단위 테스트 2,650건은 전부 녹색이었다.
 * - `type: 'date'` 컬럼이 문자열로 하이드레이션되는데 `.toISOString()` 을 불러 출하 통계가 500 이었다.
 * 둘 다 "TypeORM 이 만든 SQL 을 Oracle 이 실제로 받는가 / 돌려준 값의 타입이 선언과 맞는가" 문제라
 * 실 DB 를 때려야만 드러난다.
 *
 * 실행 (기본 스킵 — 자격증명과 DB 접근이 필요하다):
 *   RUN_ORACLE_SMOKE=1 pnpm --dir apps/backend run test:e2e
 *
 * 안전성: 읽기 전용이다. 쓰기를 건드리는 검사는 트랜잭션을 열고 반드시 ROLLBACK 한다.
 */
import { DataSource, In } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { lockRowsForUpdate } from '../src/common/utils/row-lock.util';
import { toDateOnly } from '../src/common/utils/date-only.util';
import { MatStock } from '../src/entities/mat-stock.entity';
import { MatLot } from '../src/entities/mat-lot.entity';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const enabled = process.env.RUN_ORACLE_SMOKE === '1';
const describeOrSkip = enabled ? describe : describe.skip;

jest.setTimeout(180_000);

describeOrSkip('Oracle smoke (실 DB)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'oracle',
      host: process.env.ORACLE_HOST || 'localhost',
      port: parseInt(process.env.ORACLE_PORT || '1521', 10),
      username: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      serviceName: process.env.ORACLE_SERVICE_NAME,
      synchronize: false,
      logging: ['error'],
      entities: [path.resolve(__dirname, '../src/entities/*.entity{.ts,.js}')],
    });
    await ds.initialize();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('모든 엔티티가 실제 스키마에 대해 조회된다 — 매핑/타입 불일치를 잡는다', async () => {
    const failures: string[] = [];
    for (const meta of ds.entityMetadatas) {
      try {
        await ds.getRepository(meta.target).find({ take: 1 });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${meta.tableName} (${meta.name}): ${message.split('\n')[0]}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("type:'date' 컬럼 하이드레이션 값을 toDateOnly 가 전부 처리한다", async () => {
    const dateColumns = ds.entityMetadatas.flatMap((meta) =>
      meta.columns
        .filter((column) => column.type === 'date')
        .map((column) => ({ meta, property: column.propertyName })),
    );
    expect(dateColumns.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const { meta, property } of dateColumns) {
      const [row] = await ds.getRepository(meta.target).find({ take: 1, where: {} as never });
      if (!row) continue;
      const value = (row as Record<string, unknown>)[property];
      if (value === null || value === undefined) continue;

      // 선언은 Date 지만 Oracle 은 문자열로 돌려준다. 어느 쪽이든 toDateOnly 가 YYYY-MM-DD 를 만들어야 한다.
      const converted = toDateOnly(value as Date | string);
      if (converted === null || !/^\d{4}-\d{2}-\d{2}$/.test(converted)) {
        failures.push(`${meta.tableName}.${property}: typeof=${typeof value} value=${String(value)} → ${converted}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('행 잠금이 Oracle 에서 실제로 걸린다 (ORA-02014 회귀 방지)', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // 조건에 맞는 행이 없어도 SQL 이 거부되지 않아야 한다 — 우리가 잡는 것은 구문 거부다.
      await expect(
        lockRowsForUpdate(qr, 'REPAIR_ORDERS', { SEQ: -1, COMPANY: '__none__' }),
      ).resolves.toBeDefined();

      // 비교 대조: 옛 방식(findOne + lock)은 같은 조건에서 ORA-02014 로 거부된다.
      await expect(
        qr.query("SELECT SEQ FROM REPAIR_ORDERS WHERE SEQ = -1 FETCH FIRST 1 ROWS ONLY FOR UPDATE"),
      ).rejects.toThrow(/ORA-02014/);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('출고가능 재고 조회가 LOT 조인 + recvDate 정렬 + 페이징을 실 Oracle 에서 실행한다', async () => {
    // MatStockService.findAvailable 이 만드는 쿼리와 같은 모양이다. leftJoin + skip/take 조합은
    // TypeORM 의 "distinctAlias" 두-단계 페이징 래퍼를 태우는데, 이 래퍼는 조인 컬럼
    // (lot.recvDate) 정렬을 내부 서브쿼리의 select alias 로 요구해 실제 Oracle 에서
    // ORA-00904("distinctAlias"."lot_RECV_DATE": 부적합한 식별자)로 거부됐다(2026-09-15 실측).
    // offset/limit 은 그 래퍼를 타지 않는다 — 이 테스트는 그 회귀를 잡는다.
    const rows = await ds
      .getRepository(MatStock)
      .createQueryBuilder('stock')
      .leftJoin(MatLot, 'lot', 'lot.matUid = stock.matUid')
      .where('stock.qty > 0')
      .orderBy('lot.recvDate', 'ASC', 'NULLS LAST')
      .addOrderBy('COALESCE(lot.origin, stock.matUid)', 'ASC')
      .addOrderBy('stock.matUid', 'ASC')
      .offset(0)
      .limit(5)
      .getMany();

    expect(Array.isArray(rows)).toBe(true);

    // 정렬이 실제로 걸렸는지, joined recvDate 기준으로 비내림(non-decreasing)인지 검증한다.
    const matUids = rows.map((row) => row.matUid).filter(Boolean) as string[];
    const lots = matUids.length > 0 ? await ds.getRepository(MatLot).find({ where: { matUid: In(matUids) } }) : [];
    const lotMap = new Map(lots.map((lot) => [lot.matUid, lot]));
    const recvDates = rows
      .map((row) => lotMap.get(row.matUid)?.recvDate)
      .filter((recvDate): recvDate is Date | string => recvDate !== null && recvDate !== undefined);

    for (let i = 1; i < recvDates.length; i++) {
      const prev = new Date(recvDates[i - 1]).getTime();
      const curr = new Date(recvDates[i]).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  // MatStockService.findAvailable 이 FIFO_CRITERIA 에 따라 두 날짜 컬럼 중 하나로 정렬한다.
  // COALESCE 식은 alias.property 꼴이 아니라 TypeORM 이 원문으로 내보내므로, 식별자 인용이
  // 어긋나면 ORA-00904 로 거부된다. 두 기준 모두 실 Oracle 에서 실행되는지 본다.
  it.each([
    ['RECEIVE_DATE', 'lot.recvDate'],
    ['MFG_DATE', 'lot.manufactureDate'],
  ])('FIFO_CRITERIA=%s 정렬(%s + COALESCE 계보 키)이 실 Oracle 에서 실행된다', async (_criteria, dateColumn) => {
    const rows = await ds
      .getRepository(MatStock)
      .createQueryBuilder('stock')
      .leftJoin(MatLot, 'lot', 'lot.matUid = stock.matUid')
      .where('stock.qty > 0')
      .orderBy(dateColumn, 'ASC', 'NULLS LAST')
      .addOrderBy('COALESCE(lot.origin, stock.matUid)', 'ASC')
      .addOrderBy('stock.matUid', 'ASC')
      .offset(0)
      .limit(5)
      .getMany();

    expect(Array.isArray(rows)).toBe(true);
  });

  it('분할 자식 LOT 이 부모 슬롯(ORIGIN)으로 정렬돼 들어온다 — finding #6 회귀', async () => {
    // 분할 계보가 실제로 있는 품목을 먼저 찾는다. 계보가 없는 품목으로 정렬을 단언하면
    // 늘 참이라 아무것도 증명하지 못한다. 데이터가 사라지면 이 기대에서 먼저 실패해야 한다.
    const lineage: { ITEM_CODE: string }[] = await ds.query(
      `SELECT l."ITEM_CODE" AS "ITEM_CODE"
         FROM "MAT_LOTS" l JOIN "MAT_STOCKS" s ON s."MAT_UID" = l."MAT_UID"
        WHERE s."QTY" > 0 AND l."ORIGIN" IS NOT NULL AND l."ORIGIN" <> l."MAT_UID"
        GROUP BY l."ITEM_CODE"
       HAVING COUNT(DISTINCT l."ORIGIN") >= 2
        ORDER BY COUNT(*) DESC FETCH FIRST 1 ROWS ONLY`,
    );
    expect(lineage.length).toBe(1);
    const itemCode = lineage[0].ITEM_CODE;

    const rows = await ds
      .getRepository(MatStock)
      .createQueryBuilder('stock')
      .leftJoin(MatLot, 'lot', 'lot.matUid = stock.matUid')
      .where('stock.qty > 0')
      .andWhere('stock.itemCode = :itemCode', { itemCode })
      .orderBy('lot.recvDate', 'ASC', 'NULLS LAST')
      .addOrderBy('COALESCE(lot.origin, stock.matUid)', 'ASC')
      .addOrderBy('stock.matUid', 'ASC')
      .offset(0)
      .limit(100)
      .getMany();
    expect(rows.length).toBeGreaterThan(1);

    const matUids = rows.map((row) => row.matUid).filter(Boolean) as string[];
    const lots = await ds.getRepository(MatLot).find({ where: { matUid: In(matUids) } });
    const lotMap = new Map(lots.map((lot) => [lot.matUid, lot]));
    const keys = rows.map((row) => {
      const lot = lotMap.get(row.matUid as string);
      return {
        recvDay: lot?.recvDate ? String(lot.recvDate).slice(0, 10) : '￿',
        origin: lot?.origin || (row.matUid as string),
      };
    });
    // 같은 자식이 여럿 섞여 있어야 finding #6 을 실제로 덮는다.
    expect(new Set(keys.map((key) => key.origin)).size).toBeLessThan(keys.length);

    // (입고일, ORIGIN) 이 비내림차순이면 계보가 흩어지지 않고 부모 슬롯에 모여 있다는 뜻이다.
    for (let i = 1; i < keys.length; i++) {
      const prev = `${keys[i - 1].recvDay}|${keys[i - 1].origin}`;
      const curr = `${keys[i].recvDay}|${keys[i].origin}`;
      expect(curr >= prev).toBe(true);
    }
  });
});
