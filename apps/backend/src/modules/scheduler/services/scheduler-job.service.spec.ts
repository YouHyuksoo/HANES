/**
 * @file src/modules/scheduler/services/scheduler-job.service.spec.ts
 * @description SchedulerJobService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "SchedulerJobService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SchedulerJobService } from './scheduler-job.service';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SchedulerRunnerService } from './scheduler-runner.service';
import { SchedulerLogService } from './scheduler-log.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SchedulerJobService', () => {
  let target: SchedulerJobService;
  let mockJobRepo: DeepMocked<Repository<SchedulerJob>>;
  let mockSchedulerRegistry: DeepMocked<SchedulerRegistry>;
  let mockRunnerService: DeepMocked<SchedulerRunnerService>;
  let mockLogService: DeepMocked<SchedulerLogService>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockJobRepo = createMock<Repository<SchedulerJob>>();
    mockSchedulerRegistry = createMock<SchedulerRegistry>();
    mockRunnerService = createMock<SchedulerRunnerService>();
    mockLogService = createMock<SchedulerLogService>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerJobService,
        { provide: getRepositoryToken(SchedulerJob), useValue: mockJobRepo },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
        { provide: SchedulerRunnerService, useValue: mockRunnerService },
        { provide: SchedulerLogService, useValue: mockLogService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SchedulerJobService>(SchedulerJobService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated jobs', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getCount.mockResolvedValue(1);
      qb.getMany.mockResolvedValue([{ jobCode: 'JOB1' }]);
      mockJobRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.findAll({ page: 1, limit: 50 } as any, 'COMP', 'PLANT');

      // Assert
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─── findOne ───
  describe('findOne', () => {
    it('should return job when found', async () => {
      // Arrange
      const job = { jobCode: 'JOB1', company: 'COMP', plantCd: 'PLANT' } as SchedulerJob;
      mockJobRepo.findOne.mockResolvedValue(job);

      // Act
      const result = await target.findOne('JOB1', 'COMP', 'PLANT');

      // Assert
      expect(result).toEqual(job);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockJobRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findOne('NONE', 'COMP', 'PLANT')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create job with isActive N', async () => {
      // Arrange
      const dto = { jobCode: 'JOB1', cronExpr: '0 * * * *', execType: 'SERVICE' } as any;
      const entity = { ...dto, isActive: 'N' } as SchedulerJob;
      mockJobRepo.create.mockReturnValue(entity);
      mockJobRepo.save.mockResolvedValue(entity);

      // Act
      const result = await target.create(dto, 'COMP', 'PLANT', 'user');

      // Assert
      expect(result.isActive).toBe('N');
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update job and re-register cron when active', async () => {
      // Arrange
      const job = { jobCode: 'JOB1', company: 'COMP', plantCd: 'PLANT', isActive: 'Y', cronExpr: '0 * * * *' } as SchedulerJob;
      mockJobRepo.findOne.mockResolvedValue(job);
      mockJobRepo.save.mockResolvedValue(job);
      // getCronJob throws when not found - that's fine for unregister
      mockSchedulerRegistry.getCronJob.mockImplementation(() => { throw new Error('not found'); });

      // Act
      const result = await target.update('JOB1', { cronExpr: '*/5 * * * *' } as any, 'COMP', 'PLANT', 'user');

      // Assert
      expect(mockJobRepo.save).toHaveBeenCalled();
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should remove job and unregister cron', async () => {
      // Arrange
      const job = { jobCode: 'JOB1', company: 'COMP', plantCd: 'PLANT' } as SchedulerJob;
      mockJobRepo.findOne.mockResolvedValue(job);
      mockJobRepo.remove.mockResolvedValue(job);
      mockSchedulerRegistry.getCronJob.mockImplementation(() => { throw new Error('not found'); });

      // Act
      await target.remove('JOB1', 'COMP', 'PLANT');

      // Assert
      expect(mockJobRepo.remove).toHaveBeenCalledWith(job);
    });
  });

  // ─── toggle ───
  describe('toggle', () => {
    it('should toggle from Y to N', async () => {
      // Arrange
      const job = { jobCode: 'JOB1', company: 'COMP', plantCd: 'PLANT', isActive: 'Y', cronExpr: '0 * * * *' } as SchedulerJob;
      mockJobRepo.findOne.mockResolvedValue(job);
      mockJobRepo.save.mockImplementation(async (entity) => entity as SchedulerJob);
      mockSchedulerRegistry.getCronJob.mockImplementation(() => { throw new Error('not found'); });

      // Act
      const result = await target.toggle('JOB1', 'COMP', 'PLANT', 'user');

      // Assert
      expect(result.isActive).toBe('N');
    });

    it('should toggle from N to Y', async () => {
      // Arrange
      const job = { jobCode: 'JOB1', company: 'COMP', plantCd: 'PLANT', isActive: 'N', cronExpr: '0 * * * *' } as SchedulerJob;
      mockJobRepo.findOne.mockResolvedValue(job);
      mockJobRepo.save.mockImplementation(async (entity) => entity as SchedulerJob);
      mockSchedulerRegistry.getCronJob.mockImplementation(() => { throw new Error('not found'); });

      // Act
      const result = await target.toggle('JOB1', 'COMP', 'PLANT', 'user');

      // Assert
      expect(result.isActive).toBe('Y');
    });
  });

  // ─── runNow ───
  describe('runNow', () => {
    it('should call runner execute', async () => {
      // Arrange
      const job = { jobCode: 'JOB1', company: 'COMP', plantCd: 'PLANT' } as SchedulerJob;
      mockJobRepo.findOne.mockResolvedValue(job);
      mockRunnerService.execute.mockResolvedValue();

      // Act
      await target.runNow('JOB1', 'COMP', 'PLANT');

      // Assert
      expect(mockRunnerService.execute).toHaveBeenCalledWith(job);
    });
  });

  // ─── onModuleInit ───
  describe('onModuleInit', () => {
    it('should recover stale logs and register active jobs', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([{ company: 'COMP', plantCd: 'PLANT' }]);
      mockLogService.recoverStaleRunning.mockResolvedValue(0);
      mockJobRepo.find.mockResolvedValue([]);

      // Act
      await target.onModuleInit();

      // Assert
      expect(mockLogService.recoverStaleRunning).toHaveBeenCalledWith('COMP', 'PLANT');
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert - should not throw
      await expect(target.onModuleInit()).resolves.not.toThrow();
    });
  });
});
