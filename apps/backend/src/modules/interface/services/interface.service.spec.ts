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
import { PartMaster } from '../../../entities/part-master.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('InterfaceService', () => {
  let target: InterfaceService;
  let mockLogRepo: DeepMocked<Repository<InterLog>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockLogRepo = createMock<Repository<InterLog>>();
    mockPartRepo = createMock<Repository<PartMaster>>();
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterfaceService,
        { provide: getRepositoryToken(InterLog), useValue: mockLogRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
        { provide: getRepositoryToken(BomMaster), useValue: mockBomRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: DataSource, useValue: mockDataSource },
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
      const logs = [{ seq: 1 }] as InterLog[];
      mockLogRepo.find.mockResolvedValue(logs);
      mockLogRepo.count.mockResolvedValue(1);

      // Act
      const result = await target.findAllLogs({ page: 1, limit: 10 } as any);

      // Assert
      expect(result).toEqual({ data: logs, total: 1, page: 1, limit: 10 });
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

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockLogRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findLogById(new Date(), 999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createLog ───
  describe('createLog', () => {
    it('should create log with PENDING status', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([{ nextSeq: 1 }]);
      const log = { transDate: new Date(), seq: 1, status: 'PENDING' } as InterLog;
      mockLogRepo.create.mockReturnValue(log);
      mockLogRepo.save.mockResolvedValue(log);

      // Act
      const result = await target.createLog({
        direction: 'IN',
        messageType: 'JOB_ORDER',
      } as any);

      // Assert
      expect(result.status).toBe('PENDING');
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
  });

  // ─── getSummary ───
  describe('getSummary', () => {
    it('should return summary with counts', async () => {
      // Arrange
      mockLogRepo.count.mockResolvedValue(10);
      const qb = createMock<any>();
      qb.select.mockReturnThis();
      qb.addSelect.mockReturnThis();
      qb.groupBy.mockReturnThis();
      qb.getRawMany.mockResolvedValue([]);
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.getSummary();

      // Assert
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('pending');
      expect(result).toHaveProperty('failed');
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
  });
});
