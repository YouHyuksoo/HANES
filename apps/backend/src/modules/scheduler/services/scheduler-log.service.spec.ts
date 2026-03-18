/**
 * @file src/modules/scheduler/services/scheduler-log.service.spec.ts
 * @description SchedulerLogService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "SchedulerLogService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulerLogService } from './scheduler-log.service';
import { SchedulerLog } from '../../../entities/scheduler-log.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SchedulerLogService', () => {
  let target: SchedulerLogService;
  let mockLogRepo: DeepMocked<Repository<SchedulerLog>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockLogRepo = createMock<Repository<SchedulerLog>>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerLogService,
        { provide: getRepositoryToken(SchedulerLog), useValue: mockLogRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SchedulerLogService>(SchedulerLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateLogId ───
  describe('generateLogId', () => {
    it('should return next log ID', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([{ nextId: 5 }]);

      // Act
      const result = await target.generateLogId('COMP', 'PLANT');

      // Assert
      expect(result).toBe(5);
    });
  });

  // ─── createLog ───
  describe('createLog', () => {
    it('should create log with RUNNING status', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([{ nextId: 1 }]);
      const log = { logId: 1, status: 'RUNNING', jobCode: 'JOB1' } as SchedulerLog;
      mockLogRepo.create.mockReturnValue(log);
      mockLogRepo.save.mockResolvedValue(log);

      // Act
      const result = await target.createLog({
        company: 'COMP',
        plantCd: 'PLANT',
        jobCode: 'JOB1',
      });

      // Assert
      expect(result.status).toBe('RUNNING');
      expect(result.logId).toBe(1);
    });
  });

  // ─── updateLog ───
  describe('updateLog', () => {
    it('should update log fields', async () => {
      // Arrange
      mockLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.updateLog('COMP', 'PLANT', 1, {
        status: 'SUCCESS',
        endTime: new Date(),
        durationMs: 1000,
      });

      // Assert
      expect(mockLogRepo.update).toHaveBeenCalledWith(
        { company: 'COMP', plantCd: 'PLANT', logId: 1 },
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated logs', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getCount.mockResolvedValue(1);
      qb.getMany.mockResolvedValue([{ logId: 1 }]);
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.findAll({ page: 1, limit: 50 } as any, 'COMP', 'PLANT');

      // Assert
      expect(result.total).toBe(1);
    });
  });

  // ─── getSummary ───
  describe('getSummary', () => {
    it('should return dashboard summary', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ status: 'SUCCESS', cnt: '5' }, { status: 'FAIL', cnt: '1' }]) // today
        .mockResolvedValueOnce([{ dt: '2026-03-18', status: 'SUCCESS', cnt: '5' }]) // trend
        .mockResolvedValueOnce([{ jobCode: 'JOB1', status: 'SUCCESS', cnt: '5' }]); // ratio

      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getMany.mockResolvedValue([]);
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);
      mockLogRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.getSummary('COMP', 'PLANT');

      // Assert
      expect(result.todayTotal).toBe(6);
      expect(result.todaySuccess).toBe(5);
      expect(result.todayFail).toBe(1);
      expect(result.successRate).toBeCloseTo(83.3, 0);
    });
  });

  // ─── recoverStaleRunning ───
  describe('recoverStaleRunning', () => {
    it('should recover stale logs', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue({ rowsAffected: 3 });

      // Act
      const result = await target.recoverStaleRunning('COMP', 'PLANT');

      // Assert
      expect(result).toBe(3);
    });

    it('should return 0 when no stale logs', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue({ rowsAffected: 0 });

      // Act
      const result = await target.recoverStaleRunning('COMP', 'PLANT');

      // Assert
      expect(result).toBe(0);
    });
  });
});
