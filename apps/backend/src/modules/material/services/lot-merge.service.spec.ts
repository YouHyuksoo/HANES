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
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('LotMergeService', () => {
  let target: LotMergeService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockDataSource: DeepMocked<DataSource>;
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
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
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
        LotMergeService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      const lots = [createLot('MAT-001'), createLot('MAT-002')];
      const stocks = [createStock('MAT-001', 30), createStock('MAT-002', 20)];

      mockQueryRunner.manager.find
        .mockResolvedValueOnce(lots)
        .mockResolvedValueOnce(stocks);
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
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
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
  });
});
