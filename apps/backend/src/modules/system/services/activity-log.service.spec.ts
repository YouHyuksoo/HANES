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
import { getMetadataArgsStorage, Repository } from 'typeorm';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog } from '../../../entities/activity-log.entity';
import { SysConfigService } from './sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';

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

  it('maps user identity to ACTIVITY_LOGS.EMAIL physical column', () => {
    const emailColumn = getMetadataArgsStorage().columns.find((column) => (
      column.target === ActivityLog && column.propertyName === 'userEmail'
    ));

    expect(emailColumn?.options.name).toBe('EMAIL');
  });

  it('maps user display name to ACTIVITY_LOGS.NAME physical column', () => {
    const nameColumn = getMetadataArgsStorage().columns.find((column) => (
      column.target === ActivityLog && column.propertyName === 'userName'
    ));

    expect(nameColumn?.options.name).toBe('NAME');
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
      mockRepo.query.mockResolvedValue([{ SEQ: 7 }] as any);
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
      mockRepo.query.mockResolvedValue([{ SEQ: 8 }] as any);
      mockRepo.create.mockReturnValue({} as any);
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert - should not throw
      await expect(target.logActivity(params)).resolves.not.toThrow();
    });

    it.each(['TOAST_ERROR', 'API_ERROR', 'JS_ERROR'])(
      '%s 는 ENABLE_ACTIVITY_LOG 가 꺼져 있어도 저장한다',
      async (activityType) => {
        mockSysConfigService.isEnabled.mockResolvedValue(false);
        mockRepo.query.mockResolvedValue([{ SEQ: 11 }] as any);
        mockRepo.create.mockReturnValue({} as any);
        mockRepo.save.mockResolvedValue({} as any);

        await target.logActivity({ ...params, activityType });

        // 설정을 아예 조회하지 않는다 — 장애 기록을 설정에 맡기지 않는다
        expect(mockSysConfigService.isEnabled).not.toHaveBeenCalled();
        expect(mockRepo.save).toHaveBeenCalled();
      },
    );

    it('SEQ 를 시퀀스로 채번해 넣는다 (기본값 1 의존 시 같은 날 2건째가 ORA-00001)', async () => {
      mockSysConfigService.isEnabled.mockResolvedValue(true);
      mockRepo.query.mockResolvedValue([{ SEQ: 42 }] as any);
      mockRepo.create.mockReturnValue({} as any);
      mockRepo.save.mockResolvedValue({} as any);

      await target.logActivity(params);

      expect(mockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('SEQ_ACTIVITY_LOG.NEXTVAL'),
      );
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ seq: 42 }));
    });

    it('actorKind 기본값은 HUMAN 이고 SCENARIO 를 넘기면 그대로 저장한다', async () => {
      mockSysConfigService.isEnabled.mockResolvedValue(true);
      mockRepo.query.mockResolvedValue([{ SEQ: 1 }] as any);
      mockRepo.create.mockReturnValue({} as any);
      mockRepo.save.mockResolvedValue({} as any);

      await target.logActivity(params);
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ actorKind: 'HUMAN' }));

      await target.logActivity({ ...params, actorKind: 'SCENARIO' });
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ actorKind: 'SCENARIO' }));
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    // findAll 은 createQueryBuilder + getManyAndCount 패턴을 사용한다.
    const findAllQb = (data: any[] = [], total = 0) => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      };
      return qb;
    };

    it('should return paginated results', async () => {
      // Arrange
      const logs = [{ activityType: 'LOGIN' }] as ActivityLog[];
      mockRepo.createQueryBuilder.mockReturnValue(findAllQb(logs, 1));

      // Act
      const result = await target.findAll({ page: 1, limit: 20 } as any);

      // Assert
      expect(result).toEqual({ data: logs, total: 1, page: 1, limit: 20 });
    });

    it('should apply date range filter when both dates provided', async () => {
      // Arrange
      const qb = findAllQb([], 0);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      await target.findAll({
        page: 1,
        limit: 20,
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      } as any, 'COMPANY', 'PLANT');

      // Assert - 테넌트 + 시작/종료일 조건 적용
      expect(qb.andWhere).toHaveBeenCalledWith('al.company = :company', { company: 'COMPANY' });
      expect(qb.andWhere).toHaveBeenCalledWith('al.plant = :plant', { plant: 'PLANT' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        "al.createdAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')",
        { fromDate: '2026-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        "al.createdAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY",
        { toDate: '2026-01-31' },
      );
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });

    it('should apply only startDate filter', async () => {
      // Arrange
      const qb = findAllQb([], 0);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      await target.findAll({
        page: 1,
        limit: 20,
        fromDate: '2026-01-01',
      } as any);

      // Assert
      expect(qb.andWhere).toHaveBeenCalledWith(
        "al.createdAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')",
        { fromDate: '2026-01-01' },
      );
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        "al.createdAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY",
        expect.anything(),
      );
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });

    it('should apply only endDate filter', async () => {
      // Arrange
      const qb = findAllQb([], 0);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      await target.findAll({
        page: 1,
        limit: 20,
        toDate: '2026-01-31',
      } as any);

      // Assert
      expect(qb.andWhere).toHaveBeenCalledWith(
        "al.createdAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY",
        { toDate: '2026-01-31' },
      );
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        "al.createdAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')",
        expect.anything(),
      );
      expect(qb.getManyAndCount).toHaveBeenCalled();
    });
  });
});
