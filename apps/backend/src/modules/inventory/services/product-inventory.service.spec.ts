/**
 * @file product-inventory.service.spec.ts
 * @description ProductInventoryService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProductInventoryService } from './product-inventory.service';
import { ProductStock } from '../../../entities/product-stock.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProductInventoryService', () => {
  let target: ProductInventoryService;
  let mockTransRepo: DeepMocked<Repository<ProductTransaction>>;
  let mockStockRepo: DeepMocked<Repository<ProductStock>>;
  let mockWhRepo: DeepMocked<Repository<Warehouse>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockTransRepo = createMock<Repository<ProductTransaction>>();
    mockStockRepo = createMock<Repository<ProductStock>>();
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
        ProductInventoryService,
        { provide: getRepositoryToken(ProductTransaction), useValue: mockTransRepo },
        { provide: getRepositoryToken(ProductStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWhRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ProductInventoryService>(ProductInventoryService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('receiveStock', () => {
    it('should create transaction and new stock', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      const savedTrans = { transNo: 'PTX001' } as any;
      mockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      const r = await target.receiveStock({ warehouseId: 'WH', itemCode: 'IT', qty: 10, transType: 'WIP_IN' } as any);
      expect(r.transNo).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      mockTransRepo.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));
      await expect(target.receiveStock({ warehouseId: 'WH', itemCode: 'IT', qty: 10, transType: 'WIP_IN' } as any)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('cancelTransaction', () => {
    it('should throw NotFoundException when original not found', async () => {
      mockTransRepo.findOne.mockResolvedValue(null);
      await expect(target.cancelTransaction({ transactionId: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
    it('should throw BadRequestException when already canceled', async () => {
      mockTransRepo.findOne.mockResolvedValue({ transNo: 'PTX001', status: 'CANCELED' } as any);
      await expect(target.cancelTransaction({ transactionId: 'PTX001' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStock', () => {
    it('should return empty when no stocks', async () => {
      mockStockRepo.find.mockResolvedValue([]);
      const r = await target.getStock({} as any);
      expect(r).toEqual([]);
    });
  });
});
