/**
 * @file common/utils/mat-stock-upsert.util.spec.ts
 * @description addMatStockQty — 먼저 상대 UPDATE, 0행이면 INSERT, 유니크 위반이면 다시 UPDATE
 */
import { EntityManager } from 'typeorm';
import { MatStock } from '../../entities/mat-stock.entity';
import { addMatStockQty, isUniqueViolation, AddMatStockOptions } from './mat-stock-upsert.util';

describe('mat-stock-upsert.util', () => {
  let qb: { update: jest.Mock; set: jest.Mock; where: jest.Mock; setParameters: jest.Mock; execute: jest.Mock };
  let manager: { createQueryBuilder: jest.Mock; insert: jest.Mock };
  const key = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' };

  beforeEach(() => {
    qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager = { createQueryBuilder: jest.fn().mockReturnValue(qb), insert: jest.fn().mockResolvedValue(undefined) };
  });

  const run = (delta: number, options?: AddMatStockOptions) =>
    addMatStockQty(manager as unknown as EntityManager, key, delta, options);

  it('기존 행이 있으면 상대 UPDATE 만 하고 INSERT 하지 않는다', async () => {
    await expect(run(5)).resolves.toBe('UPDATED');
    expect(qb.update).toHaveBeenCalledWith(MatStock);
    expect(qb.where).toHaveBeenCalledWith(expect.objectContaining({ warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' }));
    expect(qb.setParameters).toHaveBeenCalledWith({ stockDelta: 5 });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('UPDATE 가 0행이면 INSERT 한다', async () => {
    qb.execute.mockResolvedValueOnce({ affected: 0 });
    await expect(run(5, { locationCode: 'LOC-1' })).resolves.toBe('INSERTED');
    expect(manager.insert).toHaveBeenCalledWith(MatStock, expect.objectContaining({
      warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 5, availableQty: 5, reservedQty: 0, locationCode: 'LOC-1', company: 'C1', plant: 'P1',
    }));
  });

  it('동시 INSERT 로 유니크 위반이면 다시 UPDATE 한다', async () => {
    qb.execute.mockResolvedValueOnce({ affected: 0 }).mockResolvedValueOnce({ affected: 1 });
    manager.insert.mockRejectedValueOnce(Object.assign(new Error('x'), { errorNum: 1 }));
    await expect(run(5)).resolves.toBe('UPDATED');
    expect(qb.execute).toHaveBeenCalledTimes(2);
  });

  it('유니크 위반이 아닌 오류는 그대로 던진다', async () => {
    qb.execute.mockResolvedValueOnce({ affected: 0 });
    manager.insert.mockRejectedValueOnce(new Error('ORA-12899: value too large'));
    await expect(run(5)).rejects.toThrow('ORA-12899');
    expect(qb.execute).toHaveBeenCalledTimes(1);
  });

  it('유니크 위반 뒤에도 UPDATE 가 0행이면 원래 오류를 던진다', async () => {
    qb.execute.mockResolvedValue({ affected: 0 });
    manager.insert.mockRejectedValueOnce(new Error('ORA-00001: unique constraint'));
    await expect(run(5)).rejects.toThrow('ORA-00001');
  });

  it('양수가 아니면 거절한다', async () => {
    await expect(run(0)).rejects.toThrow('양수');
    await expect(run(-1)).rejects.toThrow('양수');
  });

  it('isUniqueViolation 은 errorNum·code·메시지로 판별한다', () => {
    expect(isUniqueViolation({ errorNum: 1 })).toBe(true);
    expect(isUniqueViolation({ code: 'ORA-00001' })).toBe(true);
    expect(isUniqueViolation(new Error('ORA-00001: x'))).toBe(true);
    expect(isUniqueViolation(new Error('other'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
