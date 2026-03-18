/**
 * @file product-physical-inv.service.spec.ts
 * @description ProductPhysicalInvService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProductPhysicalInvService } from './product-physical-inv.service';
import { ProductStock } from '../../../entities/product-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProductPhysicalInvService', () => {
  let target: ProductPhysicalInvService;
  let mockStockRepo: DeepMocked<Repository<ProductStock>>;
  let mockAdjRepo: DeepMocked<Repository<InvAdjLog>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockWhRepo: DeepMocked<Repository<Warehouse>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockStockRepo = createMock<Repository<ProductStock>>();
    mockAdjRepo = createMock<Repository<InvAdjLog>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockWhRepo = createMock<Repository<Warehouse>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductPhysicalInvService,
        { provide: getRepositoryToken(ProductStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(InvAdjLog), useValue: mockAdjRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockLotRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWhRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ProductPhysicalInvService>(ProductPhysicalInvService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('applyCount', () => {
    it('should apply count and create adj log', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', qty: 100, reservedQty: 0, company: 'CO', plant: 'P01' } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.create.mockReturnValue({ diffQty: -10 } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ diffQty: -10 } as any);

      const r = await target.applyCount({
        items: [{ stockId: 'WH::IT::LOT1', countedQty: 90 }],
        createdBy: 'user',
      } as any);

      expect(r).toHaveLength(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when stock not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(target.applyCount({
        items: [{ stockId: 'WH::IT::LOT1', countedQty: 90 }],
        createdBy: 'user',
      } as any)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw on invalid stockId format', async () => {
      await expect(target.applyCount({
        items: [{ stockId: 'INVALID', countedQty: 90 }],
        createdBy: 'user',
      } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
