/**
 * @file src/modules/system/services/sys-config.service.spec.ts
 * @description SysConfigService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "SysConfigService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SysConfigService } from './sys-config.service';
import { SysConfig } from '../../../entities/sys-config.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SysConfigService', () => {
  let target: SysConfigService;
  let mockRepo: DeepMocked<Repository<SysConfig>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<SysConfig>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SysConfigService,
        { provide: getRepositoryToken(SysConfig), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SysConfigService>(SysConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return grouped configs', async () => {
      // Arrange
      const configs = [
        { configKey: 'K1', configGroup: 'G1', label: 'Label1' },
        { configKey: 'K2', configGroup: 'G1', label: 'Label2' },
        { configKey: 'K3', configGroup: 'G2', label: 'Label3' },
      ] as SysConfig[];
      mockRepo.find.mockResolvedValue(configs);

      // Act
      const result = await target.findAll({} as any);

      // Assert
      expect(result.total).toBe(3);
      expect(result.grouped['G1']).toHaveLength(2);
      expect(result.grouped['G2']).toHaveLength(1);
    });

    it('should filter by search term', async () => {
      // Arrange
      const configs = [
        { configKey: 'ENABLE_LOG', configGroup: 'G1', label: 'Enable Log', description: null },
        { configKey: 'OTHER', configGroup: 'G1', label: 'Other', description: null },
      ] as SysConfig[];
      mockRepo.find.mockResolvedValue(configs);

      // Act
      const result = await target.findAll({ search: 'log' } as any);

      // Assert
      expect(result.total).toBe(1);
    });
  });

  // ─── findAllActive ───
  describe('findAllActive', () => {
    it('should return active configs as key-value map', async () => {
      // Arrange
      const configs = [
        { configKey: 'KEY1', configValue: 'VAL1', isActive: 'Y' },
        { configKey: 'KEY2', configValue: 'VAL2', isActive: 'Y' },
      ] as SysConfig[];
      mockRepo.find.mockResolvedValue(configs);

      // Act
      const result = await target.findAllActive();

      // Assert
      expect(result.map).toEqual({ KEY1: 'VAL1', KEY2: 'VAL2' });
      expect(result.data).toEqual(configs);
    });
  });

  // ─── getValue ───
  describe('getValue', () => {
    it('should return config value when found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ configKey: 'KEY', configValue: 'VALUE' } as SysConfig);

      // Act
      const result = await target.getValue('KEY');

      // Assert
      expect(result).toBe('VALUE');
    });

    it('should return null when config not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await target.getValue('NONE');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ─── isEnabled ───
  describe('isEnabled', () => {
    it('should return true when value is Y', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ configKey: 'KEY', configValue: 'Y' } as SysConfig);

      // Act
      const result = await target.isEnabled('KEY');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when value is not Y', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ configKey: 'KEY', configValue: 'N' } as SysConfig);

      // Act
      const result = await target.isEnabled('KEY');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when config not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await target.isEnabled('NONE');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new config', async () => {
      // Arrange
      const dto = { configGroup: 'G1', configKey: 'NEW' } as any;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(dto as SysConfig);
      mockRepo.save.mockResolvedValue(dto as SysConfig);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(dto);
    });

    it('should throw ConflictException when config exists', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ configKey: 'EXISTING' } as SysConfig);

      // Act & Assert
      await expect(target.create({ configGroup: 'G1', configKey: 'EXISTING' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update config', async () => {
      // Arrange
      const existing = { configKey: 'KEY' } as SysConfig;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('KEY', { configValue: 'NEW_VAL' } as any);

      // Assert
      expect(result).toEqual(existing);
    });

    it('should throw NotFoundException when config not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.update('NONE', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── bulkUpdate ───
  describe('bulkUpdate', () => {
    it('should update multiple configs', async () => {
      // Arrange
      const config = { configKey: 'K1', configValue: 'V1' } as SysConfig;
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRepo.findOne.mockResolvedValue(config);

      // Act
      const result = await target.bulkUpdate({
        items: [{ id: 'K1', configValue: 'NEW_V1' }],
      } as any);

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should delete config and return result', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue({ configKey: 'KEY' } as SysConfig);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('KEY');

      // Assert
      expect(result).toEqual({ id: 'KEY', deleted: true });
    });

    it('should throw NotFoundException when config not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.remove('NONE')).rejects.toThrow(NotFoundException);
    });
  });
});
