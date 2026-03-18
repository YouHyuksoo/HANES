/**
 * @file src/modules/master/services/com-code.service.spec.ts
 * @description ComCodeService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "ComCodeService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ComCodeService } from './com-code.service';
import { ComCode } from '../../../entities/com-code.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ComCodeService', () => {
  let target: ComCodeService;
  let mockRepo: DeepMocked<Repository<ComCode>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<ComCode>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComCodeService,
        { provide: getRepositoryToken(ComCode), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ComCodeService>(ComCodeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAllActive ───
  describe('findAllActive', () => {
    it('should return codes grouped by groupCode', async () => {
      // Arrange
      const codes = [
        { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Name1', codeDesc: null, sortOrder: 1, attr1: null, attr2: null, attr3: null },
        { groupCode: 'GRP1', detailCode: 'D2', codeName: 'Name2', codeDesc: null, sortOrder: 2, attr1: null, attr2: null, attr3: null },
        { groupCode: 'GRP2', detailCode: 'D1', codeName: 'Name3', codeDesc: null, sortOrder: 1, attr1: null, attr2: null, attr3: null },
      ] as ComCode[];
      mockRepo.find.mockResolvedValue(codes);

      // Act
      const result = await target.findAllActive();

      // Assert
      expect(result['GRP1']).toHaveLength(2);
      expect(result['GRP2']).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { useYn: 'Y' },
        order: { groupCode: 'asc', sortOrder: 'asc' },
        select: expect.any(Object),
      });
    });

    it('should return empty object when no codes exist', async () => {
      // Arrange
      mockRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findAllActive();

      // Assert
      expect(result).toEqual({});
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return code when found', async () => {
      // Arrange
      const code = { groupCode: 'GRP1', detailCode: 'D1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(code);

      // Act
      const result = await target.findById('GRP1::D1');

      // Assert
      expect(result).toEqual(code);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { groupCode: 'GRP1', detailCode: 'D1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('GRP1::D1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByCode ───
  describe('findByCode', () => {
    it('should return code when found', async () => {
      // Arrange
      const code = { groupCode: 'GRP1', detailCode: 'D1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(code);

      // Act
      const result = await target.findByCode('GRP1', 'D1');

      // Assert
      expect(result).toEqual(code);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByCode('GRP1', 'D1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new com code', async () => {
      // Arrange
      const dto = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Test' } as any;
      const created = { ...dto, useYn: 'Y', sortOrder: 0 } as ComCode;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when code already exists', async () => {
      // Arrange
      const dto = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Test' } as any;
      mockRepo.findOne.mockResolvedValue({ groupCode: 'GRP1' } as ComCode);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return the code', async () => {
      // Arrange
      const existing = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Old' } as ComCode;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('GRP1::D1', { codeName: 'New' } as any);

      // Assert
      expect(result).toEqual(existing);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when code not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.update('GRP1::D1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return result', async () => {
      // Arrange
      const existing = { groupCode: 'GRP1', detailCode: 'D1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('GRP1::D1');

      // Assert
      expect(result).toEqual({ id: 'GRP1::D1', deleted: true });
    });
  });

  // ─── deleteByGroupCode ───
  describe('deleteByGroupCode', () => {
    it('should delete all codes in group and return count', async () => {
      // Arrange
      mockRepo.delete.mockResolvedValue({ affected: 5 } as any);

      // Act
      const result = await target.deleteByGroupCode('GRP1');

      // Assert
      expect(result).toEqual({ count: 5 });
      expect(mockRepo.delete).toHaveBeenCalledWith({ groupCode: 'GRP1' });
    });
  });

  // ─── findByGroupCode ───
  describe('findByGroupCode', () => {
    it('should return active codes for group', async () => {
      // Arrange
      const codes = [{ groupCode: 'GRP1', detailCode: 'D1' }] as ComCode[];
      mockRepo.find.mockResolvedValue(codes);

      // Act
      const result = await target.findByGroupCode('GRP1');

      // Assert
      expect(result).toEqual(codes);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { groupCode: 'GRP1', useYn: 'Y' },
        order: { sortOrder: 'asc' },
      });
    });
  });
});
