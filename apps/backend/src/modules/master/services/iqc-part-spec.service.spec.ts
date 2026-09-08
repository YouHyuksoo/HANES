import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IqcPartSpec } from '../../../entities/iqc-part-spec.entity';
import { IqcPartSpecItem } from '../../../entities/iqc-part-spec-item.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { IqcPartSpecService } from './iqc-part-spec.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('IqcPartSpecService', () => {
  let target: IqcPartSpecService;
  let mockSpecRepo: DeepMocked<Repository<IqcPartSpec>>;
  let mockItemRepo: DeepMocked<Repository<IqcPartSpecItem>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockSpecRepo = createMock<Repository<IqcPartSpec>>();
    mockItemRepo = createMock<Repository<IqcPartSpecItem>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcPartSpecService,
        { provide: getRepositoryToken(IqcPartSpec), useValue: mockSpecRepo },
        { provide: getRepositoryToken(IqcPartSpecItem), useValue: mockItemRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IqcPartSpecService>(IqcPartSpecService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds an item spec only within the tenant context', async () => {
    await target.findByItemCode('ITEM-001', 'C1', 'P1');

    expect(mockSpecRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    }));
  });

  it('filters assigned items and usage before pagination with the same tenant and search in total', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ itemCode: 'RAW-20', inspectItemCount: 2 }])
      .mockResolvedValueOnce([{ total: 61 }]);
    (mockSpecRepo.manager as any).query = query;
    const result = await target.findPartChoices({ page: 2, limit: 50, useYn: 'Y', hasInspectItems: 'Y', search: 'wire' }, 'C1', 'P1');
    expect(result).toEqual({ data: [{ itemCode: 'RAW-20', inspectItemCount: 2 }], total: 61, page: 2, limit: 50 });
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain("p.COMPANY = :1 AND p.PLANT_CD = :2");
      expect(sql).toContain("i.USE_YN = 'Y') > 0");
      expect(sql).toContain('pool.COMPANY = i.COMPANY AND pool.PLANT_CD = i.PLANT_CD');
      expect(sql).toContain('p.USE_YN = :3');
      expect(sql).toContain('UPPER(p.ITEM_CODE) LIKE :4 OR UPPER(p.ITEM_NAME) LIKE :5');
      expect(params.slice(0, 5)).toEqual(['C1', 'P1', 'Y', '%WIRE%', '%WIRE%']);
    }
    expect(query.mock.calls[0][1].slice(-2)).toEqual([50, 50]);
  });

  it.each([['N', '= 0'], [undefined, undefined]])('supports unassigned or all items (%s)', async (hasInspectItems, predicate) => {
    const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    (mockSpecRepo.manager as any).query = query;
    await target.findPartChoices({ page: 1, limit: 50, hasInspectItems }, 'C2', 'P2');
    const countSql = query.mock.calls[1][0];
    expect(countSql).not.toContain('p.USE_YN =');
    if (predicate) expect(countSql).toContain(`i.USE_YN = 'Y') ${predicate}`);
    else expect(countSql).not.toContain('IQC_PART_SPEC_ITEMS');
    expect(query.mock.calls[1][1]).toEqual(['C2', 'P2']);
  });

  it('upserts and refreshes an item spec within the tenant context', async () => {
    const em = {
      findOne: jest.fn()
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' })
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', company: 'C1', plant: 'P1' }),
      create: jest.fn((_, value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockTx.run.mockImplementation(async (callback) => callback({ manager: em } as any));

    await target.upsert({
      itemCode: 'ITEM-001',
      sampleQty: 1,
      isDest: 'N',
      useYn: 'Y',
      items: [],
    }, 'C1', 'P1', 'user1');

    expect(em.findOne).toHaveBeenNthCalledWith(1, IqcPartSpec, {
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(em.delete).toHaveBeenCalledWith(IqcPartSpecItem, {
      itemCode: 'ITEM-001',
      company: 'C1',
      plant: 'P1',
    });
    expect(em.findOne).toHaveBeenNthCalledWith(2, IqcPartSpec, expect.objectContaining({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    }));
  });

  it('rejects AQL item rows when no active AQL standard exists for the level/value pair', async () => {
    const em = {
      findOne: jest.fn()
        .mockResolvedValueOnce(null),
      create: jest.fn((_, value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
    mockTx.run.mockImplementation(async (callback) => callback({ manager: em } as any));

    await expect(target.upsert({
      itemCode: 'ITEM-001',
      sampleQty: 1,
      isDest: 'N',
      useYn: 'Y',
      items: [{
        seq: 1,
        inspItemCode: 'IQC-DIM',
        defectGrade: 'MAJOR',
        inspectionLevel: 'S-2',
        aql: 0.015,
        inspectionType: 'AQL',
        sampleMethod: 'AQL',
        useYn: 'Y',
      }],
    }, 'C1', 'P1', 'user1')).rejects.toThrow('AQL 기준이 등록되지 않은 조합입니다: S-2 / 0.015');

    expect(em.delete).not.toHaveBeenCalledWith(IqcPartSpecItem, expect.anything());
  });

  it('resolveItems가 파괴검사 항목의 inspectionType/sampleQty를 반환한다', async () => {
    mockSpecRepo.findOne.mockResolvedValue({
      itemCode: 'CBL-A', items: [
        { seq: 1, useYn: 'Y', inspItemCode: 'IQC-PULL', inspItem: { inspItemName: '인장', judgeMethod: 'MEASURE', unit: 'N' },
          lsl: null, usl: null, judgeCriteria: null, defectGrade: 'MAJOR',
          inspectionLevel: null, aql: null, inspectionType: 'DESTRUCTIVE', sampleMethod: 'FIXED', sampleQty: 5 },
      ],
    } as any);
    const res = await target.resolveItems('CBL-A', '40', '1000');
    expect(res[0].inspectionType).toBe('DESTRUCTIVE');
    expect(res[0].sampleQty).toBe(5);
  });

  it('deletes an item spec only within the tenant context', async () => {
    const spec = { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as IqcPartSpec;
    mockSpecRepo.findOne.mockResolvedValue(spec);

    await target.delete('ITEM-001', 'C1', 'P1');

    expect(mockSpecRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(mockSpecRepo.remove).toHaveBeenCalledWith(spec);
  });
});
