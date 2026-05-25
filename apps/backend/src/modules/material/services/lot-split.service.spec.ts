import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { LotSplitService } from './lot-split.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('LotSplitService', () => {
  let target: LotSplitService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
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
        LotSplitService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(LotSplitService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findSplittableLots', () => {
    it('품목 마스터가 누락되어도 분할 가능 LOT의 원본 itemCode는 유지한다', async () => {
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { matUid: 'MAT-MISSING', itemCode: 'ITEM-MISSING', status: 'NORMAL' } as MatLot,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockPartRepo.find.mockResolvedValue([]);
      mockMatStockRepo.find.mockResolvedValue([]);

      const result = await target.findSplittableLots({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-MISSING',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        warehouseCode: null,
      }),
    );
  });

    it('분할 가능 LOT 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot,
        ]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
      mockPartRepo.find.mockResolvedValue([]);
      mockMatStockRepo.find.mockResolvedValue([]);

      await target.findSplittableLots({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          company: 'C1',
          plant: 'P1',
        }),
      });
      expect(mockMatStockRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          company: 'C1',
          plant: 'P1',
        }),
      });
    });

    it('분할 가능 LOT 재고 조인도 LOT 테넌트와 같은 범위로 제한한다', async () => {
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await target.findSplittableLots({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        MatStock,
        'stock',
        'stock.matUid = lot.matUid AND stock.company = lot.company AND stock.plant = lot.plant',
      );
    });
  });

  it('blocks split when reserved quantity exists', async () => {
    (mockQueryRunner as any).manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 8,
          reservedQty: 2,
        } as MatStock),
    };

    await expect(
      target.split({ sourceLotId: 'MAT-001', splitQty: 3 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks split when material issue history exists', async () => {
    (mockQueryRunner as any).manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 10,
          reservedQty: 0,
        } as MatStock),
      find: jest.fn().mockResolvedValue([
        { matUid: 'MAT-001', issueNo: 'ISS-001', status: 'DONE' } as MatIssue,
      ]),
    };

    await expect(
      target.split({ sourceLotId: 'MAT-001', splitQty: 3 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks split when source stock tenant differs from source LOT tenant', async () => {
    const sourceLot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      status: 'NORMAL',
      company: 'C1',
      plant: 'P1',
    } as MatLot;
    const sourceStock = {
      warehouseCode: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 10,
      availableQty: 10,
      reservedQty: 0,
      company: 'OTHER',
      plant: 'P1',
    } as MatStock;

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(sourceLot)
      .mockResolvedValueOnce(sourceStock)
      .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART-A', isSplittable: 'Y', company: 'C1', plant: 'P1' } as PartMaster)
      .mockResolvedValueOnce(null);
    mockQueryRunner.manager.find.mockResolvedValue([]);
    (mockQueryRunner.manager.create as jest.Mock)
      .mockReturnValueOnce({ matUid: 'MAT-001-S001', itemCode: 'ITEM-001' } as MatLot)
      .mockReturnValueOnce({ matUid: 'MAT-001-S001' } as MatStock);
    mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
    mockQueryRunner.manager.save.mockResolvedValue({} as any);
    mockStockTxRepo.findOne.mockResolvedValue(null);

    await expect(
      target.split({ sourceLotId: 'MAT-001', splitQty: 3 } as any, 'C1', 'P1'),
    ).rejects.toThrow('회사 정보가 일치하지 않습니다');

    expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
  });

  it('splits a LOT through TransactionService', async () => {
    const sourceLot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      status: 'NORMAL',
      company: 'C1',
      plant: 'P1',
    } as MatLot;
    const sourceStock = {
      warehouseCode: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 10,
      availableQty: 10,
      reservedQty: 0,
      company: 'C1',
      plant: 'P1',
    } as MatStock;
    const part = { itemCode: 'ITEM-001', itemName: 'PART-A', isSplittable: 'Y', company: 'C1', plant: 'P1' } as PartMaster;
    const newLot = { matUid: 'MAT-001-S001', itemCode: 'ITEM-001' } as MatLot;

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(sourceLot)
      .mockResolvedValueOnce(sourceStock)
      .mockResolvedValueOnce(part)
      .mockResolvedValueOnce(null);
    mockQueryRunner.manager.find.mockResolvedValue([]);
    (mockQueryRunner.manager.create as jest.Mock)
      .mockReturnValueOnce(newLot)
      .mockReturnValueOnce({ matUid: 'MAT-001-S001' } as MatStock);
    mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
    mockQueryRunner.manager.save.mockResolvedValue({} as any);
    mockStockTxRepo.findOne.mockResolvedValue(null);

    const result = await target.split({
      sourceLotId: 'MAT-001',
      splitQty: 3,
      newLotNo: 'MAT-001-S001',
    } as any);

    expect(result.newLotNo).toBe('MAT-001-S001');
    expect(mockQueryRunner.manager.create).toHaveBeenNthCalledWith(
      1,
      MatLot,
      expect.objectContaining({
        matUid: 'MAT-001-S001',
        origin: 'MAT-001',
      }),
    );
    expect(mockTx.run).toHaveBeenCalledTimes(1);
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('split은 원본 LOT 회사/공장 범위에서 재고/출고이력/품목/LOT 상태를 처리한다', async () => {
    const sourceLot = {
      matUid: 'MAT-001',
      itemCode: 'ITEM-001',
      status: 'NORMAL',
      company: 'C1',
      plant: 'P1',
    } as MatLot;
    const sourceStock = {
      warehouseCode: 'WH-01',
      itemCode: 'ITEM-001',
      matUid: 'MAT-001',
      qty: 3,
      availableQty: 3,
      reservedQty: 0,
      company: 'C1',
      plant: 'P1',
    } as MatStock;
    const part = { itemCode: 'ITEM-001', itemName: 'PART-A', isSplittable: 'Y', company: 'C1', plant: 'P1' } as PartMaster;

    mockQueryRunner.manager.findOne
      .mockResolvedValueOnce(sourceLot)
      .mockResolvedValueOnce(sourceStock)
      .mockResolvedValueOnce(part)
      .mockResolvedValueOnce(null);
    mockQueryRunner.manager.find.mockResolvedValue([]);
    (mockQueryRunner.manager.create as jest.Mock)
      .mockReturnValueOnce({ matUid: 'MAT-001-S001', itemCode: 'ITEM-001' } as MatLot)
      .mockReturnValueOnce({ matUid: 'MAT-001-S001' } as MatStock);
    mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
    mockQueryRunner.manager.save.mockResolvedValue({} as any);
    mockStockTxRepo.findOne.mockResolvedValue(null);

    await target.split({
      sourceLotId: 'MAT-001',
      splitQty: 3,
      newLotNo: 'MAT-001-S001',
    } as any, 'C1', 'P1');

    expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(1, MatLot, {
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
    expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(2, MatStock, {
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
    expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(MatIssue, {
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
    expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(3, PartMaster, {
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(4, MatLot, {
      where: { matUid: 'MAT-001-S001', company: 'C1', plant: 'P1' },
    });
    expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
      MatLot,
      { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      { status: 'DEPLETED' },
    );
  });
});
