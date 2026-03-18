/**
 * @file src/modules/material/services/physical-inv.service.spec.ts
 * @description PhysicalInvService 단위 테스트 - 재고실사 세션 관리, 실사 반영
 *
 * 초보자 가이드:
 * - startSession: 실사 개시 (IN_PROGRESS 세션 생성)
 * - completeSession: 실사 완료 (IN_PROGRESS → COMPLETED)
 * - applyCount: 실사 결과 반영 (MatStock + InvAdjLog)
 * - scanCount: PDA 바코드 스캔 → 실사수량 +1
 * - 실행: `npx jest --testPathPattern="physical-inv.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { PhysicalInvService } from './physical-inv.service';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PhysicalInvSession } from '../../../entities/physical-inv-session.entity';
import { PhysicalInvCountDetail } from '../../../entities/physical-inv-count-detail.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PhysicalInvService', () => {
  let target: PhysicalInvService;
  let mockMatStockRepo: DeepMocked<Repository<MatStock>>;
  let mockInvAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let mockMatLotRepo: DeepMocked<Repository<MatLot>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockSessionRepo: DeepMocked<Repository<PhysicalInvSession>>;
  let mockCountDetailRepo: DeepMocked<Repository<PhysicalInvCountDetail>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockMatStockRepo = createMock<Repository<MatStock>>();
    mockInvAdjLogRepo = createMock<Repository<InvAdjLog>>();
    mockMatLotRepo = createMock<Repository<MatLot>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockSessionRepo = createMock<Repository<PhysicalInvSession>>();
    mockCountDetailRepo = createMock<Repository<PhysicalInvCountDetail>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockDataSource.getRepository.mockReturnValue(createMock<Repository<StockTransaction>>() as any);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalInvService,
        { provide: getRepositoryToken(MatStock), useValue: mockMatStockRepo },
        { provide: getRepositoryToken(InvAdjLog), useValue: mockInvAdjLogRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockMatLotRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: getRepositoryToken(PhysicalInvSession), useValue: mockSessionRepo },
        { provide: getRepositoryToken(PhysicalInvCountDetail), useValue: mockCountDetailRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PhysicalInvService>(PhysicalInvService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getSessionStatus ───
  describe('getSessionStatus', () => {
    it('진행 중인 세션이 있으면 isFreeze=true', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ status: 'IN_PROGRESS' } as PhysicalInvSession);

      const result = await target.getSessionStatus();

      expect(result.isFreeze).toBe(true);
    });

    it('진행 중인 세션이 없으면 isFreeze=false', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);

      const result = await target.getSessionStatus();

      expect(result.isFreeze).toBe(false);
    });
  });

  // ─── startSession ───
  describe('startSession', () => {
    it('이미 진행 중인 세션이 있으면 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        status: 'IN_PROGRESS', sessionDate: new Date(), seq: 1,
      } as PhysicalInvSession);

      await expect(
        target.startSession({ invType: 'MATERIAL', countMonth: '2026-03' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('새 실사 세션을 생성한다', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: 0 }),
      } as any);
      const session = { sessionDate: new Date(), seq: 1, status: 'IN_PROGRESS' } as PhysicalInvSession;
      mockSessionRepo.create.mockReturnValue(session);
      mockSessionRepo.save.mockResolvedValue(session);

      const result = await target.startSession({ invType: 'MATERIAL', countMonth: '2026-03' } as any);

      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  // ─── completeSession ───
  describe('completeSession', () => {
    it('존재하지 않는 세션이면 NotFoundException', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);

      await expect(
        target.completeSession('2026-03-18', 1, {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('IN_PROGRESS가 아닌 세션이면 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ status: 'COMPLETED' } as PhysicalInvSession);

      await expect(
        target.completeSession('2026-03-18', 1, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('정상적으로 세션을 완료한다', async () => {
      const session = { status: 'IN_PROGRESS', sessionDate: new Date(), seq: 1 } as PhysicalInvSession;
      mockSessionRepo.findOne.mockResolvedValue(session);
      mockSessionRepo.save.mockResolvedValue({ ...session, status: 'COMPLETED' } as PhysicalInvSession);

      const result = await target.completeSession('2026-03-18', 1, { completedBy: 'admin' } as any);

      expect(result.status).toBe('COMPLETED');
    });
  });

  // ─── applyCount ───
  describe('applyCount', () => {
    it('재고를 찾을 수 없으면 NotFoundException', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        target.applyCount({ items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 10 }] } as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('차이가 0인 항목은 스킵한다', async () => {
      const stock = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 10, reservedQty: 0, company: 'HANES', plant: 'P01' } as MatStock;
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);

      // 매니저의 getRepository를 모킹
      const mockTxRepo = createMock<Repository<StockTransaction>>();
      mockTxRepo.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.getRepository = jest.fn().mockReturnValue(mockTxRepo);

      const result = await target.applyCount({
        items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 10 }],
        createdBy: 'admin',
      } as any);

      expect(result).toHaveLength(0);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  // ─── scanCount ───
  describe('scanCount', () => {
    it('바코드에 해당하는 LOT이 없으면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue(null);

      await expect(
        target.scanCount({
          sessionDate: '2026-03-18', seq: 1,
          locationCode: 'LOC-01', barcode: 'NONE',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('재고가 없으면 NotFoundException', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
      mockMatStockRepo.findOne.mockResolvedValue(null);

      await expect(
        target.scanCount({
          sessionDate: '2026-03-18', seq: 1,
          locationCode: 'LOC-01', barcode: 'MAT-001',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('정상적으로 스캔 카운트를 처리한다', async () => {
      mockMatLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot);
      mockMatStockRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 100 } as MatStock);
      mockCountDetailRepo.findOne.mockResolvedValue(null);
      mockCountDetailRepo.create.mockReturnValue({
        countedQty: 1, countedBy: null,
        sessionDate: new Date(), seq: 1, warehouseCode: 'WH-01',
        itemCode: 'ITEM-001', matUid: 'MAT-001',
      } as PhysicalInvCountDetail);
      mockCountDetailRepo.save.mockResolvedValue({ countedQty: 1 } as PhysicalInvCountDetail);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', itemName: '커넥터A' } as PartMaster);

      const result = await target.scanCount({
        sessionDate: '2026-03-18', seq: 1,
        locationCode: 'LOC-01', barcode: 'MAT-001',
      } as any);

      expect(result.countedQty).toBe(1);
      expect(result.itemName).toBe('커넥터A');
    });
  });

  // ─── findStocks ───
  describe('findStocks', () => {
    it('재고 목록을 반환한다', async () => {
      const stock = { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 100, updatedAt: new Date() } as MatStock;
      mockMatStockRepo.find.mockResolvedValue([stock]);
      mockMatStockRepo.count.mockResolvedValue(1);
      mockPartMasterRepo.find.mockResolvedValue([{ itemCode: 'ITEM-001', itemName: '커넥터A' } as PartMaster]);
      mockMatLotRepo.find.mockResolvedValue([{ matUid: 'MAT-001' } as MatLot]);

      const result = await target.findStocks({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
    });
  });
});
