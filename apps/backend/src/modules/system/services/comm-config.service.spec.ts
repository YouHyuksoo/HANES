/**
 * @file src/modules/system/services/comm-config.service.spec.ts
 * @description CommConfigService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "CommConfigService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CommConfigService } from './comm-config.service';
import { CommConfig } from '../../../entities/comm-config.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('CommConfigService', () => {
  let target: CommConfigService;
  let mockRepo: DeepMocked<Repository<CommConfig>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<CommConfig>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommConfigService,
        { provide: getRepositoryToken(CommConfig), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<CommConfigService>(CommConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated results', async () => {
      // Arrange
      const configs = [{ configName: 'CFG1' }] as CommConfig[];
      mockRepo.find.mockResolvedValue(configs);
      mockRepo.count.mockResolvedValue(1);

      // Act
      const result = await target.findAll({ page: 1, limit: 20 } as any);

      // Assert
      expect(result).toEqual({ data: configs, total: 1, page: 1, limit: 20 });
    });

    it('should apply commType and search filters', async () => {
      // Arrange
      mockRepo.find.mockResolvedValue([]);
      mockRepo.count.mockResolvedValue(0);

      // Act
      await target.findAll({ page: 1, limit: 20, commType: 'SERIAL', search: 'test' } as any);

      // Assert
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return config when found', async () => {
      // Arrange
      const config = { configName: 'CFG1' } as CommConfig;
      mockRepo.findOne.mockResolvedValue(config);

      // Act
      const result = await target.findById('CFG1');

      // Assert
      expect(result).toEqual(config);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByName ───
  describe('findByName', () => {
    it('should return config by name', async () => {
      // Arrange
      const config = { configName: 'CFG1' } as CommConfig;
      mockRepo.findOne.mockResolvedValue(config);

      // Act
      const result = await target.findByName('CFG1');

      // Assert
      expect(result).toEqual(config);
    });

    it('should throw NotFoundException when name not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByName('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByType ───
  describe('findByType', () => {
    it('should return configs by type', async () => {
      // Arrange
      const configs = [{ configName: 'CFG1', commType: 'SERIAL' }] as CommConfig[];
      mockRepo.find.mockResolvedValue(configs);

      // Act
      const result = await target.findByType('SERIAL');

      // Assert
      expect(result).toEqual(configs);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new config', async () => {
      // Arrange
      const dto = { configName: 'NEW', commType: 'SERIAL' } as any;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(dto as CommConfig);
      mockRepo.save.mockResolvedValue(dto as CommConfig);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(dto);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when name already exists', async () => {
      // Arrange
      const dto = { configName: 'EXISTING' } as any;
      mockRepo.findOne.mockResolvedValue({ configName: 'EXISTING' } as CommConfig);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return config', async () => {
      // Arrange
      const existing = { configName: 'CFG1' } as CommConfig;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('CFG1', { commType: 'TCP' } as any);

      // Assert
      expect(result).toEqual(existing);
    });

    it('should throw ConflictException when renaming to existing name', async () => {
      // Arrange
      const existing = { configName: 'CFG1' } as CommConfig;
      const other = { configName: 'CFG2' } as CommConfig;
      // first call for findById, second call for duplicate check
      mockRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(other);

      // Act & Assert
      await expect(target.update('CFG1', { configName: 'CFG2' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should delete and return message', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ configName: 'CFG1' } as CommConfig);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('CFG1');

      // Assert
      expect(result).toEqual({ message: '통신설정이 삭제되었습니다.' });
    });

    it('should throw NotFoundException when config not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.remove('NONE')).rejects.toThrow(NotFoundException);
    });
  });
});
