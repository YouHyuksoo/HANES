/**
 * @file product-hold.service.spec.ts
 * @description ProductHoldService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProductHoldService } from './product-hold.service';
import { ProductStock } from '../../../entities/product-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProductHoldService', () => {
  let target: ProductHoldService;
  let mockStockRepo: DeepMocked<Repository<ProductStock>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockStockRepo = createMock<Repository<ProductStock>>();
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
        ProductHoldService,
        { provide: getRepositoryToken(ProductStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ProductHoldService>(ProductHoldService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('hold', () => {
    it('should hold normal stock', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', status: 'NORMAL', qty: 100 } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockStockRepo.findOne.mockResolvedValue({ ...stock, status: 'HOLD' });
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'IT', itemName: 'Item' } as any);

      const r = await target.hold({ stockId: 'WH::IT::LOT1', reason: 'QC hold' } as any);
      expect(r.status).toBe('HOLD');
    });

    it('should throw when already HOLD', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({ status: 'HOLD', qty: 10 } as any);
      await expect(target.hold({ stockId: 'WH::IT::LOT1', reason: 'test' } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw when stock not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(target.hold({ stockId: 'WH::IT::LOT1', reason: 'test' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw when qty is 0', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({ status: 'NORMAL', qty: 0 } as any);
      await expect(target.hold({ stockId: 'WH::IT::LOT1', reason: 'test' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('release', () => {
    it('should release HOLD stock', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', status: 'HOLD', qty: 100 } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockStockRepo.findOne.mockResolvedValue({ ...stock, status: 'NORMAL' });
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'IT', itemName: 'Item' } as any);

      const r = await target.release({ stockId: 'WH::IT::LOT1', reason: 'Released' } as any);
      expect(r.status).toBe('NORMAL');
    });

    it('should throw when not HOLD', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({ status: 'NORMAL' } as any);
      await expect(target.release({ stockId: 'WH::IT::LOT1', reason: 'test' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated data', async () => {
      mockStockRepo.find.mockResolvedValue([]);
      mockStockRepo.count.mockResolvedValue(0);
      const r = await target.findAll({} as any);
      expect(r.data).toEqual([]);
    });
  });

  describe('parseStockId', () => {
    it('should throw for invalid format', async () => {
      await expect(target.hold({ stockId: 'INVALID', reason: 'test' } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
