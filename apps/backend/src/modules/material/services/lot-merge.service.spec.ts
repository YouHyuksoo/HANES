/**
 * @file src/modules/material/services/lot-merge.service.spec.ts
 * @description LotMergeService 단위 테스트 - LOT 병합 비즈니스 로직
 *
 * 초보자 가이드:
 * - 같은 품목(itemCode)의 LOT만 병합 가능
 * - 대상 LOT에 수량 합산, 원본 LOT은 DEPLETED 처리
 * - MatStock 동기화 + StockTransaction 이력 기록
 * - 실행: `npx jest --testPathPattern="lot-merge.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { LotMergeService } from './lot-merge.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('LotMergeService', () => {
  let target: LotMergeService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  const createLot = (matUid: string, itemCode = 'ITEM-001', status = 'NORMAL'): MatLot =>
    ({
      matUid,
      itemCode,
      status,
      initQty: 100,
    }) as MatLot;

  const createStock = (matUid: string, qty = 50): MatStock =>
    ({
      warehouseCode: 'WH-01',
      itemCode: 'ITEM-001',
      matUid,
      qty,
      availableQty: qty,
    }) as MatStock;

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
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
        LotMergeService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<LotMergeService>(LotMergeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── merge ───
  describe('merge', () => {
    it('2개 미만의 LOT이면 BadRequestException', async () => {
      mockQueryRunner.manager.find.mockResolvedValueOnce([createLot('MAT-001')]); // lots

      await expect(
        target.merge({ sourceLotIds: ['MAT-001'], targetLotId: 'MAT-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('서로 다른 품목이면 BadRequestException', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([
          createLot('MAT-001', 'ITEM-001'),
          createLot('MAT-002', 'ITEM-002'),
        ]);

      await expect(
        target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'], targetLotId: 'MAT-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('HOLD 상태 LOT이면 BadRequestException', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([
          createLot('MAT-001', 'ITEM-001', 'NORMAL'),
          createLot('MAT-002', 'ITEM-001', 'HOLD'),
        ])
        .mockResolvedValueOnce([createStock('MAT-001'), createStock('MAT-002')]); // stocks

      await expect(
        target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'], targetLotId: 'MAT-001' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('정상적으로 LOT을 병합한다', async () => {
      const lots = [
        { ...createLot('MAT-001'), origin: 'ROOT-001' } as any,
        { ...createLot('MAT-002'), origin: 'ROOT-001' } as any,
      ];
      const stocks = [createStock('MAT-001', 30), createStock('MAT-002', 20)];

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(lots)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A' } as PartMaster);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockStockTxRepo.findOne.mockResolvedValue(null);

      const result = await target.merge({
        sourceLotIds: ['MAT-001', 'MAT-002'],
        targetLotId: 'MAT-001',
      } as any);

      expect(result.targetLotNo).toBe('MAT-001');
      expect(result.mergedLotNos).toEqual(['MAT-002']);
      expect(result.totalMergedQty).toBe(20);
      expect(result.newTotalQty).toBe(50); // 30 + 20
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('품목 마스터가 누락되어도 병합 결과의 대상 LOT 원본 itemCode는 유지한다', async () => {
      const lots = [
        { ...createLot('MAT-001', 'ITEM-MISSING'), origin: 'ROOT-001' } as any,
        { ...createLot('MAT-002', 'ITEM-MISSING'), origin: 'ROOT-001' } as any,
      ];
      const stocks = [
        { ...createStock('MAT-001', 30), itemCode: 'ITEM-MISSING' },
        { ...createStock('MAT-002', 20), itemCode: 'ITEM-MISSING' },
      ] as MatStock[];

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(lots)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockStockTxRepo.findOne.mockResolvedValue(null);

      const result = await target.merge({
        sourceLotIds: ['MAT-001', 'MAT-002'],
        targetLotId: 'MAT-001',
      } as any);

      expect(result).toEqual(
        expect.objectContaining({
          targetLotNo: 'MAT-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
        }),
      );
    });

    it('LOT과 재고의 회사/공장이 다르면 병합하지 않는다', async () => {
      const lots = [
        { ...createLot('MAT-001'), origin: 'ROOT-001', company: 'C1', plant: 'P1' } as any,
        { ...createLot('MAT-002'), origin: 'ROOT-001', company: 'C1', plant: 'P1' } as any,
      ];
      const stocks = [
        { ...createStock('MAT-001', 30), company: 'C1', plant: 'P1' },
        { ...createStock('MAT-002', 20), company: 'OTHER', plant: 'P1' },
      ] as MatStock[];

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(lots)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ itemCode: 'ITEM-001', itemName: 'PART-A', company: 'C1', plant: 'P1' } as PartMaster]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockStockTxRepo.findOne.mockResolvedValue(null);

      await expect(
        target.merge({
          sourceLotIds: ['MAT-001', 'MAT-002'],
          targetLotId: 'MAT-001',
        } as any, 'C1', 'P1'),
      ).rejects.toThrow('회사 정보가 일치하지 않습니다');

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('병합 실행은 LOT 회사/공장 범위에서 LOT/재고/출고이력/품목과 상태 갱신을 처리한다', async () => {
      const lots = [
        { ...createLot('MAT-001'), origin: 'ROOT-001', company: 'C1', plant: 'P1' } as any,
        { ...createLot('MAT-002'), origin: 'ROOT-001', company: 'C1', plant: 'P1' } as any,
      ];
      const stocks = [
        { ...createStock('MAT-001', 30), company: 'C1', plant: 'P1' },
        { ...createStock('MAT-002', 20), company: 'C1', plant: 'P1' },
      ] as MatStock[];

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(lots)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ itemCode: 'ITEM-001', itemName: 'PART-A', company: 'C1', plant: 'P1' } as PartMaster]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockStockTxRepo.findOne.mockResolvedValue(null);

      await target.merge({
        sourceLotIds: ['MAT-001', 'MAT-002'],
        targetLotId: 'MAT-001',
      } as any, 'C1', 'P1');

      expect(mockQueryRunner.manager.find).toHaveBeenNthCalledWith(1, MatLot, {
        where: { matUid: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.find).toHaveBeenNthCalledWith(2, MatStock, {
        where: { matUid: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.find).toHaveBeenNthCalledWith(3, MatIssue, {
        where: { matUid: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.find).toHaveBeenNthCalledWith(4, PartMaster, {
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        { matUid: 'MAT-002', company: 'C1', plant: 'P1' },
        { status: 'DEPLETED' },
      );
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({ company: 'C1', plant: 'P1' }),
      );
    });
  });

  // ─── findMergeableLots ───
  describe('findMergeableLots', () => {
    it('병합 가능 LOT 목록을 반환한다', async () => {
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([createLot('MAT-001')]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockPartMasterRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: '커넥터A', unit: 'EA' } as PartMaster]);

      const result = await target.findMergeableLots({ page: 1, limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('품목 마스터가 누락되어도 병합 가능 LOT의 원본 itemCode는 유지한다', async () => {
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([createLot('MAT-MISSING', 'ITEM-MISSING')]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockPartMasterRepo.find.mockResolvedValue([]);

      const result = await target.findMergeableLots({ page: 1, limit: 50 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          matUid: 'MAT-MISSING',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          unit: null,
        }),
      );
    });

    it('병합 가능 LOT 품목 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([createLot('MAT-001', 'ITEM-001')]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      mockPartMasterRepo.find.mockResolvedValue([]);

      await target.findMergeableLots({ page: 1, limit: 50 }, 'C1', 'P1');

      expect(mockPartMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          company: 'C1',
          plant: 'P1',
        }),
        select: ['itemCode', 'itemName', 'unit'],
      });
    });

    it('병합 가능 LOT 재고 조인도 LOT 테넌트와 같은 범위로 제한한다', async () => {
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockMatLotRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      await target.findMergeableLots({ page: 1, limit: 50 }, 'C1', 'P1');

      expect(mockQb.innerJoin).toHaveBeenCalledWith(
        MatStock,
        'stock',
        'stock.matUid = lot.matUid AND stock.company = lot.company AND stock.plant = lot.plant',
      );
    });
  });
});
