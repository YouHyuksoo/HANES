import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
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
import { TransactionService } from '../../../shared/transaction.service';

describe('PhysicalInvService', () => {
  let service: PhysicalInvService;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let invAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let partMasterRepo: DeepMocked<Repository<PartMaster>>;
  let sessionRepo: DeepMocked<Repository<PhysicalInvSession>>;
  let countDetailRepo: DeepMocked<Repository<PhysicalInvCountDetail>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    matStockRepo = createMock<Repository<MatStock>>();
    invAdjLogRepo = createMock<Repository<InvAdjLog>>();
    matLotRepo = createMock<Repository<MatLot>>();
    partMasterRepo = createMock<Repository<PartMaster>>();
    sessionRepo = createMock<Repository<PhysicalInvSession>>();
    countDetailRepo = createMock<Repository<PhysicalInvCountDetail>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    dataSource.getRepository.mockReturnValue(createMock<Repository<StockTransaction>>() as any);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);
    queryRunner.manager.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalInvService,
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(InvAdjLog), useValue: invAdjLogRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(PartMaster), useValue: partMasterRepo },
        { provide: getRepositoryToken(PhysicalInvSession), useValue: sessionRepo },
        { provide: getRepositoryToken(PhysicalInvCountDetail), useValue: countDetailRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(PhysicalInvService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scanCount', () => {
    it('blocks when session does not exist', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks when session is not IN_PROGRESS', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks when scanned stock location mismatches request location', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          warehouseCode: 'WH-01',
          locationCode: 'LOC-02',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 5,
          itemName: 'Part 1',
        }),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks when scanned stock warehouse mismatches active session warehouse', async () => {
      const sessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS', warehouseCode: 'WH-SESSION' }),
      };
      sessionRepo.createQueryBuilder.mockReturnValue(sessionQb as any);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          warehouseCode: 'WH-OTHER',
          locationCode: 'LOC-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 5,
          itemName: 'Part 1',
        }),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      await expect(
        service.scanCount({
          sessionDate: '2026-03-18',
          seq: 1,
          locationCode: 'LOC-01',
          barcode: 'MAT-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('applyCount', () => {
    it('blocks when no IN_PROGRESS session exists', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 9 }],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('skips records with no diff through TransactionService', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);
      const txRepo = createMock<Repository<StockTransaction>>();
      txRepo.findOne.mockResolvedValue(null);
      queryRunner.manager.getRepository = jest.fn().mockReturnValue(txRepo);

      const result = await service.applyCount({
        items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 10 }],
        createdBy: 'admin',
      });

      expect(result).toHaveLength(0);
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('blocks when counted qty is lower than reserved qty', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 8,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 7 }],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('filters active session by tenant in applyCount', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyCount(
          {
            items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 7 }],
            createdBy: 'admin',
          },
          'HANES',
          'P01',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(sessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'IN_PROGRESS', company: 'HANES', plant: 'P01' }),
        }),
      );
    });

    it('blocks when request includes duplicated stockId', async () => {
      await expect(
        service.applyCount({
          items: [
            { stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 10 },
            { stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 9 },
          ],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks when stock warehouse is outside active session warehouse scope', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-SESSION',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-OTHER',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);

      await expect(
        service.applyCount({
          items: [{ stockId: 'WH-OTHER::ITEM-001::MAT-001', countedQty: 9 }],
          createdBy: 'admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('handles null reservedQty as zero', async () => {
      sessionRepo.findOne.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
      } as PhysicalInvSession);
      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: null,
          company: 'HANES',
          plant: 'P01',
        } as unknown as MatStock,
      ]);
      const txRepo = createMock<Repository<StockTransaction>>();
      txRepo.findOne.mockResolvedValue(null);
      queryRunner.manager.getRepository = jest.fn().mockReturnValue(txRepo);
      queryRunner.manager.create
        .mockReturnValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockReturnValueOnce({ adjDate: new Date('2026-03-18') } as any);
      queryRunner.manager.save
        .mockResolvedValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockResolvedValueOnce({ adjDate: new Date('2026-03-18') } as any);

      await service.applyCount({
        items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 }],
        createdBy: 'admin',
      });

      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' },
        expect.objectContaining({ qty: 8, availableQty: 8 }),
      );
    });
  });

  describe('workflow', () => {
    it('keeps consistency across start -> scan -> apply -> complete flow', async () => {
      sessionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          sessionDate: new Date('2026-03-18'),
          seq: 1,
          status: 'IN_PROGRESS',
          warehouseCode: 'WH-01',
          company: 'HANES',
          plant: 'P01',
        } as PhysicalInvSession);

      const maxSeqQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxSeq: 0 }),
      };
      const scanSessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          status: 'IN_PROGRESS',
          warehouseCode: 'WH-01',
        }),
      };
      const completeSessionEntity = {
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
      } as PhysicalInvSession;
      const completeSessionQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(completeSessionEntity),
      };
      sessionRepo.createQueryBuilder
        .mockReturnValueOnce(maxSeqQb as any)
        .mockReturnValueOnce(scanSessionQb as any)
        .mockReturnValueOnce(completeSessionQb as any);

      sessionRepo.create.mockReturnValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        status: 'IN_PROGRESS',
        warehouseCode: 'WH-01',
      } as PhysicalInvSession);
      sessionRepo.save
        .mockResolvedValueOnce({
          sessionDate: new Date('2026-03-18'),
          seq: 1,
          status: 'IN_PROGRESS',
          warehouseCode: 'WH-01',
        } as PhysicalInvSession)
        .mockResolvedValueOnce({
          ...completeSessionEntity,
          status: 'COMPLETED',
        } as PhysicalInvSession);

      const stockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          warehouseCode: 'WH-01',
          locationCode: 'LOC-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          itemName: 'Part 1',
        }),
      };
      matStockRepo.createQueryBuilder.mockReturnValue(stockQb as any);

      countDetailRepo.findOne.mockResolvedValue(null);
      countDetailRepo.create.mockReturnValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        countedQty: 1,
      } as PhysicalInvCountDetail);
      countDetailRepo.save.mockResolvedValue({
        sessionDate: new Date('2026-03-18'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        countedQty: 1,
      } as PhysicalInvCountDetail);

      queryRunner.manager.find.mockResolvedValue([
        {
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 0,
          company: 'HANES',
          plant: 'P01',
        } as MatStock,
      ]);
      const txRepo = createMock<Repository<StockTransaction>>();
      txRepo.findOne.mockResolvedValue(null);
      queryRunner.manager.getRepository = jest.fn().mockReturnValue(txRepo);
      queryRunner.manager.create
        .mockReturnValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockReturnValueOnce({ adjDate: new Date('2026-03-18') } as any);
      queryRunner.manager.save
        .mockResolvedValueOnce({ transNo: 'PHC202603180001' } as any)
        .mockResolvedValueOnce({ adjDate: new Date('2026-03-18') } as any);

      const started = await service.startSession(
        { invType: 'MATERIAL', countMonth: '2026-03', warehouseCode: 'WH-01', startedBy: 'admin' },
        'HANES',
        'P01',
      );
      expect(started.status).toBe('IN_PROGRESS');

      const scanned = await service.scanCount(
        { sessionDate: '2026-03-18', seq: 1, locationCode: 'LOC-01', barcode: 'MAT-001' },
        'HANES',
        'P01',
      );
      expect(scanned.countedQty).toBe(1);

      const applied = await service.applyCount(
        { items: [{ stockId: 'WH-01::ITEM-001::MAT-001', countedQty: 8 }], createdBy: 'admin' },
        'HANES',
        'P01',
      );
      expect(applied).toHaveLength(1);

      const completed = await service.completeSession('2026-03-18', 1, { completedBy: 'admin' });
      expect(completed.status).toBe('COMPLETED');
    });
  });
});
