/**
 * @file src/modules/user/user.service.spec.ts
 * @description UserService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "UserService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from '../../entities/user.entity';
import { MockLoggerService } from '../../common/test/mock-logger.service';

describe('UserService', () => {
  let target: UserService;
  let mockRepo: DeepMocked<Repository<User>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<User>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return user list', async () => {
      // Arrange
      const users = [{ email: 'user@test.com' }] as User[];
      mockRepo.find.mockResolvedValue(users);

      // Act
      const result = await target.findAll();

      // Assert
      expect(result).toEqual(users);
    });

    it('should apply search filter', async () => {
      // Arrange
      mockRepo.find.mockResolvedValue([]);

      // Act
      await target.findAll({ search: 'test' });

      // Assert
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it('should apply role and status filters', async () => {
      // Arrange
      mockRepo.find.mockResolvedValue([]);

      // Act
      await target.findAll({ role: 'ADMIN', status: 'ACTIVE' }, 'COMP');

      // Assert
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  // ─── findOne ───
  describe('findOne', () => {
    it('should return user when found', async () => {
      // Arrange
      const user = { email: 'user@test.com' } as User;
      mockRepo.findOne.mockResolvedValue(user);

      // Act
      const result = await target.findOne('user@test.com');

      // Assert
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findOne('none@test.com')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new user', async () => {
      // Arrange
      const dto = { email: 'new@test.com', password: 'pw', name: 'New' } as any;
      const saved = {
        email: 'new@test.com',
        name: 'New',
        role: 'OPERATOR',
        status: 'ACTIVE',
        photoUrl: null,
        pdaRoleCode: null,
        createdAt: new Date(),
      } as User;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValue(saved);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result.email).toBe('new@test.com');
    });

    it('should throw ConflictException when email exists', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ email: 'existing@test.com' } as User);

      // Act & Assert
      await expect(target.create({ email: 'existing@test.com' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update user and return result', async () => {
      // Arrange
      const user = { email: 'user@test.com', name: 'Old' } as User;
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('user@test.com', { name: 'New' } as any);

      // Assert
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.update('none@test.com', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should delete user and return message', async () => {
      // Arrange
      const user = { email: 'user@test.com' } as User;
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('user@test.com');

      // Assert
      expect(result).toEqual({ message: '사용자가 삭제되었습니다.' });
    });
  });

  // ─── updatePhoto ───
  describe('updatePhoto', () => {
    it('should update photo URL', async () => {
      // Arrange
      const user = { email: 'user@test.com' } as User;
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updatePhoto('user@test.com', 'http://photo.png');

      // Assert
      expect(result.photoUrl).toBe('http://photo.png');
      expect(result.message).toBe('사진이 업로드되었습니다.');
    });

    it('should handle null photo URL (delete)', async () => {
      // Arrange
      const user = { email: 'user@test.com' } as User;
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.updatePhoto('user@test.com', null);

      // Assert
      expect(result.photoUrl).toBeNull();
      expect(result.message).toBe('사진이 삭제되었습니다.');
    });
  });
});
