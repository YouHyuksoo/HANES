/**
 * @file src/modules/system/services/activity-log.service.spec.ts
 * @description ActivityLogService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "ActivityLogService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog } from '../../../entities/activity-log.entity';
import { SysConfigService } from './sys-config.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ActivityLogService', () => {
  let target: ActivityLogService;
  let mockRepo: DeepMocked<Repository<ActivityLog>>;
  let mockSysConfigService: DeepMocked<SysConfigService>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<ActivityLog>>();
    mockSysConfigService = createMock<SysConfigService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: getRepositoryToken(ActivityLog), useValue: mockRepo },
        { provide: SysConfigService, useValue: mockSysConfigService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ActivityLogService>(ActivityLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── logActivity ───
  describe('logActivity', () => {
    const params = {
      userId: 'user@test.com',
      activityType: 'LOGIN',
      pagePath: '/dashboard',
    };

    it('should save log when activity logging is enabled', async () => {
      // Arrange
      mockSysConfigService.isEnabled.mockResolvedValue(true);
      mockRepo.create.mockReturnValue({ ...params } as any);
      mockRepo.save.mockResolvedValue({ ...params } as any);

      // Act
      await target.logActivity(params);

      // Assert
      expect(mockSysConfigService.isEnabled).toHaveBeenCalledWith('ENABLE_ACTIVITY_LOG');
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should skip saving when activity logging is disabled', async () => {
      // Arrange
      mockSysConfigService.isEnabled.mockResolvedValue(false);

      // Act
      await target.logActivity(params);

      // Assert
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should not throw when save fails (fire-and-forget)', async () => {
      // Arrange
      mockSysConfigService.isEnabled.mockResolvedValue(true);
      mockRepo.create.mockReturnValue({} as any);
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert - should not throw
      await expect(target.logActivity(params)).resolves.not.toThrow();
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated results', async () => {
      // Arrange
      const logs = [{ activityType: 'LOGIN' }] as ActivityLog[];
      mockRepo.findAndCount.mockResolvedValue([logs, 1]);

      // Act
      const result = await target.findAll({ page: 1, limit: 20 } as any);

      // Assert
      expect(result).toEqual({ data: logs, total: 1, page: 1, limit: 20 });
    });

    it('should apply date range filter when both dates provided', async () => {
      // Arrange
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await target.findAll({
        page: 1,
        limit: 20,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      } as any, 'COMPANY', 'PLANT');

      // Assert
      expect(mockRepo.findAndCount).toHaveBeenCalled();
    });

    it('should apply only startDate filter', async () => {
      // Arrange
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await target.findAll({
        page: 1,
        limit: 20,
        startDate: '2026-01-01',
      } as any);

      // Assert
      expect(mockRepo.findAndCount).toHaveBeenCalled();
    });

    it('should apply only endDate filter', async () => {
      // Arrange
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await target.findAll({
        page: 1,
        limit: 20,
        endDate: '2026-01-31',
      } as any);

      // Assert
      expect(mockRepo.findAndCount).toHaveBeenCalled();
    });
  });
});
