/**
 * @file src/modules/master/services/iqc-part-link.service.spec.ts
 * @description IqcPartLinkService 단위 테스트 - 품목-거래처-검사그룹 연결 CRUD 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "IqcPartLinkService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IqcPartLinkService } from './iqc-part-link.service';
import { IqcPartLink } from '../../../entities/iqc-part-link.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('IqcPartLinkService', () => {
  let target: IqcPartLinkService;
  let mockRepo: DeepMocked<Repository<IqcPartLink>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<IqcPartLink>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcPartLinkService,
        { provide: getRepositoryToken(IqcPartLink), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IqcPartLinkService>(IqcPartLinkService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findByCompositeKey ───
  describe('findByCompositeKey', () => {
    it('should return link when found', async () => {
      // Arrange
      const link = { itemCode: 'ITEM01', partnerId: 'P01' } as IqcPartLink;
      mockRepo.findOne.mockResolvedValue(link);

      // Act
      const result = await target.findByCompositeKey('ITEM01', 'P01');

      // Assert
      expect(result).toEqual(link);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM01', partnerId: 'P01' },
        relations: ['part', 'partner', 'group', 'group.items', 'group.items.inspItem'],
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByCompositeKey('ITEM01', 'P01')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new link', async () => {
      // Arrange
      const dto = { itemCode: 'ITEM01', partnerId: 'P01', groupCode: 'IG01' } as any;
      const created = { ...dto, useYn: 'Y' } as IqcPartLink;
      mockRepo.findOne
        .mockResolvedValueOnce(null) // existence check
        .mockResolvedValueOnce(created); // findByCompositeKey after save
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should use "*" as default partnerId when not provided', async () => {
      // Arrange
      const dto = { itemCode: 'ITEM01', partnerId: '', groupCode: 'IG01' } as any;
      const created = { itemCode: 'ITEM01', partnerId: '*', groupCode: 'IG01' } as IqcPartLink;
      mockRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      await target.create(dto);

      // Assert
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM01', partnerId: '*' },
      });
    });

    it('should throw ConflictException when link already exists', async () => {
      // Arrange
      const dto = { itemCode: 'ITEM01', partnerId: 'P01' } as any;
      mockRepo.findOne.mockResolvedValue({ itemCode: 'ITEM01' } as IqcPartLink);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return link', async () => {
      // Arrange
      const existing = { itemCode: 'ITEM01', partnerId: 'P01' } as IqcPartLink;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('ITEM01', 'P01', { groupCode: 'IG02' } as any);

      // Assert
      expect(mockRepo.update).toHaveBeenCalledWith(
        { itemCode: 'ITEM01', partnerId: 'P01' },
        expect.objectContaining({ groupCode: 'IG02' }),
      );
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return confirmation', async () => {
      // Arrange
      const existing = { itemCode: 'ITEM01', partnerId: 'P01' } as IqcPartLink;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('ITEM01', 'P01');

      // Assert
      expect(result).toEqual({ itemCode: 'ITEM01', partnerId: 'P01', deleted: true });
    });
  });
});
