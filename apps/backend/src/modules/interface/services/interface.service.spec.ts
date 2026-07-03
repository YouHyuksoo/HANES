/**
 * @file src/modules/interface/services/interface.service.spec.ts
 * @description InterfaceService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "InterfaceService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InterfaceService } from './interface.service';
import { InterLog } from '../../../entities/inter-log.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { OracleService } from '../../../common/services/oracle.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('InterfaceService', () => {
  let target: InterfaceService;
  let mockLogRepo: DeepMocked<Repository<InterLog>>;
  let mockPartRepo: DeepMocked<Repository<ItemMaster>>;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockOracleService: DeepMocked<OracleService>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockLogRepo = createMock<Repository<InterLog>>();
    mockPartRepo = createMock<Repository<ItemMaster>>();
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockDataSource = createMock<DataSource>();
    mockOracleService = createMock<OracleService>();
    mockTx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterfaceService,
        { provide: getRepositoryToken(InterLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(BomMaster), useValue: mockBomRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
        { provide: OracleService, useValue: mockOracleService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<InterfaceService>(InterfaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAllLogs ───
  describe('findAllLogs', () => {
    it('should return paginated logs', async () => {
      // Arrange
      const transDate = new Date('2026-06-10T00:00:00.000Z');
      const logs = [{ transDate, seq: 1 }] as InterLog[];
      mockLogRepo.find.mockResolvedValue(logs);
      mockLogRepo.count.mockResolvedValue(1);

      // Act
      const result = await target.findAllLogs({ page: 1, limit: 10 } as any);

      // Assert
      expect(result).toEqual({
        data: [{ transDate, seq: 1, id: '2026-06-10T00:00:00.000Z/1' }],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('재시도 URL에서 사용할 복합 id를 transDate/seq로 함께 반환한다', async () => {
      const transDate = new Date('2026-06-10T00:00:00.000Z');
      mockLogRepo.find.mockResolvedValue([{ transDate, seq: 7, status: 'FAIL' }] as InterLog[]);
      mockLogRepo.count.mockResolvedValue(1);

      const result = await target.findAllLogs({ page: 1, limit: 10 } as any);

      expect(result.data[0]).toEqual(expect.objectContaining({
        id: '2026-06-10T00:00:00.000Z/7',
        transDate,
        seq: 7,
      }));
    });
  });

  // ─── findLogById ───
  describe('findLogById', () => {
    it('should return log when found', async () => {
      // Arrange
      const log = { transDate: new Date(), seq: 1 } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);

      // Act
      const result = await target.findLogById(new Date(), 1);

      // Assert
      expect(result).toEqual(log);
    });

    it('should lookup log within requested tenant', async () => {
      const transDate = new Date('2026-05-23');
      const log = { transDate, seq: 1, company: 'C1', plant: 'P1' } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);

      await target.findLogById(transDate, 1, 'C1', 'P1');

      expect(mockLogRepo.findOne).toHaveBeenCalledWith({
        where: { transDate, seq: 1, company: 'C1', plant: 'P1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockLogRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findLogById(new Date(), 999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createLog ───
  describe('createLog', () => {
    it('should create log with PENDING status inside a transaction without locking the table', async () => {
      // Arrange
      const log = { transDate: new Date(), seq: 1, status: 'PENDING' } as InterLog;
      const manager = {
        query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        create: jest.fn().mockReturnValue(log),
        save: jest.fn().mockResolvedValue(log),
      };
      mockTx.run.mockImplementation(async (callback) => callback({ manager } as any));

      // Act
      const result = await target.createLog({
        direction: 'IN',
        messageType: 'JOB_ORDER',
      } as any);

      // Assert
      expect(result.status).toBe('PENDING');
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(manager.query).toHaveBeenCalledWith(
        'SELECT SEQ_INTER_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
      );
      expect(manager.query).not.toHaveBeenCalledWith(
        expect.stringContaining('LOCK TABLE'),
      );
      expect(manager.create).toHaveBeenCalledWith(InterLog, expect.objectContaining({ seq: 1, status: 'PENDING' }));
      expect(manager.save).toHaveBeenCalledWith(InterLog, log);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should persist tenant columns on new logs', async () => {
      const log = { transDate: new Date(), seq: 1, status: 'PENDING', company: 'C1', plant: 'P1' } as InterLog;
      const manager = {
        query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        create: jest.fn().mockReturnValue(log),
        save: jest.fn().mockResolvedValue(log),
      };
      mockTx.run.mockImplementation(async (callback) => callback({ manager } as any));

      await target.createLog({
        direction: 'IN',
        messageType: 'JOB_ORDER',
      } as any, 'C1', 'P1');

      expect(manager.create).toHaveBeenCalledWith(
        InterLog,
        expect.objectContaining({ company: 'C1', plant: 'P1' }),
      );
    });

    it('should allocate INTER_LOGS seq from Oracle sequence', async () => {
      const log = { transDate: new Date(), seq: 1, status: 'PENDING', company: 'C1', plant: 'P1' } as InterLog;
      const manager = {
        query: jest.fn().mockResolvedValue([{ nextSeq: 1 }]),
        create: jest.fn().mockReturnValue(log),
        save: jest.fn().mockResolvedValue(log),
      };
      mockTx.run.mockImplementation(async (callback) => callback({ manager } as any));

      await target.createLog({
        direction: 'IN',
        messageType: 'JOB_ORDER',
      } as any, 'C1', 'P1');

      expect(manager.query).toHaveBeenCalledWith(
        'SELECT SEQ_INTER_LOGS.NEXTVAL AS "nextSeq" FROM DUAL',
      );
    });
  });

  // ─── updateLogStatus ───
  describe('updateLogStatus', () => {
    it('should update log status', async () => {
      // Arrange
      const log = { transDate: new Date(), seq: 1, status: 'PENDING' } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);
      mockLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updateLogStatus(new Date(), 1, 'SUCCESS');

      // Assert
      expect(mockLogRepo.update).toHaveBeenCalled();
    });

    it('should update log status within requested tenant', async () => {
      const transDate = new Date('2026-05-23');
      const log = { transDate, seq: 1, status: 'PENDING', company: 'C1', plant: 'P1' } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);
      mockLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.updateLogStatus(transDate, 1, 'SUCCESS', undefined, 'C1', 'P1');

      expect(mockLogRepo.update).toHaveBeenCalledWith(
        { transDate, seq: 1, company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });
  });

  // ─── retryLog ───
  describe('retryLog', () => {
    it('should throw BadRequestException when status is not FAIL', async () => {
      // Arrange
      const log = { transDate: new Date(), seq: 1, status: 'PENDING' } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);

      // Act & Assert
      await expect(target.retryLog(new Date(), 1)).rejects.toThrow(BadRequestException);
    });

    it('should retry only the requested tenant log', async () => {
      const transDate = new Date('2026-05-23');
      const log = {
        transDate,
        seq: 1,
        status: 'FAIL',
        retryCount: 0,
        direction: 'IN',
        company: 'C1',
        plant: 'P1',
      } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);
      mockLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // queryBuilder chain을 명시적으로 mock — DeepMocked는 호출마다 새 인스턴스를 줄 수 있다.
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.retryLog(transDate, 1, 'C1', 'P1');

      // RETRY 단계: queryBuilder로 원자적 retryCount 증가
      expect(qb.update).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'RETRY',
          retryCount: expect.any(Function),
        }),
      );
      // set() 인자의 retryCount 함수가 RAW SQL fragment를 반환하는지 검증
      const setArg = qb.set.mock.calls[0][0] as { retryCount: () => string };
      // NULL+1=NULL 회귀 방지를 위해 NVL 로 보호된 raw SQL.
      expect(setArg.retryCount()).toBe('NVL("RETRY_COUNT", 0) + 1');
      expect(qb.where).toHaveBeenCalledWith({
        transDate,
        seq: 1,
        company: 'C1',
        plant: 'P1',
      });

      // SUCCESS 단계: 기존대로 repository.update
      expect(mockLogRepo.update).toHaveBeenCalledWith(
        { transDate, seq: 1, company: 'C1', plant: 'P1' },
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });

    it('retryCount 갱신 시 affected 가 0 이면 InternalServerErrorException 을 던져야 한다', async () => {
      // pk 의 transDate 정밀도 mismatch 등으로 silent 0-rows-affected 가 되던 회귀 방지.
      const transDate = new Date('2026-05-23');
      const log = {
        transDate,
        seq: 1,
        status: 'FAIL',
        retryCount: 0,
        direction: 'IN',
      } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await expect(target.retryLog(transDate, 1)).rejects.toThrow('재시도 카운트 갱신');
    });

    it('should increment retryCount atomically via raw SQL fragment', async () => {
      // race condition 회귀 방지: retryCount는 read-modify-write 가 아닌 컬럼 증가식이어야 한다.
      const transDate = new Date('2026-05-23');
      const log = {
        transDate,
        seq: 1,
        status: 'FAIL',
        retryCount: 5,
        direction: 'IN',
      } as InterLog;
      mockLogRepo.findOne.mockResolvedValue(log);

      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockLogRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.retryLog(transDate, 1);

      const setArg = qb.set.mock.calls[0][0] as { retryCount: () => string };
      // log.retryCount + 1 같은 JS 리터럴이 아닌, DB 컬럼 식이어야 함
      expect(setArg.retryCount).toBeInstanceOf(Function);
      expect(setArg.retryCount()).not.toBe(6);
      expect(setArg.retryCount()).toMatch(/RETRY_COUNT/);
    });
  });

  describe('bulkRetry', () => {
    it('should pass tenant to each retry call', async () => {
      const transDate = new Date('2026-05-23');
      jest.spyOn(target, 'retryLog').mockResolvedValue({ transDate, seq: 1 } as InterLog);

      await target.bulkRetry([{ transDate, seq: 1 }], 'C1', 'P1');

      expect(target.retryLog).toHaveBeenCalledWith(transDate, 1, 'C1', 'P1');
    });
  });

  // ─── getSummary ───
  describe('getSummary', () => {
    it('should return summary with counts', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.select.mockReturnThis();
      qb.addSelect.mockReturnThis();
      qb.groupBy.mockReturnThis();
      qb.setParameter.mockReturnThis();
      qb.getRawMany.mockResolvedValue([]);
      qb.getRawOne.mockResolvedValue({ total: 10, todayCount: 1, pending: 2, failed: 3 });
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.getSummary();

      // Assert
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('pending');
      expect(result).toHaveProperty('failed');
    });

    it('should aggregate only requested tenant logs', async () => {
      const statusQb = createMock<any>();
      statusQb.select.mockReturnThis();
      statusQb.addSelect.mockReturnThis();
      statusQb.setParameter.mockReturnThis();
      statusQb.andWhere.mockReturnThis();
      statusQb.getRawOne.mockResolvedValue({ total: 1, todayCount: 1, pending: 0, failed: 0 });

      const typeQb = createMock<any>();
      typeQb.select.mockReturnThis();
      typeQb.addSelect.mockReturnThis();
      typeQb.groupBy.mockReturnThis();
      typeQb.andWhere.mockReturnThis();
      typeQb.getRawMany.mockResolvedValue([]);

      const directionQb = createMock<any>();
      directionQb.select.mockReturnThis();
      directionQb.addSelect.mockReturnThis();
      directionQb.groupBy.mockReturnThis();
      directionQb.andWhere.mockReturnThis();
      directionQb.getRawMany.mockResolvedValue([]);

      mockLogRepo.createQueryBuilder
        .mockReturnValueOnce(statusQb)
        .mockReturnValueOnce(typeQb)
        .mockReturnValueOnce(directionQb);

      await target.getSummary('C1', 'P1');

      for (const qb of [statusQb, typeQb, directionQb]) {
        expect(qb.andWhere).toHaveBeenCalledWith('log.company = :company', { company: 'C1' });
        expect(qb.andWhere).toHaveBeenCalledWith('log.plant = :plant', { plant: 'P1' });
      }
    });
  });

  // ─── getFailedLogs ───
  describe('getFailedLogs', () => {
    it('should return failed logs', async () => {
      // Arrange
      const logs = [{ seq: 1, status: 'FAIL' }] as InterLog[];
      mockLogRepo.find.mockResolvedValue(logs);

      // Act
      const result = await target.getFailedLogs();

      // Assert
      expect(result).toEqual(logs);
    });

    it('should return failed logs within requested tenant', async () => {
      mockLogRepo.find.mockResolvedValue([]);

      await target.getFailedLogs('C1', 'P1');

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        where: { status: 'FAIL', company: 'C1', plant: 'P1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });
  });

  // ─── getRecentLogs ───
  describe('getRecentLogs', () => {
    it('should return recent logs', async () => {
      // Arrange
      const logs = [{ seq: 1 }] as InterLog[];
      mockLogRepo.find.mockResolvedValue(logs);

      // Act
      const result = await target.getRecentLogs(5);

      // Assert
      expect(result).toEqual(logs);
    });

    it('should return recent logs within requested tenant', async () => {
      mockLogRepo.find.mockResolvedValue([]);

      await target.getRecentLogs(5, 'C1', 'P1');

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        where: { company: 'C1', plant: 'P1' },
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });
  });

  // ─── scheduledSyncBom ───
  describe('scheduledSyncBom', () => {
    it('should return 0 when no pending logs', async () => {
      // Arrange
      mockLogRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.scheduledSyncBom();

      // Assert
      expect(result).toEqual({ affectedRows: 0 });
    });

    it('should retry only pending BOM logs in the scheduler tenant', async () => {
      mockLogRepo.find.mockResolvedValue([
        {
          transDate: new Date('2026-05-23'),
          seq: 1,
          status: 'PENDING',
          messageType: 'BOM_SYNC',
          payload: JSON.stringify({ items: [{ parentItemCode: 'FG-001', childItemCode: 'RM-001' }] }),
          company: 'C1',
          plant: 'P1',
        } as InterLog,
      ]);
      jest.spyOn(target, 'syncBom').mockResolvedValue({ processed: 1 } as any);

      await target.scheduledSyncBom('C1', 'P1');

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        where: { status: 'PENDING', messageType: 'BOM_SYNC', company: 'C1', plant: 'P1' },
        order: { createdAt: 'ASC' },
        take: 50,
      });
      expect(target.syncBom).toHaveBeenCalledWith(
        [{ parentItemCode: 'FG-001', childItemCode: 'RM-001' }],
        'C1',
        'P1',
      );
    });
  });

  // ─── scheduledBulkRetry ───
  describe('scheduledBulkRetry', () => {
    it('should return 0 when no failed logs', async () => {
      // Arrange
      mockLogRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.scheduledBulkRetry();

      // Assert
      expect(result).toEqual({ affectedRows: 0 });
    });

    it('should retry only failed logs in the scheduler tenant', async () => {
      const transDate = new Date('2026-05-24');
      jest.spyOn(target, 'getFailedLogs').mockResolvedValue([{ transDate, seq: 3 } as InterLog]);
      jest.spyOn(target, 'bulkRetry').mockResolvedValue([{ transDate, seq: 3, success: true }]);

      const result = await target.scheduledBulkRetry('C1', 'P1');

      expect(target.getFailedLogs).toHaveBeenCalledWith('C1', 'P1');
      expect(target.bulkRetry).toHaveBeenCalledWith([{ transDate, seq: 3 }], 'C1', 'P1');
      expect(result).toEqual({ affectedRows: 1 });
    });
  });

  describe('tenant-scoped inbound processing', () => {
    beforeEach(() => {
      jest.spyOn(target, 'createLog').mockResolvedValue({ transDate: new Date('2026-01-01'), seq: 1 } as InterLog);
      jest.spyOn(target, 'updateLogStatus').mockResolvedValue({ transDate: new Date('2026-01-01'), seq: 1 } as InterLog);
    });

    it('receives job order using part lookup and created job order within tenant', async () => {
      mockPartRepo.findOne.mockResolvedValue({ itemCode: 'FG-001' } as ItemMaster);
      mockJobOrderRepo.create.mockImplementation((value) => value as JobOrder);
      mockJobOrderRepo.save.mockImplementation(async (value) => value as JobOrder);

      await target.receiveJobOrder({
        erpOrderNo: 'ERP-001',
        itemCode: 'FG-001',
        planQty: 10,
      } as any, 'C1', 'P1');

      expect(mockPartRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'FG-001', company: 'C1', plant: 'P1' },
      });
      expect(mockJobOrderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderNo: 'ERP-001', itemCode: 'FG-001', company: 'C1', plant: 'P1' }),
      );
    });

    it('syncs bom using part and existing bom lookup within tenant', async () => {
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'FG-001' },
        { itemCode: 'RM-001' },
      ] as ItemMaster[]);
      mockBomRepo.find.mockResolvedValue([]);
      mockBomRepo.create.mockImplementation((value) => value as BomMaster);
      mockBomRepo.save.mockResolvedValue({ parentItemCode: 'FG-001', childItemCode: 'RM-001' } as BomMaster);

      await target.syncBom([{ parentItemCode: 'FG-001', childItemCode: 'RM-001', qtyPer: 2 } as any], 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockBomRepo.find).toHaveBeenCalledWith({
        where: [{ parentItemCode: 'FG-001', childItemCode: 'RM-001', company: 'C1', plant: 'P1' }],
      });
      expect(mockBomRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentItemCode: 'FG-001', childItemCode: 'RM-001', company: 'C1', plant: 'P1', validFrom: expect.any(Date) }),
      );
    });

    it('syncs parts using existing part lookup and updates within tenant', async () => {
      mockPartRepo.find.mockResolvedValue([{ itemCode: 'FG-001' }] as ItemMaster[]);
      mockPartRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.syncPart([{ itemCode: 'FG-001', itemName: 'Finished', itemType: 'FINISHED' } as any], 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
      });
      expect(mockPartRepo.update).toHaveBeenCalledWith(
        { itemCode: 'FG-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ itemName: 'Finished' }),
      );
    });
  });

  describe('tenant-scoped outbound processing', () => {
    beforeEach(() => {
      jest.spyOn(target, 'createLog').mockResolvedValue({ transDate: new Date('2026-01-01'), seq: 1 } as InterLog);
      jest.spyOn(target, 'updateLogStatus').mockResolvedValue({ transDate: new Date('2026-01-01'), seq: 1 } as InterLog);
    });

    it('marks only the tenant-scoped job order as ERP synced after sending production result', async () => {
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as JobOrder);
      mockJobOrderRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.sendProdResult({ orderNo: 'JO-001', goodQty: 10, defectQty: 0 } as any, 'C1', 'P1');

      expect(mockJobOrderRepo.findOne).toHaveBeenCalledWith({
        where: { orderNo: 'JO-001', company: 'C1', plant: 'P1' },
      });
      expect(mockJobOrderRepo.update).toHaveBeenCalledWith(
        { orderNo: 'JO-001', company: 'C1', plant: 'P1' },
        { erpSyncYn: 'Y' },
      );
    });
  });

  // ─── processOutbound ───
  describe('processOutbound', () => {
    it('does not fail randomly during outbound processing', async () => {
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      try {
        await expect(
          (target as any).processOutbound('PROD_RESULT', { orderNo: 'WO-001' }),
        ).resolves.toBe(true);
        expect(randomSpy).not.toHaveBeenCalled();
      } finally {
        randomSpy.mockRestore();
      }
    });
  });
});
