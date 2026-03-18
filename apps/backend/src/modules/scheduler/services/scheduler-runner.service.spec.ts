/**
 * @file src/modules/scheduler/services/scheduler-runner.service.spec.ts
 * @description SchedulerRunnerService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "SchedulerRunnerService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRunnerService } from './scheduler-runner.service';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SchedulerLog } from '../../../entities/scheduler-log.entity';
import { ExecutorFactory } from '../executors/executor.factory';
import { SchedulerLogService } from './scheduler-log.service';
import { SchedulerNotiService } from './scheduler-noti.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SchedulerRunnerService', () => {
  let target: SchedulerRunnerService;
  let mockExecutorFactory: DeepMocked<ExecutorFactory>;
  let mockLogService: DeepMocked<SchedulerLogService>;
  let mockNotiService: DeepMocked<SchedulerNotiService>;
  let mockJobRepo: DeepMocked<Repository<SchedulerJob>>;
  let mockLogRepo: DeepMocked<Repository<SchedulerLog>>;

  beforeEach(async () => {
    mockExecutorFactory = createMock<ExecutorFactory>();
    mockLogService = createMock<SchedulerLogService>();
    mockNotiService = createMock<SchedulerNotiService>();
    mockJobRepo = createMock<Repository<SchedulerJob>>();
    mockLogRepo = createMock<Repository<SchedulerLog>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerRunnerService,
        { provide: ExecutorFactory, useValue: mockExecutorFactory },
        { provide: SchedulerLogService, useValue: mockLogService },
        { provide: SchedulerNotiService, useValue: mockNotiService },
        { provide: getRepositoryToken(SchedulerJob), useValue: mockJobRepo },
        { provide: getRepositoryToken(SchedulerLog), useValue: mockLogRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SchedulerRunnerService>(SchedulerRunnerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockJob: SchedulerJob = {
    company: 'COMP',
    plantCd: 'PLANT',
    jobCode: 'JOB1',
    execType: 'SERVICE',
    timeoutSec: 30,
    maxRetry: 0,
    cronExpr: '0 * * * *',
  } as SchedulerJob;

  // ─── execute ───
  describe('execute', () => {
    it('should skip when another execution is running', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getCount.mockResolvedValue(1); // running count > 0
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      mockLogService.createLog.mockResolvedValue({ logId: 1 } as SchedulerLog);

      // Act
      await target.execute(mockJob);

      // Assert
      expect(mockLogService.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SKIPPED' }),
      );
    });

    it('should execute successfully', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getCount.mockResolvedValue(0); // no running
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      const log = { logId: 1, company: 'COMP', plantCd: 'PLANT' } as SchedulerLog;
      mockLogService.createLog.mockResolvedValue(log);

      const mockExecutor = { execute: jest.fn().mockResolvedValue({ message: 'OK' }) };
      mockExecutorFactory.get.mockReturnValue(mockExecutor as any);

      mockLogService.updateLog.mockResolvedValue();
      mockJobRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.execute(mockJob);

      // Assert
      expect(mockLogService.updateLog).toHaveBeenCalledWith(
        'COMP', 'PLANT', 1,
        expect.objectContaining({ status: 'SUCCESS' }),
      );
    });

    it('should handle timeout', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getCount.mockResolvedValue(0);
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      const log = { logId: 1, company: 'COMP', plantCd: 'PLANT' } as SchedulerLog;
      mockLogService.createLog.mockResolvedValue(log);

      const mockExecutor = {
        execute: jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000))),
      };
      mockExecutorFactory.get.mockReturnValue(mockExecutor as any);

      const quickJob = { ...mockJob, timeoutSec: 0.01 }; // very short timeout

      mockLogService.updateLog.mockResolvedValue();
      mockJobRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockLogRepo.manager = { query: jest.fn().mockResolvedValue([]) } as any;
      mockNotiService.createNotification.mockResolvedValue({} as any);

      // Act
      await target.execute(quickJob as SchedulerJob);

      // Assert
      expect(mockLogService.updateLog).toHaveBeenCalledWith(
        'COMP', 'PLANT', 1,
        expect.objectContaining({ status: 'TIMEOUT' }),
      );
    });

    it('should handle execution failure', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getCount.mockResolvedValue(0);
      mockLogRepo.createQueryBuilder.mockReturnValue(qb);

      const log = { logId: 1, company: 'COMP', plantCd: 'PLANT' } as SchedulerLog;
      mockLogService.createLog.mockResolvedValue(log);

      const mockExecutor = {
        execute: jest.fn().mockRejectedValue(new Error('Execution failed')),
      };
      mockExecutorFactory.get.mockReturnValue(mockExecutor as any);

      mockLogService.updateLog.mockResolvedValue();
      mockJobRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockLogRepo.manager = { query: jest.fn().mockResolvedValue([]) } as any;
      mockNotiService.createNotification.mockResolvedValue({} as any);

      // Act
      await target.execute(mockJob);

      // Assert
      expect(mockLogService.updateLog).toHaveBeenCalledWith(
        'COMP', 'PLANT', 1,
        expect.objectContaining({ status: 'FAIL' }),
      );
    });
  });
});
