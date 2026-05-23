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
import { TransactionService } from '../../../shared/transaction.service';

describe('ProductInventoryService', () => {
  let target: ProductInventoryService;
  let mockTransRepo: DeepMocked<Repository<ProductTransaction>>;
  let mockStockRepo: DeepMocked<Repository<ProductStock>>;
  let mockWhRepo: DeepMocked<Repository<Warehouse>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockTransRepo = createMock<Repository<ProductTransaction>>();
    mockStockRepo = createMock<Repository<ProductStock>>();
    mockWhRepo = createMock<Repository<Warehouse>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockTx = createMock<TransactionService>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
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
        { provide: TransactionService, useValue: mockTx },
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
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      mockTransRepo.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));
      await expect(target.receiveStock({ warehouseId: 'WH', itemCode: 'IT', qty: 10, transType: 'WIP_IN' } as any)).rejects.toThrow('DB error');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should update existing stock within dto tenant only', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      mockTransRepo.create.mockReturnValue({ transNo: 'PTX001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ transNo: 'PTX001' } as any);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH',
        itemCode: 'IT',
        prdUid: 'LOT1',
        qty: 20,
        reservedQty: 5,
        company: 'C1',
        plant: 'P1',
      } as any);

      await target.receiveStock({
        warehouseId: 'WH',
        itemCode: 'IT',
        prdUid: 'LOT1',
        qty: 10,
        transType: 'WIP_IN',
        company: 'C1',
        plant: 'P1',
      } as any);

      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(ProductStock, {
        where: { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        ProductStock,
        { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 30, availableQty: 25 }),
      );
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

    it('should cancel transaction and restore stock within original tenant only', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      mockTransRepo.findOne.mockResolvedValue({
        transNo: 'PTX001',
        transType: 'FG_OUT',
        status: 'DONE',
        fromWarehouseId: 'WH',
        itemCode: 'FG',
        itemType: 'FINISHED',
        prdUid: 'LOT1',
        qty: -10,
        company: 'C1',
        plant: 'P1',
      } as any);
      mockTransRepo.create.mockReturnValue({ transNo: 'PTX002' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ transNo: 'PTX002' } as any);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH',
        itemCode: 'FG',
        prdUid: 'LOT1',
        qty: 20,
        availableQty: 20,
        company: 'C1',
        plant: 'P1',
      } as any);

      await target.cancelTransaction({ transactionId: 'PTX001' } as any, 'C1', 'P1');

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        ProductTransaction,
        { transNo: 'PTX001', company: 'C1', plant: 'P1' },
        { status: 'CANCELED' },
      );
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(ProductStock, {
        where: { warehouseCode: 'WH', itemCode: 'FG', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        ProductStock,
        { warehouseCode: 'WH', itemCode: 'FG', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 30, availableQty: 30 }),
      );
    });
  });

  describe('issueStock', () => {
    it('should throw when source stock is HOLD', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      mockQueryRunner.manager.findOne.mockResolvedValue({ status: 'HOLD', availableQty: 100 } as any);

      await expect(target.issueStock({
        warehouseId: 'WH',
        itemCode: 'IT',
        qty: 10,
        transType: 'WIP_OUT',
      } as any)).rejects.toThrow(BadRequestException);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should move stock within dto tenant only', async () => {
      const qb: any = { where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb);
      mockTransRepo.create.mockReturnValue({ transNo: 'PTX001' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ transNo: 'PTX001' } as any);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({
          warehouseCode: 'WH-FROM',
          itemCode: 'IT',
          prdUid: 'LOT1',
          qty: 50,
          availableQty: 50,
          reservedQty: 0,
          company: 'C1',
          plant: 'P1',
        } as any)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-TO',
          itemCode: 'IT',
          prdUid: 'LOT1',
          qty: 5,
          availableQty: 5,
          reservedQty: 0,
          company: 'C1',
          plant: 'P1',
        } as any);

      await target.issueStock({
        warehouseId: 'WH-FROM',
        toWarehouseId: 'WH-TO',
        itemCode: 'IT',
        prdUid: 'LOT1',
        qty: 10,
        transType: 'WIP_OUT',
        company: 'C1',
        plant: 'P1',
      } as any);

      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(1, ProductStock, {
        where: { warehouseCode: 'WH-FROM', itemCode: 'IT', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        ProductStock,
        { warehouseCode: 'WH-FROM', itemCode: 'IT', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 40, availableQty: 40 }),
      );
      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(2, ProductStock, {
        where: { warehouseCode: 'WH-TO', itemCode: 'IT', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        ProductStock,
        { warehouseCode: 'WH-TO', itemCode: 'IT', prdUid: 'LOT1', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 15, availableQty: 15 }),
      );
    });
  });

  describe('getStock', () => {
    it('should return empty when no stocks', async () => {
      mockStockRepo.find.mockResolvedValue([]);
      const r = await target.getStock({} as any);
      expect(r).toEqual([]);
    });

    it('제품 현재고 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockStockRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-01', itemCode: 'FG-001', itemType: 'FG', prdUid: 'FGUID-001', qty: 10, reservedQty: 0, availableQty: 10, company: 'C1', plant: 'P1' } as ProductStock,
      ]);
      mockWhRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.getStock({} as any, 'C1', 'P1');

      expect(mockWhRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
        select: ['warehouseCode', 'warehouseName', 'warehouseType'],
      });
      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
        select: ['itemCode', 'itemName', 'itemType', 'unit'],
      });
    });
  });

  describe('getTransactions', () => {
    it('제품 수불 이력 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { transNo: 'PTX-001', itemCode: 'FG-001', fromWarehouseId: 'WH-01', toWarehouseId: 'WH-02', company: 'C1', plant: 'P1' } as ProductTransaction,
        ]),
      };
      mockTransRepo.createQueryBuilder.mockReturnValue(qb as any);
      mockWhRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.getTransactions({} as any, 'C1', 'P1');

      expect(mockWhRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });
});
