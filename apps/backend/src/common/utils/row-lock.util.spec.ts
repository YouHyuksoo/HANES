import { createMock } from '@golevelup/ts-jest';
import { QueryRunner } from 'typeorm';
import { buildLockSql, lockRowsForUpdate } from './row-lock.util';

describe('row-lock.util', () => {
  it('등호 조건을 바인드 순서대로 조립하고 FETCH FIRST 없이 FOR UPDATE 를 붙인다', () => {
    const { sql, params } = buildLockSql('PRODUCT_STOCKS', {
      WAREHOUSE_CODE: 'WH-DEFECT', ITEM_CODE: 'IT-1', QUALITY_STATUS: 'DEFECT', COMPANY: '40', PLANT_CD: '1000',
    });
    expect(sql).toBe(
      'SELECT 1 FROM PRODUCT_STOCKS WHERE WAREHOUSE_CODE = :1 AND ITEM_CODE = :2 AND QUALITY_STATUS = :3 AND COMPANY = :4 AND PLANT_CD = :5 FOR UPDATE',
    );
    expect(params).toEqual(['WH-DEFECT', 'IT-1', 'DEFECT', '40', '1000']);
    expect(sql).not.toMatch(/FETCH FIRST/);
  });

  it('BETWEEN 조건은 바인드 두 개를 쓰고, null/undefined 조건은 건너뛴다', () => {
    const from = new Date(2026, 8, 14);
    const to = new Date(2026, 8, 14, 23, 59, 59, 999);
    const { sql, params } = buildLockSql('REPAIR_ORDERS', {
      REPAIR_DATE: { between: [from, to] }, SEQ: 1, COMPANY: '40', PLANT_CD: undefined,
    });
    expect(sql).toBe('SELECT 1 FROM REPAIR_ORDERS WHERE REPAIR_DATE BETWEEN :1 AND :2 AND SEQ = :3 AND COMPANY = :4 FOR UPDATE');
    expect(params).toEqual([from, to, 1, '40']);
  });

  it('조건이 전부 비면 전체 테이블을 잠그지 않고 실패한다', () => {
    expect(() => buildLockSql('FG_LABELS', { FG_BARCODE: null })).toThrow(/잠금 조건이 비어/);
  });

  it('테이블명·컬럼명은 식별자 형식만 허용한다 (SQL 주입 차단)', () => {
    expect(() => buildLockSql('FG_LABELS; DROP', { FG_BARCODE: 'x' })).toThrow(/테이블명/);
    expect(() => buildLockSql('FG_LABELS', { 'FG_BARCODE OR 1=1': 'x' })).toThrow(/컬럼명/);
  });

  it('lockRowsForUpdate 는 raw query 로 잠그고 잠근 행 수를 돌려준다', async () => {
    const qr = createMock<QueryRunner>();
    qr.query.mockResolvedValue([{ 1: 1 }, { 1: 1 }]);
    const n = await lockRowsForUpdate(qr, 'MAT_LOTS', { MAT_UID: 'LOT1', COMPANY: 'C', PLANT_CD: 'P' });
    expect(n).toBe(2);
    expect(qr.query).toHaveBeenCalledWith(
      'SELECT 1 FROM MAT_LOTS WHERE MAT_UID = :1 AND COMPANY = :2 AND PLANT_CD = :3 FOR UPDATE',
      ['LOT1', 'C', 'P'],
    );
  });
});
