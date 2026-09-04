/**
 * @file src/modules/material/services/lot-split.service.spec.ts
 * @description LotSplitService 단위 테스트 (2026-06-08 재설계 모델)
 * - 원본 전량 폐기(SPLIT) → 신규 2조각 발번
 * - 입고완료 게이팅 / 예약·출고이력 차단 / currentQty 설정
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { LotSplitService } from './lot-split.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';
import { isMatLotIssuable, isMatLotTerminal } from '@harness/shared';

describe('LotSplitService', () => {
  let target: LotSplitService;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockMatIssueRepo: DeepMocked<Repository<MatIssue>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockPartnerRepo: DeepMocked<Repository<PartnerMaster>>;
  let mockStockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let mockTx: DeepMocked<TransactionService>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  const sourceLot = (over: Partial<MatLot> = {}): MatLot => ({
    matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL', initQty: 10,
    origin: null, company: 'C1', plant: 'P1', ...over,
  } as MatLot);

  const sourceStock = (over: Partial<MatStock> = {}): MatStock => ({
    warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001',
    qty: 10, availableQty: 10, reservedQty: 0, company: 'C1', plant: 'P1', ...over,
  } as MatStock);

  const part = (over: Partial<ItemMaster> = {}): ItemMaster => ({
    itemCode: 'ITEM-001', itemName: 'PART-A', isSplittable: 'Y', company: 'C1', plant: 'P1', ...over,
  } as ItemMaster);

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
    mockNumbering.nextMatSerial
      .mockResolvedValueOnce('NEW-1')
      .mockResolvedValueOnce('NEW-2');
    mockNumbering.next.mockResolvedValue('TX-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotSplitService,
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

    target = module.get(LotSplitService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findSplittableLots', () => {
    const buildQb = (rows: MatLot[]) => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
      getCount: jest.fn().mockResolvedValue(rows.length),
    });

    it('품목 마스터가 누락되어도 원본 itemCode를 유지하고 메타를 부착한다', async () => {
      mockMatLotRepo.createQueryBuilder.mockReturnValue(
        buildQb([{ matUid: 'MAT-X', itemCode: 'ITEM-X', status: 'NORMAL' } as MatLot]) as any,
      );
      mockPartRepo.find.mockResolvedValue([]);
      mockMatStockRepo.find.mockResolvedValue([]);

      const result = await target.findSplittableLots({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({ matUid: 'MAT-X', itemCode: 'ITEM-X', itemName: null, unit: null, qty: 0, warehouseCode: null }),
      );
    });

    it('보강 조회를 요청 테넌트 범위로 제한한다', async () => {
      mockMatLotRepo.createQueryBuilder.mockReturnValue(
        buildQb([{ matUid: 'MAT-001', itemCode: 'ITEM-001', status: 'NORMAL' } as MatLot]) as any,
      );
      mockPartRepo.find.mockResolvedValue([]);
      mockMatStockRepo.find.mockResolvedValue([]);

      await target.findSplittableLots({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({ where: expect.objectContaining({ company: 'C1', plant: 'P1' }) });
      expect(mockMatStockRepo.find).toHaveBeenCalledWith({ where: expect.objectContaining({ company: 'C1', plant: 'P1' }) });
    });

    it('분할 대상 조건(재고>1, NORMAL, 예약0, 입고완료)을 DB where 로 걸고 서버 페이징한다', async () => {
      const qb = buildQb([]);
      mockMatLotRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.findSplittableLots({ page: 2, limit: 50, search: 'MAT' }, 'C1', 'P1');

      expect(qb.where).toHaveBeenCalledWith('stock.qty > 1');
      expect(qb.andWhere).toHaveBeenCalledWith('lot.status IN (:...activeStatuses)', { activeStatuses: ['NORMAL'] });
      expect(qb.andWhere).toHaveBeenCalledWith('NVL(stock.reservedQty, 0) = 0');
      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('lot.initQty <='));
      expect(qb.andWhere).toHaveBeenCalledWith('lot.company = :company', { company: 'C1' });
      expect(qb.andWhere).toHaveBeenCalledWith('lot.plant = :plant', { plant: 'P1' });
      expect(qb.andWhere).toHaveBeenCalledWith('lot.matUid LIKE :search', { search: '%MAT%' });
      expect(qb.skip).toHaveBeenCalledWith(50);
      expect(qb.take).toHaveBeenCalledWith(50);
    });
  });

  describe('split', () => {
    const wireHappyPath = () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceLot())
        .mockResolvedValueOnce(sourceStock())
        .mockResolvedValueOnce(part());
      (mockQueryRunner.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 10 }]);
      mockQueryRunner.manager.find.mockResolvedValue([]); // MatIssue
      (mockQueryRunner.manager.create as jest.Mock).mockImplementation((_e: unknown, obj: unknown) => obj);
      mockQueryRunner.manager.save.mockResolvedValue({} as any);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
    };

    it('HOLD 원본은 분할을 차단한다', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(sourceLot({ status: 'HOLD' }));

      await expect(target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1'))
        .rejects.toThrow('HOLD 상태인 LOT은 분할할 수 없습니다');
    });

    it.each(['SPLIT', 'MERGED', 'DISCARDED', 'DEPLETED'])('종결 LOT(%s) 원본은 재고가 남아 있어도 분할을 차단한다', async (status) => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceLot({ status }))
        .mockResolvedValueOnce(sourceStock());

      await expect(target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1'))
        .rejects.toThrow('정상(NORMAL) 상태가 아닌 LOT은 분할할 수 없습니다');
      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
    });

    it('입고 미완료(RECEIVE 합 < initQty) LOT은 분할을 차단한다', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(sourceLot());
      (mockQueryRunner.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 0 }]);

      await expect(target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('예약 수량이 있으면 분할을 차단한다', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceLot())
        .mockResolvedValueOnce(sourceStock({ reservedQty: 2 }));
      (mockQueryRunner.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 10 }]);

      await expect(target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('출고 이력이 있으면 분할을 차단한다', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceLot())
        .mockResolvedValueOnce(sourceStock());
      (mockQueryRunner.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 10 }]);
      mockQueryRunner.manager.find.mockResolvedValue([{ matUid: 'MAT-001', status: 'DONE' } as MatIssue]);

      await expect(target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('분할 수량이 재고 이상이면 차단한다(2분할 보장)', async () => {
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceLot())
        .mockResolvedValueOnce(sourceStock({ qty: 10 }));
      (mockQueryRunner.manager.query as jest.Mock).mockResolvedValue([{ RECVD: 10 }]);
      mockQueryRunner.manager.find.mockResolvedValue([]);

      await expect(target.split({ sourceLotId: 'MAT-001', splitQty: 10 }, 'C1', 'P1'))
        .rejects.toThrow(BadRequestException);
    });

    it('정상 분할: 신규 2조각 발번, 원본 SPLIT 처리, currentQty 설정', async () => {
      wireHappyPath();

      const result = await target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1');

      // 신규 2조각 발번
      expect(mockNumbering.nextMatSerial).toHaveBeenCalledTimes(2);
      expect(result.results).toEqual([
        { matUid: 'NEW-1', qty: 3 },
        { matUid: 'NEW-2', qty: 7 },
      ]);
      // 라벨 데이터 2건
      expect(result.label.serials).toHaveLength(2);
      // 원본 SPLIT + 재고 0
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'SPLIT', currentQty: 0 }),
      );
      // 신규 LOT은 currentQty=조각수량으로 생성됨 (ORA-01400 회귀 방지)
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        MatLot,
        expect.objectContaining({ matUid: 'NEW-1', initQty: 3, currentQty: 3, origin: 'MAT-001', status: 'NORMAL' }),
      );
    });

    it('분할 전이: 원본은 SPLIT(종결·출고 불가)+재고 0, 자식 2조각은 NORMAL(출고 가능)', async () => {
      wireHappyPath();

      await target.split({ sourceLotId: 'MAT-001', splitQty: 3 }, 'C1', 'P1');

      const sourcePatch = (mockQueryRunner.manager.update as jest.Mock).mock.calls
        .filter(([entity]) => entity === MatLot)
        .map(([, , patch]) => patch as { status: string; currentQty: number });
      expect(sourcePatch).toHaveLength(1);
      expect(isMatLotTerminal(sourcePatch[0].status)).toBe(true);
      expect(isMatLotIssuable(sourcePatch[0].status)).toBe(false);
      expect(sourcePatch[0].currentQty).toBe(0);

      // 원본 MAT_STOCKS 잔량 0 (종결 LOT 재고 잔존 방지)
      const stockPatch = (mockQueryRunner.manager.update as jest.Mock).mock.calls
        .filter(([entity]) => entity === MatStock)
        .map(([, , patch]) => patch as { qty: number; availableQty: number });
      expect(stockPatch).toHaveLength(1);
      expect(stockPatch[0]).toEqual(expect.objectContaining({ qty: 0, availableQty: 0 }));

      const children = (mockQueryRunner.manager.create as jest.Mock).mock.calls
        .filter(([entity]) => entity === MatLot)
        .map(([, obj]) => obj as { matUid: string; status: string; currentQty: number });
      expect(children.map((c) => c.matUid)).toEqual(['NEW-1', 'NEW-2']);
      expect(children.every((c) => isMatLotIssuable(c.status) && c.currentQty > 0)).toBe(true);
    });
  });
});
