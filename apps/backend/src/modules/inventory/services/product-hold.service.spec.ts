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
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ProductHoldService', () => {
  let target: ProductHoldService;
  let mockStockRepo: DeepMocked<Repository<ProductStock>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockStockRepo = createMock<Repository<ProductStock>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
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
        ProductHoldService,
        { provide: getRepositoryToken(ProductStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
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
      mockStockRepo.findOne.mockResolvedValue({ ...stock, status: 'HOLD', company: 'CO', plant: 'P01' });
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'IT', itemName: 'Item' } as any);

      // PRODUCT_STOCKS PRD_UID 비키화(커밋 78d46411): stockId는 2-part(wh::item), 키 조회에 prdUid 미포함
      const r = await target.hold({ stockId: 'WH::IT', reason: 'QC hold' } as any, 'CO', 'P01', 'user');
      expect(r.status).toBe('HOLD');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(ProductStock, {
        where: { warehouseCode: 'WH', itemCode: 'IT', company: 'CO', plant: 'P01' },
      });
      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'IT', company: 'CO', plant: 'P01' },
      });
    });

    it('품목 마스터가 누락되어도 HOLD 결과의 제품재고 원본 itemCode는 유지한다', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'ITEM-MISSING', prdUid: 'FG-001', status: 'NORMAL', qty: 100 } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockStockRepo.findOne.mockResolvedValue({ ...stock, status: 'HOLD' });
      mockPartRepo.findOne.mockResolvedValue(null);

      const result = await target.hold({ stockId: 'WH::ITEM-MISSING::FG-001', reason: 'QC hold' } as any);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'HOLD',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
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
      mockStockRepo.findOne.mockResolvedValue({ ...stock, status: 'NORMAL', company: 'CO', plant: 'P01' });
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'IT', itemName: 'Item' } as any);

      const r = await target.release({ stockId: 'WH::IT', reason: 'Released' } as any, 'CO', 'P01', 'user');
      expect(r.status).toBe('NORMAL');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(ProductStock, {
        where: { warehouseCode: 'WH', itemCode: 'IT', company: 'CO', plant: 'P01' },
      });
      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'IT', company: 'CO', plant: 'P01' },
      });
    });

    it('품목 마스터가 누락되어도 HOLD 해제 결과의 제품재고 원본 itemCode는 유지한다', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'ITEM-MISSING', prdUid: 'FG-001', status: 'HOLD', qty: 100 } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockStockRepo.findOne.mockResolvedValue({ ...stock, status: 'NORMAL' });
      mockPartRepo.findOne.mockResolvedValue(null);

      const result = await target.release({ stockId: 'WH::ITEM-MISSING::FG-001', reason: 'Released' } as any);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'NORMAL',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
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

    it('품목 마스터가 누락되어도 제품재고 원본 itemCode와 prdUid는 유지한다', async () => {
      mockStockRepo.find.mockResolvedValue([
        {
          warehouseCode: 'WH',
          itemCode: 'ITEM-MISSING',
          prdUid: 'FG-001',
          itemType: 'FINISHED',
          qty: 100,
          status: 'HOLD',
        } as ProductStock,
      ]);
      mockStockRepo.count.mockResolvedValue(1);
      mockPartRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          warehouseCode: 'WH',
          itemCode: 'ITEM-MISSING',
          prdUid: 'FG-001',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('화면에서 보류/해제 stockId로 사용할 복합 id를 포함한다', async () => {
      mockStockRepo.find.mockResolvedValue([
        {
          warehouseCode: 'FG-WH',
          itemCode: 'ITEM-001',
          prdUid: 'FG-001',
          itemType: 'FINISHED',
          qty: 10,
          status: 'NORMAL',
        } as ProductStock,
      ]);
      mockStockRepo.count.mockResolvedValue(1);
      mockPartRepo.find.mockResolvedValue([]);

      const result = await target.findAll({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 'FG-WH::ITEM-001',
        }),
      );
    });

    it('제품 HOLD 목록 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      mockStockRepo.find.mockResolvedValue([
        {
          warehouseCode: 'WH',
          itemCode: 'ITEM-001',
          prdUid: 'FG-001',
          itemType: 'FINISHED',
          qty: 100,
          status: 'HOLD',
          company: 'C1',
          plant: 'P1',
        } as ProductStock,
      ]);
      mockStockRepo.count.mockResolvedValue(1);
      mockPartRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 } as any, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          company: 'C1',
          plant: 'P1',
        }),
      });
    });
  });

  describe('parseStockId', () => {
    it('should throw for invalid format', async () => {
      await expect(target.hold({ stockId: 'INVALID', reason: 'test' } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
