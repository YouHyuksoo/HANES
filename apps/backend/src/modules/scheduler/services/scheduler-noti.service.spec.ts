/**
 * @file src/modules/scheduler/services/scheduler-noti.service.spec.ts
 * @description SchedulerNotiService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "SchedulerNotiService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulerNotiService } from './scheduler-noti.service';
import { SchedulerNotification } from '../../../entities/scheduler-notification.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SchedulerNotiService', () => {
  let target: SchedulerNotiService;
  let mockNotiRepo: DeepMocked<Repository<SchedulerNotification>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockNotiRepo = createMock<Repository<SchedulerNotification>>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerNotiService,
        { provide: getRepositoryToken(SchedulerNotification), useValue: mockNotiRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SchedulerNotiService>(SchedulerNotiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateNotiId ───
  describe('generateNotiId', () => {
    it('should return next noti ID', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([{ nextId: 3 }]);

      // Act
      const result = await target.generateNotiId('COMP');

      // Assert
      expect(result).toBe(3);
    });
  });

  // ─── createNotification ───
  describe('createNotification', () => {
    it('should create notification with auto ID', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([{ nextId: 1 }]);
      const noti = { notiId: 1, isRead: 'N', userId: 'admin@test.com' } as SchedulerNotification;
      mockNotiRepo.create.mockReturnValue(noti);
      mockNotiRepo.save.mockResolvedValue(noti);

      // Act
      const result = await target.createNotification({
        company: 'COMP',
        userId: 'admin@test.com',
        message: 'Test',
      });

      // Assert
      expect(result.notiId).toBe(1);
      expect(result.isRead).toBe('N');
    });
  });

  // ─── findByUser ───
  describe('findByUser', () => {
    it('should return user notifications', async () => {
      // Arrange
      const notis = [{ notiId: 1, userId: 'user' }] as SchedulerNotification[];
      mockNotiRepo.find.mockResolvedValue(notis);

      // Act
      const result = await target.findByUser('user', 'COMP');

      // Assert
      expect(result).toEqual(notis);
      expect(mockNotiRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user', company: 'COMP' },
        order: { createdAt: 'DESC' },
        take: 20,
      });
    });

    it('should respect custom limit', async () => {
      // Arrange
      mockNotiRepo.find.mockResolvedValue([]);

      // Act
      await target.findByUser('user', 'COMP', 5);

      // Assert
      expect(mockNotiRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ─── getUnreadCount ───
  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      // Arrange
      mockNotiRepo.count.mockResolvedValue(3);

      // Act
      const result = await target.getUnreadCount('user', 'COMP');

      // Assert
      expect(result).toBe(3);
      expect(mockNotiRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user', company: 'COMP', isRead: 'N' },
      });
    });
  });

  // ─── markAsRead ───
  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      mockNotiRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.markAsRead('COMP', 1);

      // Assert
      expect(mockNotiRepo.update).toHaveBeenCalledWith(
        { company: 'COMP', notiId: 1 },
        { isRead: 'Y' },
      );
    });
  });

  // ─── markAllAsRead ───
  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue({ affected: 5 });

      // Act
      await target.markAllAsRead('user', 'COMP');

      // Assert
      expect(mockDataSource.query).toHaveBeenCalled();
    });
  });
});
