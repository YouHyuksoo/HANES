/**
 * @file src/modules/material/services/lot-merge.service.spec.ts
 * @description LotMergeService 단위 테스트 (2026-06-08 재설계 모델)
 * - 원 시리얼 전부 폐기(MERGED) → 신규 통합 시리얼 1개 발번
 * - 동일 itemCode + 동일 origin + 입고완료 게이팅
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { LotMergeService } from './lot-merge.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

describe('LotMergeService', () => {
  let target: LotMergeService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockTx: DeepMocked<TransactionService>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  const lot = (matUid: string, over: Partial<MatLot> = {}): MatLot => ({
    matUid, itemCode: 'ITEM-001', status: 'NORMAL', initQty: 100,
    origin: 'ROOT-001', arrivalNo: 'ARR-001', company: 'C1', plant: 'P1', ...over,
  } as MatLot);

  const stock = (matUid: string, qty = 50, over: Partial<MatStock> = {}): MatStock => ({
    warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid, qty, availableQty: qty,
    reservedQty: 0, company: 'C1', plant: 'P1', ...over,
  } as MatStock);

  beforeEach(async () => {
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockMatIssueRepo = createMock<Repository<MatIssue>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockPartnerRepo = createMock<Repository<PartnerMaster>>();
    mockPartnerRepo.find.mockResolvedValue([]);
    mockStockTxRepo = createMock<Repository<StockTransaction>>();
    mockTx = createMock<TransactionService>();
    mockNumbering = createMock<NumberingService>();
    mockQueryRunner = createMock<QueryRunner>();

    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockNumbering.nextMatSerial.mockResolvedValue('NEW-MERGED');
    mockNumbering.next.mockResolvedValue('TX-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotMergeService,
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(MatIssue), useValue: mockMatIssueRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(PartnerMaster), useValue: mockPartnerRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTxRepo },
        { provide: TransactionService, useValue: mockTx },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(LotMergeService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('merge', () => {
    it('서로 다른 2개 미만이면 BadRequestException', async () => {
      await expect(target.merge({ sourceLotIds: ['MAT-001', 'MAT-001'] }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('서로 다른 품목이면 BadRequestException', async () => {
      mockQueryRunner.manager.find.mockResolvedValueOnce([
        lot('MAT-001', { itemCode: 'ITEM-001' }),
        lot('MAT-002', { itemCode: 'ITEM-002' }),
      ]);

      await expect(target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'] }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('입하번호(arrivalNo)가 다르면 BadRequestException', async () => {
      mockQueryRunner.manager.find.mockResolvedValueOnce([
        lot('MAT-001', { arrivalNo: 'ARR-A' }),
        lot('MAT-002', { arrivalNo: 'ARR-B' }),
      ]);

      await expect(target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'] }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('HOLD 상태가 섞이면 BadRequestException', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([lot('MAT-001'), lot('MAT-002', { status: 'HOLD' })])
        .mockResolvedValueOnce([stock('MAT-001'), stock('MAT-002')]);

      await expect(target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'] }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('입고 미완료 LOT이 섞이면 BadRequestException', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([lot('MAT-001'), lot('MAT-002')])
        .mockResolvedValueOnce([stock('MAT-001'), stock('MAT-002')]);
      // receivedQty: 첫 LOT 충분, 둘째 LOT 부족
      (mockQueryRunner.manager.query as jest.Mock)
        .mockResolvedValueOnce([{ RECVD: 100 }])
        .mockResolvedValueOnce([{ RECVD: 0 }]);

      await expect(target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'] }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('정상 병합: 신규 통합 1개 발번, 원본 전부 MERGED', async () => {
      mockQueryRunner.manager.find
        .mockResolvedValueOnce([lot('MAT-001'), lot('MAT-002')])     // lots
        .mockResolvedValueOnce([stock('MAT-001', 30), stock('MAT-002', 20)]) // stocks
        .mockResolvedValueOnce([]);                                   // MatIssue
      (mockQueryRunner.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 100 }]);
      mockQueryRunner.manager.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: 'PART-A', company: 'C1', plant: 'P1' } as ItemMaster);
      (mockQueryRunner.manager.create as jest.Mock).mockImplementation((_e: unknown, obj: unknown) => obj);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      const result = await target.merge({ sourceLotIds: ['MAT-001', 'MAT-002'] }, 'C1', 'P1');

      expect(mockNumbering.nextMatSerial).toHaveBeenCalledTimes(1);
      expect(result.newLotNo).toBe('NEW-MERGED');
      expect(result.mergedLotNos).toEqual(['MAT-001', 'MAT-002']);
      expect(result.totalQty).toBe(50);
      expect(result.label.serials).toHaveLength(1);
      // 원본 전부 MERGED
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'MERGED', currentQty: 0 }),
      );
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        { matUid: 'MAT-002', company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'MERGED', currentQty: 0 }),
      );
      // 신규 통합 LOT currentQty=합산수량
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ matUid: 'NEW-MERGED', initQty: 50, currentQty: 50, status: 'NORMAL' }),
      );
    });
  });

  describe('findByBarcode', () => {
    it('미존재 시리얼이면 예외', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);
      await expect(target.findByBarcode('NOPE', 'C1', 'P1')).rejects.toThrow();
    });

    it('정상 시리얼은 메타와 함께 반환', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(lot('MAT-001'));
      mockMatStockRepo.findOne.mockResolvedValue(stock('MAT-001', 30));
      (mockMatLotRepo.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 100 }]);
      mockMatIssueRepo.find.mockResolvedValue([]);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'PART-A', unit: 'EA' } as ItemMaster]);
      mockMatStockRepo.find.mockResolvedValue([stock('MAT-001', 30)]);

      const result = await target.findByBarcode('MAT-001', 'C1', 'P1');
      expect(result).toEqual(expect.objectContaining({ matUid: 'MAT-001', itemName: 'PART-A', qty: 30 }));
    });
  });

  describe('findMergeableLots', () => {
    const buildQb = (rows: MatLot[]) => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
      getCount: jest.fn().mockResolvedValue(rows.length),
    });

    it('병합 가능 목록을 메타와 함께 반환', async () => {
      mockMatLotRepo.createQueryBuilder.mockReturnValue(buildQb([lot('MAT-001')]) as any);
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: 'PART-A', unit: 'EA' } as ItemMaster]);
      mockMatStockRepo.find.mockResolvedValue([stock('MAT-001', 30)]);

      const result = await target.findMergeableLots({ page: 1, limit: 50 }, 'C1', 'P1');
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(expect.objectContaining({ matUid: 'MAT-001', itemName: 'PART-A', qty: 30 }));
    });
  });
});
