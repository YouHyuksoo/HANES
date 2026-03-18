/**
 * @file src/modules/master/services/iqc-item-pool.service.spec.ts
 * @description IqcItemPoolService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "IqcItemPoolService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IqcItemPoolService } from './iqc-item-pool.service';
import { IqcItemPool } from '../../../entities/iqc-item-pool.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('IqcItemPoolService', () => {
  let target: IqcItemPoolService;
  let mockRepo: DeepMocked<Repository<IqcItemPool>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<IqcItemPool>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcItemPoolService,
        { provide: getRepositoryToken(IqcItemPool), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IqcItemPoolService>(IqcItemPoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findByCode ───
  describe('findByCode', () => {
    it('should return item when found', async () => {
      // Arrange
      const item = { inspItemCode: 'IQ01', inspItemName: 'Dimension' } as IqcItemPool;
      mockRepo.findOne.mockResolvedValue(item);

      // Act
      const result = await target.findByCode('IQ01');

      // Assert
      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByCode('IQ99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new item', async () => {
      // Arrange
      const dto = { inspItemCode: 'IQ01', inspItemName: 'Dimension' } as any;
      const created = { ...dto } as IqcItemPool;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when item code exists', async () => {
      // Arrange
      const dto = { inspItemCode: 'IQ01' } as any;
      mockRepo.findOne.mockResolvedValue({ inspItemCode: 'IQ01' } as IqcItemPool);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return item', async () => {
      // Arrange
      const existing = { inspItemCode: 'IQ01', inspItemName: 'Old' } as IqcItemPool;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue({ ...existing, inspItemName: 'New' } as IqcItemPool);

      // Act
      const result = await target.update('IQ01', { inspItemName: 'New' } as any);

      // Assert
      expect(result.inspItemName).toBe('New');
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should remove and return confirmation', async () => {
      // Arrange
      const existing = { inspItemCode: 'IQ01' } as IqcItemPool;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.remove.mockResolvedValue(existing);

      // Act
      const result = await target.delete('IQ01');

      // Assert
      expect(result).toEqual({ inspItemCode: 'IQ01', deleted: true });
    });
  });
});
