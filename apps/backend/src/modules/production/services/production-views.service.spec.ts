import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { BoxMaster } from '../../../entities/box-master.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { ProductionViewsService } from './production-views.service';

describe('ProductionViewsService', () => {
  let service: ProductionViewsService;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let inspectRepo: DeepMocked<Repository<InspectResult>>;
  let boxRepo: DeepMocked<Repository<BoxMaster>>;
  let stockRepo: DeepMocked<Repository<ProductStock>>;

  beforeEach(async () => {
    jobOrderRepo = createMock<Repository<JobOrder>>();
    inspectRepo = createMock<Repository<InspectResult>>();
    boxRepo = createMock<Repository<BoxMaster>>();
    stockRepo = createMock<Repository<ProductStock>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionViewsService,
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(InspectResult), useValue: inspectRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: boxRepo },
        { provide: getRepositoryToken(ProductStock), useValue: stockRepo },
        { provide: getRepositoryToken(FgLabel), useValue: createMock<Repository<FgLabel>>() },
        { provide: getRepositoryToken(SgLabel), useValue: createMock<Repository<SgLabel>>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get<ProductionViewsService>(ProductionViewsService);
  });

  it('applies tenant condition in getProgress shift join', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    jobOrderRepo.createQueryBuilder.mockReturnValue(qb as any);

    await service.getProgress({ page: 1, limit: 20, shift: 'DAY' } as any, 'C1', 'P1');

    expect(qb.innerJoin).toHaveBeenCalledWith(
      expect.anything(),
      'pr',
      expect.stringContaining('pr.COMPANY = :company'),
      { shift: 'DAY' },
    );
    expect(qb.innerJoin).toHaveBeenCalledWith(
      expect.anything(),
      'pr',
      expect.stringContaining('pr.PLANT_CD = :plant'),
      { shift: 'DAY' },
    );
  });

  it('applies tenant filter in getSampleInspect', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    inspectRepo.createQueryBuilder.mockReturnValue(qb as any);

    await service.getSampleInspect({ page: 1, limit: 10 } as any, 'C1', 'P1');

    expect(qb.andWhere).toHaveBeenCalledWith('pr.company = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('pr.plant = :plant', { plant: 'P1' });
  });

  it('uses query builder in getPackResult', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    boxRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await service.getPackResult({ page: 1, limit: 10 } as any, 'C1', 'P1');

    expect(result.total).toBe(0);
    expect(qb.leftJoin).toHaveBeenCalledWith(
      'ITEM_MASTERS',
      'im',
      'im.ITEM_CODE = bm.ITEM_CODE AND im.COMPANY = bm.COMPANY AND im.PLANT_CD = bm.PLANT_CD',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('bm.COMPANY = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('bm.PLANT_CD = :plant', { plant: 'P1' });
  });

  it('applies tenant filter in getWipStock', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    stockRepo.createQueryBuilder.mockReturnValue(qb as any);

    await service.getWipStock({ page: 1, limit: 10 } as any, 'C1', 'P1');

    expect(qb.leftJoin).toHaveBeenCalledWith(
      'ITEM_MASTERS',
      'im',
      'im.ITEM_CODE = s.ITEM_CODE AND im.COMPANY = s.COMPANY AND im.PLANT_CD = s.PLANT_CD',
    );
    expect(qb.leftJoin).toHaveBeenCalledWith(
      'WAREHOUSES',
      'wh',
      'wh.WAREHOUSE_CODE = s.WAREHOUSE_CODE AND wh.COMPANY = s.COMPANY AND wh.PLANT_CD = s.PLANT_CD',
    );
    expect(qb.where).toHaveBeenCalledWith('s.ITEM_TYPE IN (:...itemTypes)', {
      itemTypes: ['SEMI_PRODUCT', 'FINISHED'],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('s.COMPANY = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('s.PLANT_CD = :plant', { plant: 'P1' });
  });

  it('searches WIP stock by product stock and item master columns without entity relations', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getRawMany: jest.fn().mockResolvedValue([{ itemCode: 'HNS02', itemName: 'Harness' }]),
    };
    stockRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await service.getWipStock({ page: 1, limit: 10, itemType: 'FINISHED', search: 'hns' } as any, 'C1', 'P1');

    expect(result.total).toBe(1);
    expect(qb.where).toHaveBeenCalledWith('s.ITEM_TYPE IN (:...itemTypes)', {
      itemTypes: ['FINISHED'],
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(UPPER(s.ITEM_CODE) LIKE :searchUpper OR UPPER(im.ITEM_NAME) LIKE :searchUpper)',
      { searchUpper: '%HNS%' },
    );
    expect((qb as any).leftJoinAndSelect).toBeUndefined();
  });

  it('filters WIP stock by quality status when requested', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    stockRepo.createQueryBuilder.mockReturnValue(qb as any);

    await service.getWipStock({ page: 1, limit: 10, qualityStatus: 'DEFECT' } as any, 'C1', 'P1');

    expect(qb.select).toHaveBeenCalledWith(expect.arrayContaining([
      's.QUALITY_STATUS AS "qualityStatus"',
    ]));
    expect(qb.andWhere).toHaveBeenCalledWith('s.QUALITY_STATUS = :qualityStatus', { qualityStatus: 'DEFECT' });
  });
});
