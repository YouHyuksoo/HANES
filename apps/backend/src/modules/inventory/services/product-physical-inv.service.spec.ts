/**
 * @file product-physical-inv.service.spec.ts
 * @description ProductPhysicalInvService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ProductPhysicalInvService } from './product-physical-inv.service';
import { ProductStock } from '../../../entities/product-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ProductPhysicalInvService', () => {
  let target: ProductPhysicalInvService;
  let mockStockRepo: DeepMocked<Repository<ProductStock>>;
  let mockAdjRepo: DeepMocked<Repository<InvAdjLog>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockWhRepo: DeepMocked<Repository<Warehouse>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockSessionRepo: DeepMocked<Repository<PhysicalInvSession>>;
  let mockCountDetailRepo: DeepMocked<Repository<PhysicalInvCountDetail>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockStockRepo = createMock<Repository<ProductStock>>();
    mockAdjRepo = createMock<Repository<InvAdjLog>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockWhRepo = createMock<Repository<Warehouse>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockSessionRepo = createMock<Repository<PhysicalInvSession>>();
    mockCountDetailRepo = createMock<Repository<PhysicalInvCountDetail>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();
    mockQueryRunner = createMock<QueryRunner>();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
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
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(PhysicalInvSession), useValue: mockSessionRepo },
        { provide: getRepositoryToken(PhysicalInvCountDetail), useValue: mockCountDetailRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ProductPhysicalInvService>(ProductPhysicalInvService);
  });
  afterEach(() => jest.clearAllMocks());

  const createRawQueryBuilderMock = () => ({
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
  });

  describe('findStocks', () => {
    it('uses warehouseCode as the canonical warehouse filter and response field', async () => {
      const qb = createRawQueryBuilderMock();
      mockStockRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findStocks({ warehouseCode: 'WH-01', page: 1, limit: 50 } as any, 'CO', 'P01');

      expect(qb.andWhere).toHaveBeenCalledWith('s.warehouseCode = :warehouseCode', { warehouseCode: 'WH-01' });
      expect(qb.select).toHaveBeenCalledWith(expect.arrayContaining([
        's.warehouseCode AS "warehouseCode"',
      ]));
    });

    it('joins reference tables by tenant-scoped keys', async () => {
      const qb = createRawQueryBuilderMock();
      mockStockRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findStocks({ page: 1, limit: 50 } as any, 'CO', 'P01');

      // ProductStock는 warehouseCode+itemCode 키 기준. ItemMaster/Warehouse만 조인한다 (MatLot 조인 제거됨).
      expect(qb.leftJoin).toHaveBeenCalledWith(
        ItemMaster,
        'p',
        'p.itemCode = s.itemCode AND p.company = s.company AND p.plant = s.plant',
      );
      expect(qb.leftJoin).toHaveBeenCalledWith(
        Warehouse,
        'w',
        'w.warehouseCode = s.warehouseCode AND w.company = s.company AND w.plant = s.plant',
      );
      expect(qb.leftJoin).not.toHaveBeenCalledWith(
        MatLot,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('findHistory', () => {
    it('uses warehouseCode as the canonical warehouse filter and response field', async () => {
      const qb = createRawQueryBuilderMock();
      mockAdjRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findHistory({ warehouseCode: 'WH-01', page: 1, limit: 50 } as any, 'CO', 'P01');

      expect(qb.andWhere).toHaveBeenCalledWith('log.warehouseCode = :warehouseCode', { warehouseCode: 'WH-01' });
      expect(qb.select).toHaveBeenCalledWith(expect.arrayContaining([
        'log.warehouseCode AS "warehouseCode"',
      ]));
    });

    it('joins history reference tables by tenant-scoped keys', async () => {
      const qb = createRawQueryBuilderMock();
      mockAdjRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findHistory({ page: 1, limit: 50 } as any, 'CO', 'P01');

      expect(qb.leftJoin).toHaveBeenCalledWith(
        ItemMaster,
        'part',
        'part.itemCode = log.itemCode AND part.company = log.company AND part.plant = log.plant',
      );
      expect(qb.leftJoin).toHaveBeenCalledWith(
        MatLot,
        'lot',
        'lot.matUid = log.matUid AND lot.company = log.company AND lot.plant = log.plant',
      );
      expect(qb.leftJoin).toHaveBeenCalledWith(
        Warehouse,
        'wh',
        'wh.warehouseCode = log.warehouseCode AND wh.company = log.company AND wh.plant = log.plant',
      );
    });
  });

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
      } as any, 'CO', 'P01', 'user');

      expect(r).toHaveLength(1);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      // stockId는 warehouseCode::itemCode (2-part)로 분해되며 prdUid는 키에 포함되지 않는다.
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(ProductStock, {
        where: { warehouseCode: 'WH', itemCode: 'IT', company: 'CO', plant: 'P01' },
      });
    });

    it('should throw when stock not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(target.applyCount({
        items: [{ stockId: 'WH::IT::LOT1', countedQty: 90 }],
        createdBy: 'user',
      } as any, 'CO', 'P01', 'user')).rejects.toThrow(NotFoundException);
      expect(mockTx.run).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid stockId format', async () => {
      await expect(target.applyCount({
        items: [{ stockId: 'INVALID', countedQty: 90 }],
        createdBy: 'user',
      } as any, 'CO', 'P01', 'user')).rejects.toThrow(NotFoundException);
    });

    it('should throw when countedQty is below reservedQty', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', qty: 100, reservedQty: 20, company: 'CO', plant: 'P01' } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);

      await expect(target.applyCount({
        items: [{ stockId: 'WH::IT::LOT1', countedQty: 10 }],
        createdBy: 'user',
      } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);
    });

    it('should throw when product stock tenant differs from request tenant', async () => {
      const stock = { warehouseCode: 'WH', itemCode: 'IT', prdUid: 'LOT1', qty: 100, reservedQty: 0, company: 'OTHER', plant: 'P01' } as any;
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);

      await expect(target.applyCount({
        items: [{ stockId: 'WH::IT::LOT1', countedQty: 90 }],
        createdBy: 'user',
      } as any, 'CO', 'P01', 'user')).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    });
  });
});
