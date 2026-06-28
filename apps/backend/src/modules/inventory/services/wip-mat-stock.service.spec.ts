/**
 * @file wip-mat-stock.service.spec.ts
 * @description WipMatStockService 단위 테스트 - 공정재고 가산/차감/복원/조회
 *
 * 초보자 가이드:
 * - addStockInTx: 공정재고 가산(upsert) + WIP_MAT_TRANSACTIONS(+) 기록
 * - deductStockInTx: FIFO 차감(+scannedMatUids 우선) + WIP_MAT_TRANSACTIONS(-) 기록
 * - restoreInTx: 취소 복원(원본 거래 조회 → 대칭 복원 + *_CANCEL)
 * - findByEquip: WIP_MAT_STOCKS 조회(EQUIP_MASTERS 설비명 조인)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository, QueryRunner, EntityManager } from 'typeorm';
import { WipMatStockService } from './wip-mat-stock.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { WipMatTransaction } from '../../../entities/wip-mat-transaction.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('WipMatStockService', () => {
  let target: WipMatStockService;
  let mockStockRepo: DeepMocked<Repository<WipMatStock>>;
  let mockTxRepo: DeepMocked<Repository<WipMatTransaction>>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockManager: DeepMocked<EntityManager>;
  let mockQr: QueryRunner;

  const company = '40';
  const plant = '1000';
  const equipCode = 'EQ-ATCNS-01';

  beforeEach(async () => {
    mockStockRepo = createMock<Repository<WipMatStock>>();
    mockTxRepo = createMock<Repository<WipMatTransaction>>();
    mockNumbering = createMock<NumberingService>();
    mockManager = createMock<EntityManager>();
    mockQr = { manager: mockManager } as unknown as QueryRunner;

    // create는 입력 객체를 그대로 반환
    mockManager.create.mockImplementation((_entity: unknown, obj: unknown) => obj as never);
    mockManager.save.mockImplementation(async (_entity: unknown, obj: unknown) => obj as never);

    let seq = 0;
    mockNumbering.nextInTx.mockImplementation(async () => `WTX260616-${String(++seq).padStart(5, '0')}`);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WipMatStockService,
        { provide: getRepositoryToken(WipMatStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(WipMatTransaction), useValue: mockTxRepo },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).setLogger(new MockLoggerService()).compile();

    target = module.get<WipMatStockService>(WipMatStockService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('addStockInTx', () => {
    it('기존 재고 없으면 신규 생성 + WIP_MAT_TRANSACTIONS 1건(+qty) 기록', async () => {
      mockManager.findOne.mockResolvedValueOnce(null); // WipMatStock 조회

      await target.addStockInTx(mockQr, {
        equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 10,
        transType: 'WIP_IN', fromWarehouseId: 'WH-RAW', orderNo: 'W-001',
        refType: 'MAT_ISSUE', refId: 'ISS-001-1', company, plant,
      });

      // 재고 신규 생성
      expect(mockManager.save).toHaveBeenCalledWith(
        WipMatStock,
        expect.objectContaining({
          company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001',
          qty: 10, availableQty: 10, reservedQty: 0,
        }),
      );
      // 거래 기록(+10)
      expect(mockManager.save).toHaveBeenCalledWith(
        WipMatTransaction,
        expect.objectContaining({
          transNo: 'WTX260616-00001', transType: 'WIP_IN', qty: 10,
          equipCode, itemCode: 'ITEM-A', matUid: 'RM-001',
          refType: 'MAT_ISSUE', refId: 'ISS-001-1', status: 'DONE',
          company, plant,
        }),
      );
    });

    it('기존 재고 있으면 qty/availableQty 누적', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001',
        qty: 5, availableQty: 5, reservedQty: 0,
      } as WipMatStock);

      await target.addStockInTx(mockQr, {
        equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 7,
        transType: 'WIP_IN', refType: 'MAT_ISSUE', refId: 'ISS-002-1', company, plant,
      });

      expect(mockManager.update).toHaveBeenCalledWith(
        WipMatStock,
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001' },
        expect.objectContaining({ qty: 12, availableQty: 12 }),
      );
    });
  });

  describe('deductStockInTx', () => {
    it('FIFO 차감 + 잔량 감소 + PROD_CONSUME 음수 기록', async () => {
      mockManager.find.mockResolvedValueOnce([
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 8, availableQty: 8, reservedQty: 0, createdAt: new Date('2026-06-01') },
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-002', qty: 8, availableQty: 8, reservedQty: 0, createdAt: new Date('2026-06-02') },
      ] as WipMatStock[]);

      const deducted = await target.deductStockInTx(mockQr, {
        equipCode, itemCode: 'ITEM-A', qty: 10,
        transType: 'PROD_CONSUME', refType: 'PROD_RESULT', refId: 'PR-001',
        stockPolicy: 'BLOCK', company, plant,
      });

      // RM-001 전량(8) + RM-002 일부(2)
      expect(deducted).toEqual([
        expect.objectContaining({ matUid: 'RM-001', qty: 8 }),
        expect.objectContaining({ matUid: 'RM-002', qty: 2 }),
      ]);
      // 첫 LOT 잔량 0
      expect(mockManager.update).toHaveBeenCalledWith(
        WipMatStock,
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001' },
        expect.objectContaining({ qty: 0, availableQty: 0 }),
      );
      // PROD_CONSUME 음수 거래 2건
      expect(mockManager.save).toHaveBeenCalledWith(
        WipMatTransaction,
        expect.objectContaining({ transType: 'PROD_CONSUME', qty: -8, matUid: 'RM-001' }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        WipMatTransaction,
        expect.objectContaining({ transType: 'PROD_CONSUME', qty: -2, matUid: 'RM-002' }),
      );
    });

    it('scannedMatUids 지정 시 해당 LOT 우선 차감', async () => {
      mockManager.find.mockResolvedValueOnce([
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 8, availableQty: 8, reservedQty: 0, createdAt: new Date('2026-06-01') },
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-002', qty: 8, availableQty: 8, reservedQty: 0, createdAt: new Date('2026-06-02') },
      ] as WipMatStock[]);

      const deducted = await target.deductStockInTx(mockQr, {
        equipCode, itemCode: 'ITEM-A', qty: 3,
        transType: 'PROD_CONSUME', refType: 'PROD_RESULT', refId: 'PR-002',
        scannedMatUids: ['RM-002'], stockPolicy: 'BLOCK', company, plant,
      });

      expect(deducted).toEqual([expect.objectContaining({ matUid: 'RM-002', qty: 3 })]);
    });

    it('가용 부족 + BLOCK → BadRequestException', async () => {
      mockManager.find.mockResolvedValueOnce([
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 2, availableQty: 2, reservedQty: 0, createdAt: new Date('2026-06-01') },
      ] as WipMatStock[]);

      await expect(target.deductStockInTx(mockQr, {
        equipCode, itemCode: 'ITEM-A', qty: 10,
        transType: 'PROD_CONSUME', refType: 'PROD_RESULT', refId: 'PR-003',
        stockPolicy: 'BLOCK', company, plant,
      })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('가용 부족 + WARN → 가용분만 차감 + warnings 누적', async () => {
      mockManager.find.mockResolvedValueOnce([
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 2, availableQty: 2, reservedQty: 0, createdAt: new Date('2026-06-01') },
      ] as WipMatStock[]);

      const warnings: string[] = [];
      const deducted = await target.deductStockInTx(mockQr, {
        equipCode, itemCode: 'ITEM-A', qty: 10,
        transType: 'PROD_CONSUME', refType: 'PROD_RESULT', refId: 'PR-004',
        stockPolicy: 'WARN', company, plant, warnings,
      });

      expect(deducted).toEqual([expect.objectContaining({ matUid: 'RM-001', qty: 2 })]);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('restoreInTx', () => {
    it('DEDUCT_BACK(출고취소): 원본 WIP_IN 거래 조회 → 공정재고 차감 + WIP_IN_CANCEL', async () => {
      // 원본 거래 조회
      mockManager.find.mockResolvedValueOnce([
        { transNo: 'WTX-ORIG', transType: 'WIP_IN', equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 10, company, plant },
      ] as WipMatTransaction[]);
      // 차감 대상 재고
      mockManager.findOne.mockResolvedValueOnce({
        company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 10, availableQty: 10, reservedQty: 0,
      } as WipMatStock);

      await target.restoreInTx(mockQr, {
        mode: 'DEDUCT_BACK', refType: 'MAT_ISSUE', refId: 'ISS-001-1',
        cancelTransType: 'WIP_IN_CANCEL', company, plant,
      });

      // 재고 차감
      expect(mockManager.update).toHaveBeenCalledWith(
        WipMatStock,
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001' },
        expect.objectContaining({ qty: 0, availableQty: 0 }),
      );
      // WIP_IN_CANCEL 음수 거래 + cancelRefId
      expect(mockManager.save).toHaveBeenCalledWith(
        WipMatTransaction,
        expect.objectContaining({ transType: 'WIP_IN_CANCEL', qty: -10, cancelRefId: 'WTX-ORIG' }),
      );
    });

    it('ADD_BACK(소비취소): 원본 PROD_CONSUME 거래 조회 → 공정재고 가산 + PROD_CONSUME_CANCEL', async () => {
      mockManager.find.mockResolvedValueOnce([
        { transNo: 'WTX-CON', transType: 'PROD_CONSUME', equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: -6, company, plant },
      ] as WipMatTransaction[]);
      mockManager.findOne.mockResolvedValueOnce({
        company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001', qty: 2, availableQty: 2, reservedQty: 0,
      } as WipMatStock);

      await target.restoreInTx(mockQr, {
        mode: 'ADD_BACK', refType: 'PROD_RESULT', refId: 'PR-001',
        cancelTransType: 'PROD_CONSUME_CANCEL', company, plant,
      });

      // 재고 가산(원본 절대값 6 복원)
      expect(mockManager.update).toHaveBeenCalledWith(
        WipMatStock,
        { company, plant, equipCode, itemCode: 'ITEM-A', matUid: 'RM-001' },
        expect.objectContaining({ qty: 8, availableQty: 8 }),
      );
      // PROD_CONSUME_CANCEL 양수 거래
      expect(mockManager.save).toHaveBeenCalledWith(
        WipMatTransaction,
        expect.objectContaining({ transType: 'PROD_CONSUME_CANCEL', qty: 6, cancelRefId: 'WTX-CON' }),
      );
    });
  });

  describe('findByEquip', () => {
    it('설비명 조인 결과를 반환한다', async () => {
      const qb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { equipCode, equipName: '자동결선기1', itemCode: 'ITEM-A', matUid: 'RM-001', qty: 8 },
        ]),
      };
      mockStockRepo.createQueryBuilder.mockReturnValue(qb);

      const rows = await target.findByEquip(equipCode, company, plant);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({ equipName: '자동결선기1' }));
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  describe('findTransactions', () => {
    const makeQb = () => ({
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    });

    it('설비명/품목명 조인 결과를 최신순으로 반환한다', async () => {
      const qb: any = makeQb();
      qb.getRawMany.mockResolvedValue([
        {
          transNo: 'WTX260616-00002', transType: 'PROD_CONSUME', equipCode,
          equipName: '자동결선기1', itemCode: 'ITEM-A', itemName: '단자A',
          matUid: 'RM-001', qty: -3, fromWarehouseId: null, orderNo: 'W-001',
          refType: 'PROD_RESULT', refId: 'PR-001', cancelRefId: null,
          status: 'DONE', remark: null, workerId: 'U1', createdAt: new Date('2026-06-16T10:00:00'),
        },
      ]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      const rows = await target.findTransactions({}, company, plant);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          transNo: 'WTX260616-00002', transType: 'PROD_CONSUME',
          equipName: '자동결선기1', itemName: '단자A', qty: -3,
        }),
      );
      // 멀티테넌시 + 최신순 정렬 확인
      expect(qb.where).toHaveBeenCalledWith('tx.COMPANY = :company', { company });
      expect(qb.orderBy).toHaveBeenCalledWith('tx.CREATED_AT', 'DESC');
    });

    it('필터(equipCode/transType/search/fromDate/toDate)를 적용한다', async () => {
      const qb: any = makeQb();
      qb.getRawMany.mockResolvedValue([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      await target.findTransactions(
        { equipCode, transType: 'WIP_IN', search: 'RM', fromDate: '2026-06-16', toDate: '2026-06-16' },
        company,
        plant,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('tx.EQUIP_CODE = :equipCode', { equipCode });
      expect(qb.andWhere).toHaveBeenCalledWith('tx.TRANS_TYPE = :transType', { transType: 'WIP_IN' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LIKE :kw'),
        { kw: '%RM%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.CREATED_AT >= TO_TIMESTAMP(:fromDate, :dateFmt)',
        expect.objectContaining({ fromDate: '2026-06-16 00:00:00' }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.CREATED_AT <= TO_TIMESTAMP(:toDate, :dateFmt)',
        expect.objectContaining({ toDate: '2026-06-16 23:59:59' }),
      );
    });
  });
});
